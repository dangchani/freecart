import { createClient } from '@/lib/supabase/client';

// =============================================================================
// Types
// =============================================================================

export type GiftMode = 'auto' | 'select';

export interface GiftSetItem {
  id: string;
  giftProductId: string;
  giftProductName: string;
  giftProductImageUrl: string | null;
  giftProductSalePrice: number;
  maxPerItem: number | null;
  sortOrder: number;
}

export interface GiftSet {
  id: string;
  productId: string;
  name: string;
  giftMode: GiftMode;
  triggerQuantity: number;
  // select 모드 전용 (auto 모드에서는 무시)
  maxGiftQuantity: number;
  maxDistinctItems: number | null;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  sortOrder: number;
  items: GiftSetItem[];
}

// 관리자 UI 로컬 상태용 (저장 전 draft)
export interface GiftSetDraft {
  localId: string;          // 신규 세트 임시 식별자 (DB id 없는 상태)
  dbId: string | null;      // 저장 후 할당되는 실제 UUID
  name: string;
  giftMode: GiftMode;
  triggerQuantity: number;
  maxGiftQuantity: number;
  maxDistinctItems: number | null;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
  items: GiftSetItemDraft[];
}

export interface GiftSetItemDraft {
  localId: string;
  dbId: string | null;
  giftProductId: string;
  giftProductName: string;
  giftProductImageUrl: string | null;
  giftProductSalePrice: number;
  maxPerItem: number | null;
  sortOrder: number;
}

// =============================================================================
// Read
// =============================================================================

/** 특정 상품의 활성 사은품 세트 목록 조회 (사용자 화면용) */
export async function getGiftSets(productId: string): Promise<GiftSet[]> {
  const supabase = createClient();
  const now = new Date().toISOString();

  const { data } = await supabase
    .from('product_gift_sets')
    .select(`
      id, product_id, name, gift_mode,
      trigger_quantity, max_gift_quantity, max_distinct_items,
      is_active, starts_at, ends_at, sort_order,
      product_gift_set_items(
        id, gift_product_id, max_per_item, sort_order,
        gift_product:products!product_gift_set_items_gift_product_id_fkey(
          id, name, sale_price,
          product_images(url, is_primary)
        )
      )
    `)
    .eq('product_id', productId)
    .eq('is_active', true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order('sort_order', { ascending: true });

  return (data || []).map(mapGiftSet);
}

/** 관리자용 전체 세트 조회 (비활성 포함) */
export async function getGiftSetsAdmin(productId: string): Promise<GiftSet[]> {
  const supabase = createClient();

  const { data } = await supabase
    .from('product_gift_sets')
    .select(`
      id, product_id, name, gift_mode,
      trigger_quantity, max_gift_quantity, max_distinct_items,
      is_active, starts_at, ends_at, sort_order,
      product_gift_set_items(
        id, gift_product_id, max_per_item, sort_order,
        gift_product:products!product_gift_set_items_gift_product_id_fkey(
          id, name, sale_price,
          product_images(url, is_primary)
        )
      )
    `)
    .eq('product_id', productId)
    .order('sort_order', { ascending: true });

  return (data || []).map(mapGiftSet);
}

function mapGiftSet(s: any): GiftSet {
  const items: GiftSetItem[] = ((s.product_gift_set_items as any[]) || [])
    .sort((a: any, b: any) => a.sort_order - b.sort_order)
    .map((item: any) => {
      const p = item.gift_product;
      const primaryImg =
        (p?.product_images || []).find((img: any) => img.is_primary) ||
        (p?.product_images || [])[0];
      return {
        id: item.id,
        giftProductId: item.gift_product_id,
        giftProductName: p?.name ?? '',
        giftProductImageUrl: primaryImg?.url ?? null,
        giftProductSalePrice: p?.sale_price ?? 0,
        maxPerItem: item.max_per_item ?? null,
        sortOrder: item.sort_order,
      };
    });

  return {
    id: s.id,
    productId: s.product_id,
    name: s.name,
    giftMode: s.gift_mode as GiftMode,
    triggerQuantity: s.trigger_quantity,
    maxGiftQuantity: s.max_gift_quantity,
    maxDistinctItems: s.max_distinct_items ?? null,
    isActive: s.is_active,
    startsAt: s.starts_at ?? null,
    endsAt: s.ends_at ?? null,
    sortOrder: s.sort_order,
    items,
  };
}

// =============================================================================
// Write (관리자)
// =============================================================================

/** 사은품 세트 전체 저장 (기존 세트 삭제 후 재삽입) */
export async function saveGiftSets(
  productId: string,
  drafts: GiftSetDraft[]
): Promise<void> {
  const supabase = createClient();

  // 기존 세트 전체 삭제 (CASCADE로 items도 삭제됨)
  await supabase
    .from('product_gift_sets')
    .delete()
    .eq('product_id', productId);

  if (drafts.length === 0) return;

  for (let i = 0; i < drafts.length; i++) {
    const draft = drafts[i];

    const { data: setData, error: setError } = await supabase
      .from('product_gift_sets')
      .insert({
        product_id: productId,
        name: draft.name,
        gift_mode: draft.giftMode,
        trigger_quantity: draft.triggerQuantity,
        max_gift_quantity: draft.maxGiftQuantity,
        max_distinct_items:
          draft.giftMode === 'select' ? draft.maxDistinctItems : null,
        is_active: draft.isActive,
        starts_at: draft.startsAt || null,
        ends_at: draft.endsAt || null,
        sort_order: i,
      })
      .select('id')
      .single();

    if (setError) throw setError;

    if (draft.items.length > 0) {
      const itemInserts = draft.items.map((item, j) => ({
        gift_set_id: setData.id,
        gift_product_id: item.giftProductId,
        max_per_item:
          draft.giftMode === 'select' ? item.maxPerItem : null,
        sort_order: j,
      }));

      const { error: itemError } = await supabase
        .from('product_gift_set_items')
        .insert(itemInserts);

      if (itemError) throw itemError;
    }
  }
}

// =============================================================================
// Select 모드 검증 유틸 (사용자 UI에서 사용)
// =============================================================================

export interface GiftSelection {
  giftProductId: string;
  quantity: number;
}

/** + 버튼 disabled 여부 판단 */
export function isGiftItemAddDisabled(
  giftSet: GiftSet,
  selections: GiftSelection[],
  targetProductId: string
): boolean {
  const totalSelected = selections.reduce((s, g) => s + g.quantity, 0);
  const targetQty =
    selections.find((g) => g.giftProductId === targetProductId)?.quantity ?? 0;

  // A. 총 수량 상한 도달
  if (totalSelected >= giftSet.maxGiftQuantity) return true;

  // B. 품목 종류 상한 도달 (새 품목 추가 불가 — 기존 선택 품목은 허용)
  if (giftSet.maxDistinctItems !== null && targetQty === 0) {
    const distinctCount = selections.filter((g) => g.quantity > 0).length;
    if (distinctCount >= giftSet.maxDistinctItems) return true;
  }

  // C. 품목 개별 상한 도달
  const item = giftSet.items.find((i) => i.giftProductId === targetProductId);
  if (item?.maxPerItem !== null && item?.maxPerItem !== undefined) {
    if (targetQty >= item.maxPerItem) return true;
  }

  return false;
}
