import { createClient } from '@/lib/supabase/client';
import type { Product, PaginatedResponse } from '@/types';

function mapProduct(p: any): Product {
  return {
    id: p.id,
    categoryId: p.category_id,
    brandId: p.brand_id,
    name: p.name,
    slug: p.slug,
    summary: p.summary,
    description: p.description,
    regularPrice: p.regular_price,
    salePrice: p.sale_price,
    costPrice: p.cost_price,
    stockQuantity: p.stock_quantity,
    stockAlertQuantity: p.stock_alert_quantity,
    minPurchaseQuantity: p.min_purchase_quantity,
    maxPurchaseQuantity: p.max_purchase_quantity,
    status: p.status,
    isFeatured: p.is_featured,
    isNew: p.is_new,
    isBest: p.is_best,
    isSale: p.is_sale,
    viewCount: p.view_count,
    salesCount: p.sales_count,
    reviewCount: p.review_count,
    reviewAvg: p.review_avg ? parseFloat(p.review_avg) : 0,
    hasOptions: p.has_options,
    shippingType: p.shipping_type,
    shippingFee: p.shipping_fee,
    tags: p.tags,
    videoUrl: p.video_url,
    sku: p.sku,
    images: p.product_images?.map((img: any) => ({
      id: img.id,
      url: img.url,
      alt: img.alt,
      isPrimary: img.is_primary,
      sortOrder: img.sort_order,
    })),
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export async function getProducts(params?: {
  page?: number;
  limit?: number;
  categoryId?: string;
  search?: string;
}): Promise<PaginatedResponse<Product>> {
  const supabase = createClient();
  const page = params?.page || 1;
  const limit = params?.limit || 20;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('products')
    .select('*, product_images(*)', { count: 'exact' })
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .range(from, to);

  if (params?.categoryId) {
    query = query.eq('category_id', params.categoryId);
  }

  if (params?.search) {
    query = query.ilike('name', `%${params.search}%`);
  }

  const { data, error, count } = await query;

  if (error) throw error;

  return {
    success: true,
    data: data?.map(mapProduct),
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  };
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('products')
    .select('*, product_images(*)')
    .eq('slug', slug)
    .eq('status', 'active')
    .single();

  if (error) throw error;
  if (!data) return null;

  return mapProduct(data);
}

export async function getFeaturedProducts(limit = 10): Promise<Product[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('products')
    .select('*, product_images(*)')
    .eq('status', 'active')
    .eq('is_featured', true)
    .limit(limit);

  if (error) throw error;

  return data?.map(mapProduct) || [];
}
