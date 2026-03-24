import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'edge';

const changeVariantSchema = z.object({
  variantId: z.string().uuid(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { variantId } = changeVariantSchema.parse(body);

    // Verify the cart item belongs to the user
    const { data: cartItem, error: fetchError } = await supabase
      .from('cart_items')
      .select('id, product_id')
      .eq('id', params.itemId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !cartItem) {
      return NextResponse.json(
        { success: false, error: '장바구니 항목을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Verify the variant belongs to the same product
    const { data: variant, error: variantError } = await supabase
      .from('product_variants')
      .select('id, product_id')
      .eq('id', variantId)
      .eq('product_id', cartItem.product_id)
      .single();

    if (variantError || !variant) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 옵션입니다.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('cart_items')
      .update({
        variant_id: variantId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.itemId)
      .eq('user_id', user.id)
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
      { success: false, error: '장바구니 옵션 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
