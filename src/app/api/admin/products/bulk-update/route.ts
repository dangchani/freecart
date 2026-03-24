import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'edge';

const VALID_STATUSES = ['active', 'inactive', 'draft', 'sold_out', 'discontinued'] as const;

const bulkUpdateSchema = z.object({
  productIds: z.array(z.string().uuid()).min(1).max(500),
  updates: z.object({
    status: z.enum(VALID_STATUSES).optional(),
    is_feature: z.boolean().optional(),
    category_id: z.string().uuid().optional().nullable(),
    brand_id: z.string().uuid().optional().nullable(),
    is_active: z.boolean().optional(),
  }).refine(
    (data) => Object.keys(data).length > 0,
    { message: '변경할 필드가 하나 이상 있어야 합니다.' }
  ),
});

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
    const { productIds, updates } = bulkUpdateSchema.parse(body);

    // Validate category_id if provided
    if (updates.category_id) {
      const { data: category } = await supabase
        .from('categories')
        .select('id')
        .eq('id', updates.category_id)
        .single();

      if (!category) {
        return NextResponse.json(
          { success: false, error: '카테고리를 찾을 수 없습니다.' },
          { status: 400 }
        );
      }
    }

    // Validate brand_id if provided
    if (updates.brand_id) {
      const { data: brand } = await supabase
        .from('product_brands')
        .select('id')
        .eq('id', updates.brand_id)
        .single();

      if (!brand) {
        return NextResponse.json(
          { success: false, error: '브랜드를 찾을 수 없습니다.' },
          { status: 400 }
        );
      }
    }

    // Build the update object with snake_case keys
    const updatePayload: Record<string, unknown> = {};
    if (updates.status !== undefined) updatePayload.status = updates.status;
    if (updates.is_feature !== undefined) updatePayload.is_feature = updates.is_feature;
    if (updates.category_id !== undefined) updatePayload.category_id = updates.category_id;
    if (updates.brand_id !== undefined) updatePayload.brand_id = updates.brand_id;
    if (updates.is_active !== undefined) updatePayload.is_active = updates.is_active;
    updatePayload.updated_at = new Date().toISOString();

    const { error, count } = await supabase
      .from('products')
      .update(updatePayload)
      .in('id', productIds);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `${count ?? productIds.length}개 상품이 업데이트되었습니다.`,
      updated_count: count ?? productIds.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: '입력값이 올바르지 않습니다.', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: '상품 일괄 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
