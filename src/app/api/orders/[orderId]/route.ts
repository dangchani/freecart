import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('orders')
      .select(
        `
        *,
        items:order_items(*)
      `
      )
      .eq('id', params.orderId)
      .eq('user_id', user.id)
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: '주문을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: '주문 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
