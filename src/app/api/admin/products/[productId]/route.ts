import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'edge';

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  sku: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  regularPrice: z.number().positive().optional(),
  salePrice: z.number().positive().optional().nullable(),
  costPrice: z.number().positive().optional().nullable(),
  stockQuantity: z.number().int().min(0).optional(),
  stockAlertQuantity: z.number().int().min(0).optional(),
  status: z.enum(['active', 'inactive', 'soldout']).optional(),
  isFeatured: z.boolean().optional(),
  isNew: z.boolean().optional(),
  isBest: z.boolean().optional(),
  isSale: z.boolean().optional(),
  manufacturer: z.string().optional(),
  origin: z.string().optional(),
  tags: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
  thumbnail: z.string().optional(),
  weight: z.number().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
});

async function requireAdmin(supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: '인증이 필요합니다.', status: 401, user: null };

  const { data: adminProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!adminProfile || adminProfile.role !== 'admin') {
    return { error: '관리자 권한이 필요합니다.', status: 403, user: null };
  }
  return { error: null, status: 200, user };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const supabase = await createClient();
    const { productId } = await params;

    const auth = await requireAdmin(supabase);
    if (auth.error) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { data, error } = await supabase
      .from('products')
      .select('*, categories(id, name), brands(id, name)')
      .eq('id', productId)
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: '상품을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json(
      { success: false, error: '상품 정보를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const supabase = await createClient();
    const { productId } = await params;

    const auth = await requireAdmin(supabase);
    if (auth.error) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const updates = updateProductSchema.parse(body);

    const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.slug !== undefined) dbUpdates.slug = updates.slug;
    if (updates.sku !== undefined) dbUpdates.sku = updates.sku;
    if (updates.summary !== undefined) dbUpdates.summary = updates.summary;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.categoryId !== undefined) dbUpdates.category_id = updates.categoryId;
    if (updates.brandId !== undefined) dbUpdates.brand_id = updates.brandId;
    if (updates.regularPrice !== undefined) dbUpdates.regular_price = updates.regularPrice;
    if (updates.salePrice !== undefined) dbUpdates.sale_price = updates.salePrice;
    if (updates.costPrice !== undefined) dbUpdates.cost_price = updates.costPrice;
    if (updates.stockQuantity !== undefined) dbUpdates.stock_quantity = updates.stockQuantity;
    if (updates.stockAlertQuantity !== undefined) dbUpdates.stock_alert_quantity = updates.stockAlertQuantity;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.isFeatured !== undefined) dbUpdates.is_featured = updates.isFeatured;
    if (updates.isNew !== undefined) dbUpdates.is_new = updates.isNew;
    if (updates.isBest !== undefined) dbUpdates.is_best = updates.isBest;
    if (updates.isSale !== undefined) dbUpdates.is_sale = updates.isSale;
    if (updates.manufacturer !== undefined) dbUpdates.manufacturer = updates.manufacturer;
    if (updates.origin !== undefined) dbUpdates.origin = updates.origin;
    if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
    if (updates.images !== undefined) dbUpdates.images = updates.images;
    if (updates.thumbnail !== undefined) dbUpdates.thumbnail = updates.thumbnail;
    if (updates.weight !== undefined) dbUpdates.weight = updates.weight;
    if (updates.seoTitle !== undefined) dbUpdates.seo_title = updates.seoTitle;
    if (updates.seoDescription !== undefined) dbUpdates.seo_description = updates.seoDescription;

    const { data, error } = await supabase
      .from('products')
      .update(dbUpdates)
      .eq('id', productId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
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
      { success: false, error: '상품을 수정하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const supabase = await createClient();
    const { productId } = await params;

    const auth = await requireAdmin(supabase);
    if (auth.error) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { error } = await supabase.from('products').delete().eq('id', productId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: { id: productId } });
  } catch {
    return NextResponse.json(
      { success: false, error: '상품을 삭제하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
