import { createClient } from '@/lib/supabase/client';
import type { Product, PaginatedResponse } from '@/types';

// 옵션 관련 타입
export interface ProductOption {
  id: string;
  name: string;
  isRequired: boolean;
  sortOrder: number;
  values: ProductOptionValue[];
}

export interface ProductOptionValue {
  id: string;
  value: string;
  additionalPrice: number;
  sortOrder: number;
}

export interface ProductVariant {
  id: string;
  sku: string | null;
  optionValues: { optionId: string; valueId: string; optionName: string; valueName: string }[];
  additionalPrice: number;
  stockQuantity: number;
  imageUrl: string | null;
  isActive: boolean;
  minPurchaseQuantity: number | null;
  maxPurchaseQuantity: number | null;
  dailyPurchaseLimit: number | null;
}

/** 선택 옵션에서 "선택 안 함"을 나타내는 sentinel valueId */
export const OPTION_NONE_VALUE_ID = '__none__';

function resolveActiveBadge(p: any): { activeBadgeText: string | null; activeBadgeColor: string | null } {
  const now = new Date().toISOString();
  const active = ((p.product_gift_sets as any[]) || []).find((gs) =>
    gs.is_active &&
    gs.badge_text &&
    (!gs.starts_at || gs.starts_at <= now) &&
    (!gs.ends_at   || gs.ends_at   >= now)
  );
  return {
    activeBadgeText:  active?.badge_text  ?? null,
    activeBadgeColor: active?.badge_color ?? null,
  };
}

function mapProduct(p: any): Product {
  const { activeBadgeText, activeBadgeColor } = resolveActiveBadge(p);
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
    activeBadgeText,
    activeBadgeColor,
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
    .select('*, product_images(*), product_gift_sets(badge_text, badge_color, is_active, starts_at, ends_at)', { count: 'exact' })
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
    .select('*, product_images(*), product_gift_sets(badge_text, badge_color, is_active, starts_at, ends_at)')
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
    .select('*, product_images(*), product_gift_sets(badge_text, badge_color, is_active, starts_at, ends_at)')
    .eq('status', 'active')
    .eq('is_featured', true)
    .limit(limit);

  if (error) throw error;

  return data?.map(mapProduct) || [];
}

/**
 * 상품 옵션 목록 조회
 */
export async function getProductOptions(productId: string): Promise<ProductOption[]> {
  const supabase = createClient();

  const { data: options, error: optionsError } = await supabase
    .from('product_options')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order');

  if (optionsError) throw optionsError;
  if (!options || options.length === 0) return [];

  const optionIds = options.map((o) => o.id);
  const { data: values, error: valuesError } = await supabase
    .from('product_option_values')
    .select('*')
    .in('option_id', optionIds)
    .order('sort_order');

  if (valuesError) throw valuesError;

  return options.map((opt) => {
    const optValues = (values || [])
      .filter((v) => v.option_id === opt.id)
      .map((v) => ({
        id: v.id,
        value: v.value,
        additionalPrice: v.additional_price,
        sortOrder: v.sort_order,
      }));

    // 선택 옵션이면 "선택 안 함" 항목을 맨 앞에 추가
    if (!opt.is_required) {
      optValues.unshift({
        id: OPTION_NONE_VALUE_ID,
        value: '선택 안 함',
        additionalPrice: 0,
        sortOrder: -1,
      });
    }

    return {
      id: opt.id,
      name: opt.name,
      isRequired: opt.is_required,
      sortOrder: opt.sort_order,
      values: optValues,
    };
  });
}

/**
 * 상품 변형(variant) 목록 조회
 */
export async function getProductVariants(productId: string): Promise<ProductVariant[]> {
  const supabase = createClient();

  // 먼저 옵션과 옵션값 정보 조회
  const options = await getProductOptions(productId);
  const optionMap = new Map<string, { name: string; values: Map<string, string> }>();

  options.forEach((opt) => {
    const valueMap = new Map<string, string>();
    opt.values.forEach((v) => valueMap.set(v.id, v.value));
    optionMap.set(opt.id, { name: opt.name, values: valueMap });
  });

  const { data: variants, error } = await supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', productId)
    .eq('is_active', true);

  if (error) throw error;
  if (!variants) return [];

  return variants.map((v) => {
    // option_values는 [{ optionId, valueId }, ...] 형태의 JSONB
    const rawOptionValues = v.option_values as { optionId: string; valueId: string }[] || [];

    const optionValues = rawOptionValues.map((ov) => {
      const optInfo = optionMap.get(ov.optionId);
      return {
        optionId: ov.optionId,
        valueId: ov.valueId,
        optionName: optInfo?.name || '',
        valueName: optInfo?.values.get(ov.valueId) || '',
      };
    });

    return {
      id: v.id,
      sku: v.sku,
      optionValues,
      additionalPrice: v.additional_price,
      stockQuantity: v.stock_quantity,
      imageUrl: v.image_url,
      isActive: v.is_active,
      minPurchaseQuantity: v.min_purchase_quantity ?? null,
      maxPurchaseQuantity: v.max_purchase_quantity ?? null,
      dailyPurchaseLimit: v.daily_purchase_limit ?? null,
    };
  });
}

/**
 * 선택된 옵션값으로 variant 찾기
 */
export function findVariantByOptions(
  variants: ProductVariant[],
  selectedOptions: Record<string, string> // { optionId: valueId }
): ProductVariant | null {
  // "선택 안 함"(__none__)은 variant 매칭에서 해당 옵션을 포함하지 않음
  const effectiveSelections = Object.entries(selectedOptions).filter(
    ([, valueId]) => valueId !== OPTION_NONE_VALUE_ID
  );

  return variants.find((variant) => {
    if (variant.optionValues.length !== effectiveSelections.length) return false;
    return effectiveSelections.every(([optionId, valueId]) =>
      variant.optionValues.some((ov) => ov.optionId === optionId && ov.valueId === valueId)
    );
  }) || null;
}
