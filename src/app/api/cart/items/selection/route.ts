import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'edge';

const selectionSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1, '선택할 항목을 입력해주세요.'),
  selected: z.boolean(),
});

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { itemIds, selected } = selectionSchema.parse(body);

    // Update only items that belong to the current user
    const { data, error } = await supabase
      .from('carts')
      .update({ selected })
      .eq('user_id', user.id)
      .in('id', itemIds)
      .select();

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
      { success: false, error: '장바구니 선택 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
