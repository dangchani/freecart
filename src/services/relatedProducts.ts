import { createClient } from '@/lib/supabase/client';

export interface RelatedProduct {
  id: string;
  name: string;
  slug: string;
  salePrice: number;
  regularPrice: number;
  imageUrl: string | null;
}

export interface ProductSet {
  id: string;
  name: string;
  description: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  products: RelatedProduct[];
  totalPrice: number;
  setPrice: number;
}

export interface ProductGift {
  id: string;
  name: string;
  description: string;
  minOrderAmount: number;
  giftProduct: RelatedProduct;
  startsAt: string | null;
  endsAt: string | null;
}

// 관련 상품 조회
export async function getRelatedProducts(productId: string): Promise<RelatedProduct[]> {
  const supabase = createClient();

  const { data } = await supabase
    .from('product_related')
    .select(`
      related_product_id,
      products!product_related_related_product_id_fkey(
        id, name, slug, sale_price, regular_price,
        product_images(url, is_primary)
      )
    `)
    .eq('product_id', productId)
    .order('sort_order', { ascending: true });

  return (data || [])
    .filter((d: any) => d.products)
    .map((d: any) => {
      const p = d.products;
      const primaryImage = p.product_images?.find((img: any) => img.is_primary) || p.product_images?.[0];
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        salePrice: p.sale_price,
        regularPrice: p.regular_price,
        imageUrl: primaryImage?.url || null,
      };
    });
}

// 세트 상품 조회
export async function getProductSets(productId: string): Promise<ProductSet[]> {
  const supabase = createClient();

  const { data } = await supabase
    .from('product_sets')
    .select(`
      id, name, description, discount_type, discount_value,
      product_set_items(
        products(
          id, name, slug, sale_price, regular_price,
          product_images(url, is_primary)
        )
      )
    `)
    .eq('main_product_id', productId)
    .eq('is_active', true);

  return (data || []).map((s: any) => {
    const products: RelatedProduct[] = (s.product_set_items || [])
      .filter((item: any) => item.products)
      .map((item: any) => {
        const p = item.products;
        const primaryImage = p.product_images?.find((img: any) => img.is_primary) || p.product_images?.[0];
        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          salePrice: p.sale_price,
          regularPrice: p.regular_price,
          imageUrl: primaryImage?.url || null,
        };
      });

    const totalPrice = products.reduce((sum, p) => sum + p.salePrice, 0);
    let setPrice = totalPrice;
    if (s.discount_type === 'percent') {
      setPrice = totalPrice - Math.floor(totalPrice * (s.discount_value / 100));
    } else {
      setPrice = totalPrice - s.discount_value;
    }

    return {
      id: s.id,
      name: s.name,
      description: s.description,
      discountType: s.discount_type,
      discountValue: s.discount_value,
      products,
      totalPrice,
      setPrice,
    };
  });
}

// 사은품 조회
export async function getProductGifts(productId: string): Promise<ProductGift[]> {
  const supabase = createClient();
  const now = new Date().toISOString();

  const { data } = await supabase
    .from('product_gifts')
    .select(`
      id, name, description, min_order_amount, starts_at, ends_at,
      gift_product:products!product_gifts_gift_product_id_fkey(
        id, name, slug, sale_price, regular_price,
        product_images(url, is_primary)
      )
    `)
    .eq('product_id', productId)
    .eq('is_active', true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`);

  return (data || [])
    .filter((g: any) => g.gift_product)
    .map((g: any) => {
      const p = g.gift_product;
      const primaryImage = p.product_images?.find((img: any) => img.is_primary) || p.product_images?.[0];
      return {
        id: g.id,
        name: g.name,
        description: g.description,
        minOrderAmount: g.min_order_amount || 0,
        giftProduct: {
          id: p.id,
          name: p.name,
          slug: p.slug,
          salePrice: p.sale_price,
          regularPrice: p.regular_price,
          imageUrl: primaryImage?.url || null,
        },
        startsAt: g.starts_at,
        endsAt: g.ends_at,
      };
    });
}

// 함께 자주 구매하는 상품 (구매 이력 기반)
export async function getFrequentlyBoughtTogether(productId: string): Promise<RelatedProduct[]> {
  const supabase = createClient();

  // 해당 상품이 포함된 주문에서 함께 구매된 다른 상품들 조회
  const { data: orderItems } = await supabase
    .from('order_items')
    .select('order_id')
    .eq('product_id', productId);

  if (!orderItems || orderItems.length === 0) return [];

  const orderIds = orderItems.map((oi) => oi.order_id);

  const { data: relatedItems } = await supabase
    .from('order_items')
    .select(`
      product_id,
      products(
        id, name, slug, sale_price, regular_price,
        product_images(url, is_primary)
      )
    `)
    .in('order_id', orderIds)
    .neq('product_id', productId);

  if (!relatedItems) return [];

  // 빈도수 계산
  const productCounts = new Map<string, { product: any; count: number }>();
  relatedItems.forEach((item: any) => {
    if (!item.products) return;
    const existing = productCounts.get(item.product_id);
    if (existing) {
      existing.count++;
    } else {
      productCounts.set(item.product_id, { product: item.products, count: 1 });
    }
  });

  // 상위 5개 반환
  return Array.from(productCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(({ product: p }) => {
      const primaryImage = p.product_images?.find((img: any) => img.is_primary) || p.product_images?.[0];
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        salePrice: p.sale_price,
        regularPrice: p.regular_price,
        imageUrl: primaryImage?.url || null,
      };
    });
}
