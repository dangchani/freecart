import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'edge';

const adjustPointsSchema = z.object({
  amount: z.number().int(),
  description: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const supabase = await createClient();
    const { userId } = await params;

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
    const { amount, description } = adjustPointsSchema.parse(body);

    const { data: targetUser } = await supabase
      .from('users')
      .select('id, points')
      .eq('id', userId)
      .single();

    if (!targetUser) {
      return NextResponse.json({ success: false, error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    const currentPoints: number = targetUser.points || 0;
    const newPoints = currentPoints + amount;

    if (newPoints < 0) {
      return NextResponse.json(
        { success: false, error: '포인트가 부족합니다.' },
        { status: 400 }
      );
    }

    const { error: historyError } = await supabase
      .from('user_points_history')
      .insert({
        user_id: userId,
        amount,
        description,
        balance_after: newPoints,
        created_by: user.id,
      });

    if (historyError) {
      return NextResponse.json({ success: false, error: historyError.message }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('users')
      .update({ points: newPoints, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select('id, name, email, points')
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
      { success: false, error: '포인트를 조정하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
