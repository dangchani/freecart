import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { productId } = params;

    // Verify the item exists in the user's wishlist
    const { data: existing } = await supabase
      .from('user_wishlist')
      .select('id')
      .eq('user_id', user.id)
      .eq('product_id', productId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '위시리스트에서 해당 상품을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const { error } = await supabase
      .from('user_wishlist')
      .delete()
      .eq('user_id', user.id)
      .eq('product_id', productId);

    if (error) {
      return NextResponse.json(
        { success: false, error: '위시리스트 삭제 중 오류가 발생했습니다.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { message: '위시리스트에서 삭제되었습니다.' },
    });
  } catch (error) {
    console.error('DELETE /users/me/wishlist/[productId] error:', error);
    return NextResponse.json(
      { success: false, error: '위시리스트 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
