import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createProductSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  sku: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  regularPrice: z.number().positive(),
  salePrice: z.number().positive().optional(),
  costPrice: z.number().positive().optional(),
  stockQuantity: z.number().int().min(0).default(0),
  stockAlertQuantity: z.number().int().min(0).default(5),
  status: z.enum(['active', 'inactive', 'soldout']).default('active'),
  isFeatured: z.boolean().default(false),
  isNew: z.boolean().default(false),
  isBest: z.boolean().default(false),
  isSale: z.boolean().default(false),
  manufacturer: z.string().optional(),
  origin: z.string().optional(),
  tags: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
  thumbnail: z.string().optional(),
  weight: z.number().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { data: adminProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const categoryId = searchParams.get('categoryId');
    const brandId = searchParams.get('brandId');
    const search = searchParams.get('search');
    const isLowStock = searchParams.get('isLowStock') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('products')
      .select('*, categories(id, name), brands(id, name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status) {
      query = query.eq('status', status);
    }
    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }
    if (brandId) {
      query = query.eq('brand_id', brandId);
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    }
    if (isLowStock) {
      query = query.filter('stock_quantity', 'lt', 'stock_alert_quantity');
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: '상품 목록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { data: adminProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const productData = createProductSchema.parse(body);

    const { data, error } = await supabase
      .from('products')
      .insert({
        name: productData.name,
        slug: productData.slug,
        sku: productData.sku,
        summary: productData.summary,
        description: productData.description,
        category_id: productData.categoryId,
        brand_id: productData.brandId,
        regular_price: productData.regularPrice,
        sale_price: productData.salePrice,
        cost_price: productData.costPrice,
        stock_quantity: productData.stockQuantity,
        stock_alert_quantity: productData.stockAlertQuantity,
        status: productData.status,
        is_featured: productData.isFeatured,
        is_new: productData.isNew,
        is_best: productData.isBest,
        is_sale: productData.isSale,
        manufacturer: productData.manufacturer,
        origin: productData.origin,
        tags: productData.tags,
        images: productData.images,
        thumbnail: productData.thumbnail,
        weight: productData.weight,
        seo_title: productData.seoTitle,
        seo_description: productData.seoDescription,
      })
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
      { success: false, error: '상품을 생성하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
