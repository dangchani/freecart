import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'edge';

const createBrandSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100),
  logo_url: z.string().url().optional().nullable(),
  description: z.string().optional().nullable(),
  website_url: z.string().url().optional().nullable(),
  is_visible: z.boolean().default(true),
  sort_order: z.number().int().default(0),
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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search');
    const isVisible = searchParams.get('is_visible');
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('product_brands')
      .select('*', { count: 'exact' })
      .order('name', { ascending: true })
      .range(from, to);

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    if (isVisible !== null) {
      query = query.eq('is_visible', isVisible === 'true');
    }

    const { data: brands, error, count } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    // Get product count per brand
    const { data: productCounts } = await supabase
      .from('products')
      .select('brand_id');

    const countMap: Record<string, number> = {};
    (productCounts || []).forEach((p) => {
      if (p.brand_id) {
        countMap[p.brand_id] = (countMap[p.brand_id] || 0) + 1;
      }
    });

    const brandsWithStats = (brands || []).map((brand) => ({
      ...brand,
      product_count: countMap[brand.id] || 0,
    }));

    return NextResponse.json({
      success: true,
      data: brandsWithStats,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: '브랜드 목록을 불러오는 중 오류가 발생했습니다.' },
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
    const brandData = createBrandSchema.parse(body);

    // Check slug uniqueness
    const { data: existing } = await supabase
      .from('product_brands')
      .select('id')
      .eq('slug', brandData.slug)
      .single();

    if (existing) {
      return NextResponse.json(
        { success: false, error: '이미 사용 중인 슬러그입니다.' },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from('product_brands')
      .insert(brandData)
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
      { success: false, error: '브랜드 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
