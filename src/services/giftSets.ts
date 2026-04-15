import { createClient } from '@/lib/supabase/client';

// =============================================================================
// Types
// =============================================================================

export type GiftType = 'select' | 'auto_same' | 'auto_specific';

export interface GiftTier {
  id: string;
  minQuantity: number;
  freeCount: number;
  sortOrder: number;
}

export interface GiftSetItem {
  id: string;
  giftProductId: string;
  giftProductName: string;
  giftProductImageUrl: string | null;
  giftProductSalePrice: number;
  giftProductStock: number;   // 실효 재고 (옵션상품이면 활성 variant 합계)
  sortOrder: number;
}

export interface GiftSet {
  id: string;
  productId: string;
  name: string;
  giftType: GiftType;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  sortOrder: number;
  badgeText: string | null;
  badgeColor: string;
  hideWhenSoldout: boolean;   // 모든 사은품 품절 시 세트 자동 숨김
  tiers: GiftTier[];
  items: GiftSetItem[];
}

// 관리자 UI 로컬 상태용 (저장 전 draft)
export interface GiftSetDraft {
  localId: string;
  dbId: string | null;
  name: string;
  giftType: GiftType;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
  badgeText: string;
  badgeColor: string;
  hideWhenSoldout: boolean;
  tiers: GiftTierDraft[];
  items: GiftSetItemDraft[];
}

export interface GiftTierDraft {
  localId: string;
  dbId: string | null;
  minQuantity: number;
  freeCount: number;
}

export interface GiftSetItemDraft {
  localId: string;
  dbId: string | null;
  giftProductId: string;
  giftProductName: string;
  giftProductImageUrl: string | null;
  giftProductSalePrice: number;
}

/** 자동 증정 계산 결과 */
export interface AutoGiftResult {
  giftSetId: string;
  giftSetName: string;
  giftType: 'auto_same' | 'auto_specific';
  giftProductId: string;
  giftProductName: string;
  giftProductImageUrl: string | null;
  quantity: number;
}

// =============================================================================
// Read
// =============================================================================

const GIFT_SET_QUERY = `
  id, product_id, name, gift_type, is_active, starts_at, ends_at, sort_order,
  badge_text, badge_color, hide_when_soldout,
  product_gift_tiers(id, min_quantity, free_count, sort_order),
  product_gift_set_items(
    id, gift_product_id, sort_order,
    gift_product:products!product_gift_set_items_gift_product_id_fkey(
      id, name, sale_price, stock_quantity, has_options,
      product_images(url, is_primary),
      product_variants(stock_quantity, is_active)
    )
  )
`;

