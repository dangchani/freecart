import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'edge';

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100),
  description: z.string().optional().nullable(),
  parent_id: z.string().uuid().optional().nullable(),
  image: z.string().url().optional().nullable(),
  sort_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
  meta_title: z.string().optional().nullable(),
  meta_description: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get('parent_id');
    const isActive = searchParams.get('is_active');

    let query = supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (parentId === 'null' || parentId === '') {
      query = query.is('parent_id', null);
    } else if (parentId) {
      query = query.eq('parent_id', parentId);
    }

    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true');
    }

    const { data: categories, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    // Get product count per category
    const { data: productCounts } = await supabase
      .from('products')
      .select('category_id');

    const countMap: Record<string, number> = {};
    (productCounts || []).forEach((p) => {
      if (p.category_id) {
        countMap[p.category_id] = (countMap[p.category_id] || 0) + 1;
      }
    });

    const categoriesWithStats = (categories || []).map((cat) => ({
      ...cat,
      product_count: countMap[cat.id] || 0,
    }));

    return NextResponse.json({ success: true, data: categoriesWithStats });
  } catch {
    return NextResponse.json(
      { success: false, error: '카테고리 목록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const body = await request.json();
    const categoryData = createCategorySchema.parse(body);

    // Validate parent_id if provided
    if (categoryData.parent_id) {
      const { data: parent } = await supabase
        .from('categories')
        .select('id')
        .eq('id', categoryData.parent_id)
        .single();

      if (!parent) {
        return NextResponse.json(
          { success: false, error: '상위 카테고리를 찾을 수 없습니다.' },
          { status: 400 }
        );
      }
    }

    // Check slug uniqueness
    const { data: existing } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', categoryData.slug)
      .single();

    if (existing) {
      return NextResponse.json(
        { success: false, error: '이미 사용 중인 슬러그입니다.' },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from('categories')
      .insert(categoryData)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: '입력값이 올바르지 않습니다.', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: '카테고리 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
