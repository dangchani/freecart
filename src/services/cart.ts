import { createClient } from '@/lib/supabase/client';
import type { CartItem } from '@/types';

async function getOrCreateCart(supabase: any, userId: string): Promise<string> {
  // .single() 대신 .limit(1) 사용: 여러 cart가 존재해도 에러 없이 첫 번째 반환
  const { data: carts } = await supabase
    .from('carts')
    .select('id')
    .eq('user_id', userId)
    .limit(1);

  if (carts && carts.length > 0) return carts[0].id;

  const { data: newCart, error } = await supabase
    .from('carts')
    .insert({ user_id: userId })
    .select('id')
    .single();

  if (error) throw error;
  return newCart.id;
}

export async function getCart(userId: string): Promise<CartItem[]> {
  const supabase = createClient();

  const cartId = await getOrCreateCart(supabase, userId);

  const { data, error } = await supabase
    .from('cart_items')
    .select(`
      *,
      product:products(*, product_images(*))
    `)
    .eq('cart_id', cartId);

  if (error) throw error;

  return (
    data?.map((item: any) => ({
      id: item.id,
      cartId: item.cart_id,
      productId: item.product_id,
      variantId: item.variant_id,
      quantity: item.quantity,
      selected: item.selected,
      product: item.product
        ? {
            id: item.product.id,
            categoryId: item.product.category_id,
            name: item.product.name,
            slug: item.product.slug,
            description: item.product.description,
            regularPrice: item.product.regular_price,
            salePrice: item.product.sale_price,
            stockQuantity: item.product.stock_quantity,
            status: item.product.status,
            isFeatured: item.product.is_featured,
            isNew: item.product.is_new,
            isBest: item.product.is_best,
            isSale: item.product.is_sale,
            hasOptions: item.product.has_options,
            images: item.product.product_images?.map((img: any) => ({
              id: img.id,
              url: img.url,
              alt: img.alt,
              isPrimary: img.is_primary,
              sortOrder: img.sort_order,
            })),
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
  variantId?: string
) {
  const supabase = createClient();
  const cartId = await getOrCreateCart(supabase, userId);

  // 이미 장바구니에 있는지 확인
  let query = supabase
    .from('cart_items')
    .select('*')
    .eq('cart_id', cartId)
    .eq('product_id', productId);

  if (variantId) {
    query = query.eq('variant_id', variantId);
  } else {
    query = query.is('variant_id', null);
  }

  const { data: existing } = await query.single();

  if (existing) {
    const { error } = await supabase
      .from('cart_items')
      .update({ quantity: existing.quantity + quantity })
      .eq('id', existing.id);

    if (error) throw error;
  } else {
    const { error } = await supabase.from('cart_items').insert({
      cart_id: cartId,
      product_id: productId,
      variant_id: variantId || null,
      quantity,
    });

    if (error) throw error;
  }
}

export async function updateCartItem(itemId: string, quantity: number) {
  const supabase = createClient();

  const { error } = await supabase
    .from('cart_items')
    .update({ quantity })
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

  const { data: cart } = await supabase
    .from('carts')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (!cart) return;

  const { error } = await supabase.from('cart_items').delete().eq('cart_id', cart.id);

  if (error) throw error;
}
