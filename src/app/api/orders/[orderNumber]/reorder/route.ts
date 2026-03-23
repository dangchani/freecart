import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  _request: NextRequest,
  { params }: { params: { orderNumber: string } }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    // Fetch original order and its items
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select(`
        id, order_number, user_id,
        items:order_items(
          id, product_id, variant_id, quantity, options
        )
      `)
      .eq('order_number', params.orderNumber)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !order) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const items = order.items as Array<{
      id: string;
      product_id: string;
      variant_id?: string;
      quantity: number;
      options?: Record<string, string>;
    }>;

    if (!items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: '재주문할 상품이 없습니다.' },
        { status: 400 }
      );
    }

    const results: Array<{
      productId: string;
      variantId?: string;
      status: 'added' | 'updated' | 'out_of_stock';
      cartItemId?: string;
    }> = [];

    for (const item of items) {
      // Check stock
      if (item.variant_id) {
        const { data: variant } = await supabase
          .from('product_variants')
          .select('stock_quantity')
          .eq('id', item.variant_id)
          .single();

        if (!variant || (variant.stock_quantity !== null && variant.stock_quantity <= 0)) {
          results.push({ productId: item.product_id, variantId: item.variant_id, status: 'out_of_stock' });
          continue;
        }
      } else {
        const { data: product } = await supabase
          .from('products')
          .select('stock_quantity, is_active')
          .eq('id', item.product_id)
          .single();

        if (!product || !product.is_active || (product.stock_quantity !== null && product.stock_quantity <= 0)) {
          results.push({ productId: item.product_id, status: 'out_of_stock' });
          continue;
        }
      }

      // Check if already in cart
      let cartQuery = supabase
        .from('cart_items')
        .select('id, quantity')
        .eq('user_id', user.id)
        .eq('product_id', item.product_id);

      if (item.variant_id) {
        cartQuery = cartQuery.eq('variant_id', item.variant_id);
      }

      const { data: existing } = await cartQuery.single();

      if (existing) {
        // Update quantity
        const { data: updated } = await supabase
          .from('cart_items')
          .update({
            quantity: existing.quantity + item.quantity,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select('id')
          .single();

        results.push({ productId: item.product_id, variantId: item.variant_id, status: 'updated', cartItemId: updated?.id });
      } else {
        // Add to cart
        const insertData: Record<string, unknown> = {
          user_id: user.id,
          product_id: item.product_id,
          quantity: item.quantity,
          options: item.options,
        };
        if (item.variant_id) {
          insertData.variant_id = item.variant_id;
        }

        const { data: cartItem } = await supabase
          .from('cart_items')
          .insert(insertData)
          .select('id')
          .single();

        results.push({ productId: item.product_id, variantId: item.variant_id, status: 'added', cartItemId: cartItem?.id });
      }
    }

    // Fetch updated cart summary
    const { data: cartItems } = await supabase
      .from('cart_items')
      .select(`
        *,
        product:products(id, name, price, thumbnail_url)
      `)
      .eq('user_id', user.id);

    const addedCount = results.filter((r) => r.status === 'added' || r.status === 'updated').length;
    const outOfStockCount = results.filter((r) => r.status === 'out_of_stock').length;

    return NextResponse.json({
      success: true,
      data: {
        results,
        summary: {
          addedCount,
          outOfStockCount,
          totalItems: cartItems?.length ?? 0,
        },
        cart: cartItems ?? [],
      },
    });
  } catch (error) {
    console.error('POST /orders/[orderNumber]/reorder error:', error);
    return NextResponse.json(
      { success: false, error: '재주문 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
