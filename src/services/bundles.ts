import { createClient } from '@/lib/supabase/client';

// =============================================================================
// Types
// =============================================================================

export interface BundleItem {
  id: string;
  bundleProductId: string;
  productId: string;
  productName: string;
  productImageUrl: string | null;
  variantId: string | null;
  variantLabel: string | null;
  quantity: number;
  sortOrder: number;
}

/** 관리자 UI 로컬 상태용 draft */
export interface BundleItemDraft {
  localId: string;
  dbId: string | null;
  productId: string;
  productName: string;
  productImageUrl: string | null;
  variantId: string | null;
  variantLabel: string | null;
  quantity: number;
}

// =============================================================================
// Read
// =============================================================================

/** 묶음상품 구성 아이템 조회 */
export async function getBundleItems(bundleProductId: string): Promise<BundleItem[]> {
  const supabase = createClient();

  const { data } = await supabase
    .from('bundle_items')
    .select(`
      id, bundle_product_id, product_id, variant_id, quantity, sort_order,
      product:products!bundle_items_product_id_fkey(
        id, name,
        product_images(url, is_primary)
      ),
      variant:product_variants!bundle_items_variant_id_fkey(
        id, option_values
      )
    `)
    .eq('bundle_product_id', bundleProductId)
    .order('sort_order', { ascending: true });

  return (data || []).map((row: any) => {
    const p = row.product;
    const primaryImg =
      (p?.product_images || []).find((img: any) => img.is_primary) ||
      (p?.product_images || [])[0];

    // variant label: option_values 배열에서 텍스트 조합 (서버에서 join 없이 ID만 오므로 간단히 처리)
    const variantLabel = row.variant ? row.variant_id : null;

    return {
      id: row.id,
      bundleProductId: row.bundle_product_id,
      productId: row.product_id,
      productName: p?.name ?? '',
      productImageUrl: primaryImg?.url ?? null,
      variantId: row.variant_id ?? null,
      variantLabel,
      quantity: row.quantity,
      sortOrder: row.sort_order,
    };
  });
}

// =============================================================================
// Stock Calculation
// =============================================================================

/**
 * 묶음상품 유효 재고 계산
 * MIN(floor(component.stock / bundleItem.qty))
 * 구성 상품 중 하나라도 재고 0이면 0 반환
 */
export async function getEffectiveBundleStock(bundleProductId: string): Promise<number> {
  const supabase = createClient();

  const { data } = await supabase
    .from('bundle_items')
    .select(`
      quantity,
      product:products!bundle_items_product_id_fkey(stock_quantity, has_options),
      product_variants(stock_quantity, is_active)
    `)
    .eq('bundle_product_id', bundleProductId);

  if (!data || data.length === 0) return 0;

  let effectiveStock = Infinity;

  for (const item of data as any[]) {
    const p = item.product;
    if (!p) return 0;

    const componentStock = p.has_options
      ? ((item.product_variants || []) as any[])
          .filter((v: any) => v.is_active)
          .reduce((sum: number, v: any) => sum + (v.stock_quantity || 0), 0)
      : (p.stock_quantity || 0);

    const contribution = Math.floor(componentStock / item.quantity);
    if (contribution < effectiveStock) effectiveStock = contribution;
  }

  return effectiveStock === Infinity ? 0 : effectiveStock;
}

// =============================================================================
// Write (관리자)
// =============================================================================

/** 묶음상품 구성 아이템 전체 저장 (기존 삭제 후 재삽입) */
export async function saveBundleItems(
  bundleProductId: string,
  drafts: BundleItemDraft[]
): Promise<void> {
  const supabase = createClient();

  await supabase
    .from('bundle_items')
    .delete()
    .eq('bundle_product_id', bundleProductId);

  if (drafts.length === 0) return;

  const inserts = drafts.map((d, i) => ({
    bundle_product_id: bundleProductId,
    product_id: d.productId,
    variant_id: d.variantId || null,
    quantity: d.quantity,
    sort_order: i,
  }));

  const { error } = await supabase.from('bundle_items').insert(inserts);
  if (error) throw error;
}
