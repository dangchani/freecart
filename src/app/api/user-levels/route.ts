import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('user_levels')
      .select('*')
      .order('min_purchase_amount', { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: '회원 등급 정보를 불러오는 중 오류가 발생했습니다.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (error) {
    console.error('GET /user-levels error:', error);
    return NextResponse.json(
      { success: false, error: '회원 등급 정보를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
