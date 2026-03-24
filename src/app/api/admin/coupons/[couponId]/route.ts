import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'edge';

const updateCouponSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  discountType: z.enum(['percent', 'fixed']).optional(),
  discountValue: z.number().positive().optional(),
  minOrderAmount: z.number().min(0).optional(),
  maxDiscountAmount: z.number().positive().optional().nullable(),
  totalQuantity: z.number().int().positive().optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional(),
  targetType: z.enum(['all', 'category', 'product', 'user_level']).optional(),
  targetIds: z.array(z.string()).optional(),
});

async function getAdminUser(supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: adminProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!adminProfile || adminProfile.role !== 'admin') return null;
  return user;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ couponId: string }> }
) {
  try {
    const supabase = await createClient();
    const { couponId } = await params;

    const adminUser = await getAdminUser(supabase);
    if (!adminUser) {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('id', couponId)
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: '쿠폰을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json(
      { success: false, error: '쿠폰 정보를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ couponId: string }> }
) {
  try {
    const supabase = await createClient();
    const { couponId } = await params;

    const adminUser = await getAdminUser(supabase);
    if (!adminUser) {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const body = await request.json();
    const updates = updateCouponSchema.parse(body);

    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.discountType !== undefined) dbUpdates.discount_type = updates.discountType;
    if (updates.discountValue !== undefined) dbUpdates.discount_value = updates.discountValue;
    if (updates.minOrderAmount !== undefined) dbUpdates.min_order_amount = updates.minOrderAmount;
    if (updates.maxDiscountAmount !== undefined) dbUpdates.max_discount_amount = updates.maxDiscountAmount;
    if (updates.totalQuantity !== undefined) dbUpdates.total_quantity = updates.totalQuantity;
    if (updates.startsAt !== undefined) dbUpdates.starts_at = updates.startsAt;
    if (updates.expiresAt !== undefined) dbUpdates.expires_at = updates.expiresAt;
    if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
    if (updates.targetType !== undefined) dbUpdates.target_type = updates.targetType;
    if (updates.targetIds !== undefined) dbUpdates.target_ids = updates.targetIds;

    const { data, error } = await supabase
      .from('coupons')
      .update(dbUpdates)
      .eq('id', couponId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: '쿠폰을 수정하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ couponId: string }> }
) {
  try {
    const supabase = await createClient();
    const { couponId } = await params;

    const adminUser = await getAdminUser(supabase);
    if (!adminUser) {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('coupons')
      .update({ is_active: false })
      .eq('id', couponId)
      .select('id, name, is_active')
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json(
      { success: false, error: '쿠폰을 비활성화하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
