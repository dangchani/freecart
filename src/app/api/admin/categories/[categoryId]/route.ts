import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'edge';

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  parent_id: z.string().uuid().optional().nullable(),
  image: z.string().url().optional().nullable(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
  meta_title: z.string().optional().nullable(),
  meta_description: z.string().optional().nullable(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { categoryId } = await params;

    const { data: category, error } = await supabase
      .from('categories')
      .select('*, parent:categories!parent_id(id, name, slug)')
      .eq('id', categoryId)
      .single();

    if (error || !category) {
      return NextResponse.json({ success: false, error: '카테고리를 찾을 수 없습니다.' }, { status: 404 });
    }

    // Get product count
    const { count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', categoryId);

    // Get subcategories
    const { data: subcategories } = await supabase
      .from('categories')
      .select('id, name, slug, is_active, sort_order')
      .eq('parent_id', categoryId)
      .order('sort_order', { ascending: true });

    return NextResponse.json({
      success: true,
      data: {
        ...category,
        product_count: productCount || 0,
        subcategories: subcategories || [],
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: '카테고리 정보를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { categoryId } = await params;
    const body = await request.json();
    const updateData = updateCategorySchema.parse(body);

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: '변경할 내용이 없습니다.' }, { status: 400 });
    }

    // Prevent circular parent reference
    if (updateData.parent_id === categoryId) {
      return NextResponse.json(
        { success: false, error: '카테고리 자신을 상위 카테고리로 설정할 수 없습니다.' },
        { status: 400 }
      );
    }

    // Check slug uniqueness if changing
    if (updateData.slug) {
      const { data: existing } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', updateData.slug)
        .neq('id', categoryId)
        .single();

      if (existing) {
        return NextResponse.json(
          { success: false, error: '이미 사용 중인 슬러그입니다.' },
          { status: 409 }
        );
      }
    }

    const { data, error } = await supabase
      .from('categories')
      .update(updateData)
      .eq('id', categoryId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json({ success: false, error: '카테고리를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: '입력값이 올바르지 않습니다.', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: '카테고리 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { categoryId } = await params;

    const { data: category } = await supabase
      .from('categories')
      .select('id, name')
      .eq('id', categoryId)
      .single();

    if (!category) {
      return NextResponse.json({ success: false, error: '카테고리를 찾을 수 없습니다.' }, { status: 404 });
    }

    // Check for products in this category
    const { count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', categoryId);

    if (productCount && productCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `이 카테고리에 ${productCount}개의 상품이 있습니다. 상품을 먼저 이동하거나 삭제해주세요.`,
        },
        { status: 400 }
      );
    }

    // Check for subcategories
    const { count: subCount } = await supabase
      .from('categories')
      .select('*', { count: 'exact', head: true })
      .eq('parent_id', categoryId);

    if (subCount && subCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `하위 카테고리가 ${subCount}개 있습니다. 하위 카테고리를 먼저 삭제해주세요.`,
        },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', categoryId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `${category.name} 카테고리가 삭제되었습니다.`,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: '카테고리 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
