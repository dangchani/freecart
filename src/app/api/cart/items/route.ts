import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const bulkDeleteSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1, '삭제할 항목을 선택해주세요.'),
});

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { itemIds } = bulkDeleteSchema.parse(body);

    // Delete only items that belong to the current user
    const { error } = await supabase
      .from('carts')
      .delete()
      .eq('user_id', user.id)
      .in('id', itemIds);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: { deletedIds: itemIds } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: '입력값이 올바르지 않습니다.', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: '장바구니 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
