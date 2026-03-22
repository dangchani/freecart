import { createClient } from '@/lib/supabase/client';
import type { CartItem } from '@/types';

export async function getCart(userId: string): Promise<CartItem[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('cart_items')
    .select(
      `
      *,
      product:products(*)
    `
    )
    .eq('user_id', userId);

  if (error) throw error;

  return (
    data?.map((item) => ({
      id: item.id,
      userId: item.user_id,
      productId: item.product_id,
      quantity: item.quantity,
      options: item.options,
      product: item.product
        ? {
            id: item.product.id,
            categoryId: item.product.category_id,
            name: item.product.name,
            slug: item.product.slug,
            description: item.product.description,
            price: parseFloat(item.product.price),
            comparePrice: item.product.compare_price
              ? parseFloat(item.product.compare_price)
              : undefined,
            cost: item.product.cost ? parseFloat(item.product.cost) : undefined,
            stock: item.product.stock,
            sku: item.product.sku,
            barcode: item.product.barcode,
            images: item.product.images || [],
            thumbnail: item.product.thumbnail,
            isActive: item.product.is_active,
            isFeatured: item.product.is_featured,
            options: item.product.options,
            variants: item.product.variants,
            metadata: item.product.metadata,
            createdAt: item.product.created_at,
            updatedAt: item.product.updated_at,
          }
        : undefined,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    })) || []
  );
}

export async function addToCart(
  userId: string,
  productId: string,
  quantity: number,
  options?: Record<string, string>
) {
  const supabase = createClient();

  // 이미 장바구니에 있는지 확인
  const { data: existing } = await supabase
    .from('cart_items')
    .select('*')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .single();

  if (existing) {
    // 수량 업데이트
    const { error } = await supabase
      .from('cart_items')
      .update({
        quantity: existing.quantity + quantity,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (error) throw error;
  } else {
    // 새로 추가
    const { error } = await supabase.from('cart_items').insert({
      user_id: userId,
      product_id: productId,
      quantity,
      options,
    });

    if (error) throw error;
  }
}

export async function updateCartItem(itemId: string, quantity: number) {
  const supabase = createClient();

  const { error } = await supabase
    .from('cart_items')
    .update({
      quantity,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId);

  if (error) throw error;
}

export async function removeFromCart(itemId: string) {
  const supabase = createClient();

  const { error } = await supabase.from('cart_items').delete().eq('id', itemId);

  if (error) throw error;
}

export async function clearCart(userId: string) {
  const supabase = createClient();

  const { error } = await supabase.from('cart_items').delete().eq('user_id', userId);

  if (error) throw error;
}
