import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const issueSchema = z.union([
  z.object({ userIds: z.array(z.string().uuid()).min(1), all: z.undefined().optional() }),
  z.object({ all: z.literal(true), userIds: z.undefined().optional() }),
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ couponId: string }> }
) {
  try {
    const supabase = await createClient();
    const { couponId } = await params;

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

    const { data: coupon } = await supabase
      .from('coupons')
      .select('id, name, is_active')
      .eq('id', couponId)
      .single();

    if (!coupon) {
      return NextResponse.json({ success: false, error: '쿠폰을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (!coupon.is_active) {
      return NextResponse.json({ success: false, error: '비활성화된 쿠폰입니다.' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = issueSchema.parse(body);

    let targetUserIds: string[] = [];

    if ('all' in parsed && parsed.all === true) {
      const { data: allUsers } = await supabase.from('users').select('id');
      targetUserIds = (allUsers || []).map((u: { id: string }) => u.id);
    } else if ('userIds' in parsed && parsed.userIds) {
      targetUserIds = parsed.userIds;
    }

    if (targetUserIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '발급할 사용자가 없습니다.' },
        { status: 400 }
      );
    }

    const { data: existingIssues } = await supabase
      .from('user_coupons')
      .select('user_id')
      .eq('coupon_id', couponId)
      .in('user_id', targetUserIds);

    const alreadyIssuedIds = new Set((existingIssues || []).map((r: { user_id: string }) => r.user_id));
    const newUserIds = targetUserIds.filter((id) => !alreadyIssuedIds.has(id));

    if (newUserIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '선택한 사용자 모두 이미 쿠폰을 보유하고 있습니다.' },
        { status: 400 }
      );
    }

    const records = newUserIds.map((userId) => ({
      user_id: userId,
      coupon_id: couponId,
      is_used: false,
    }));

    const { error } = await supabase.from('user_coupons').insert(records);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: {
        issued: newUserIds.length,
        skipped: alreadyIssuedIds.size,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: '쿠폰을 발급하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