/** 특정 상품의 활성 사은품 세트 목록 조회 (사용자 화면용) */
export async function getGiftSets(productId: string): Promise<GiftSet[]> {
  const supabase = createClient();
  const now = new Date().toISOString();

  const { data } = await supabase
    .from('product_gift_sets')
    .select(GIFT_SET_QUERY)
    .eq('product_id', productId)
    .eq('is_active', true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order('sort_order', { ascending: true });

  return (data || [])
    .map(mapGiftSet)
    .filter((set) => {
      // 모든 사은품 품절이고 hide_when_soldout = true이면 해당 세트 제외
      if (!set.hideWhenSoldout) return true;
      if (set.items.length === 0) return true;
      const allSoldOut = set.items.every((item) => item.giftProductStock === 0);
      return !allSoldOut;
    });
}

/** 관리자용 전체 세트 조회 (비활성 포함) */
export async function getGiftSetsAdmin(productId: string): Promise<GiftSet[]> {
  const supabase = createClient();

  const { data } = await supabase
    .from('product_gift_sets')
    .select(GIFT_SET_QUERY)
    .eq('product_id', productId)
    .order('sort_order', { ascending: true });

  return (data || []).map(mapGiftSet);
}

function mapGiftSet(s: any): GiftSet {
  const tiers: GiftTier[] = ((s.product_gift_tiers as any[]) || [])
    .sort((a: any, b: any) => a.sort_order - b.sort_order)
    .map((t: any) => ({
      id: t.id,
      minQuantity: t.min_quantity,
      freeCount: t.free_count,
      sortOrder: t.sort_order,
    }));

  const items: GiftSetItem[] = ((s.product_gift_set_items as any[]) || [])
    .sort((a: any, b: any) => a.sort_order - b.sort_order)
    .map((item: any) => {
      const p = item.gift_product;
      const primaryImg =
        (p?.product_images || []).find((img: any) => img.is_primary) ||
        (p?.product_images || [])[0];

      // 실효 재고 계산: 옵션상품이면 활성 variant 재고 합산, 아니면 stock_quantity
      const giftProductStock: number = p?.has_options
        ? ((p.product_variants || []) as any[])
            .filter((v: any) => v.is_active)
            .reduce((sum: number, v: any) => sum + (v.stock_quantity || 0), 0)
        : (p?.stock_quantity ?? 0);

      return {
        id: item.id,
        giftProductId: item.gift_product_id,
        giftProductName: p?.name ?? '',
        giftProductImageUrl: primaryImg?.url ?? null,
        giftProductSalePrice: p?.sale_price ?? 0,
        giftProductStock,
        sortOrder: item.sort_order,
      };
    });

  return {
    id: s.id,
    productId: s.product_id,
    name: s.name,
    giftType: (s.gift_type as GiftType) ?? 'select',
    isActive: s.is_active,
    startsAt: s.starts_at ?? null,
    endsAt: s.ends_at ?? null,
    sortOrder: s.sort_order,
    badgeText: s.badge_text ?? null,
    badgeColor: s.badge_color ?? '#ef4444',
    hideWhenSoldout: s.hide_when_soldout ?? false,
    tiers,
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

  // 기존 세트 전체 삭제 (CASCADE로 tiers, items도 삭제됨)
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
        gift_type: draft.giftType,
        is_active: draft.isActive,
        starts_at: draft.startsAt || null,
        ends_at: draft.endsAt || null,
        sort_order: i,
        badge_text: draft.badgeText.trim() || null,
        badge_color: draft.badgeColor || '#ef4444',
        hide_when_soldout: draft.hideWhenSoldout ?? false,
      })
      .select('id')
      .single();

    if (setError) throw setError;

    if (draft.tiers.length > 0) {
      const tierInserts = draft.tiers.map((tier, j) => ({
        gift_set_id: setData.id,
        min_quantity: tier.minQuantity,
        free_count: tier.freeCount,
        sort_order: j,
      }));
      const { error: tierError } = await supabase
        .from('product_gift_tiers')
        .insert(tierInserts);
      if (tierError) throw tierError;
    }

    // auto_same은 items 저장 불필요
    if (draft.giftType !== 'auto_same' && draft.items.length > 0) {
      const itemInserts = draft.items.map((item, j) => ({
        gift_set_id: setData.id,
        gift_product_id: item.giftProductId,
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
// 사은품 개수 계산 유틸
// =============================================================================

/**
 * 구매수량에 해당하는 tier의 free_count 반환
 * - min_quantity <= purchaseQty 를 만족하는 tier 중 min_quantity가 가장 큰 것 적용
 * - 해당 tier 없으면 0 반환
 */
export function getApplicableFreeCount(
  tiers: GiftTier[],
  purchaseQty: number
): number {
  const applicable = tiers
    .filter((t) => t.minQuantity <= purchaseQty)
    .sort((a, b) => b.minQuantity - a.minQuantity);
  return applicable[0]?.freeCount ?? 0;
}

/**
 * 자동 증정 타입(auto_same / auto_specific) 세트에서
 * 현재 구매수량에 해당하는 증정품 목록 반환
 *
 * @param giftSets  - 해당 상품의 활성 gift set 목록
 * @param purchaseProductId - 구매 상품 ID (auto_same용)
 * @param purchaseQty       - 구매 수량
 */
export function resolveAutoGifts(
  giftSets: GiftSet[],
  purchaseProductId: string,
  purchaseQty: number
): AutoGiftResult[] {
  const results: AutoGiftResult[] = [];

  for (const set of giftSets) {
    if (set.giftType !== 'auto_same' && set.giftType !== 'auto_specific') continue;

    const freeCount = getApplicableFreeCount(set.tiers, purchaseQty);
    if (freeCount === 0) continue;

    if (set.giftType === 'auto_same') {
      results.push({
        giftSetId: set.id,
        giftSetName: set.name,
        giftType: 'auto_same',
        giftProductId: purchaseProductId,
        giftProductName: '구매 상품 동일',
        giftProductImageUrl: null,
        quantity: freeCount,
      });
    } else {
      // auto_specific: items[0] 사용
      const item = set.items[0];
      if (!item) continue;
      results.push({
        giftSetId: set.id,
        giftSetName: set.name,
        giftType: 'auto_specific',
        giftProductId: item.giftProductId,
        giftProductName: item.giftProductName,
        giftProductImageUrl: item.giftProductImageUrl,
        quantity: freeCount,
      });
    }
  }

  return results;
}

// =============================================================================
// 사용자 선택 상태 (select 타입용)
// =============================================================================

export interface GiftSelection {
  giftProductId: string;
  quantity: number;
}

/** + 버튼 disabled 여부 판단 */
export function isGiftAddDisabled(
  freeCount: number,
  selections: GiftSelection[]
): boolean {
  const total = selections.reduce((s, g) => s + g.quantity, 0);
  return total >= freeCount;
}
