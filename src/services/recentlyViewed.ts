const STORAGE_KEY = 'recently_viewed_products';
const MAX_ITEMS = 20;

export interface RecentlyViewedItem {
  productId: string;
  viewedAt: number;
}

// 최근 본 상품 목록 가져오기
export function getRecentlyViewed(): RecentlyViewedItem[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

// 최근 본 상품 추가
export function addToRecentlyViewed(productId: string): void {
  if (typeof window === 'undefined') return;

  try {
    const items = getRecentlyViewed();

    // 이미 있으면 제거
    const filtered = items.filter((item) => item.productId !== productId);

    // 맨 앞에 추가
    filtered.unshift({
      productId,
      viewedAt: Date.now(),
    });

    // 최대 개수 유지
    const trimmed = filtered.slice(0, MAX_ITEMS);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error('Failed to save recently viewed:', e);
  }
}

// 최근 본 상품 삭제
export function removeFromRecentlyViewed(productId: string): void {
  if (typeof window === 'undefined') return;

  try {
    const items = getRecentlyViewed();
    const filtered = items.filter((item) => item.productId !== productId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('Failed to remove from recently viewed:', e);
  }
}

// 최근 본 상품 전체 삭제
export function clearRecentlyViewed(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

// 최근 본 상품 ID 목록만 가져오기
export function getRecentlyViewedIds(): string[] {
  return getRecentlyViewed().map((item) => item.productId);
}
