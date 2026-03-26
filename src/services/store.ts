/**
 * Freecart Store API Service
 * freecart-web의 테마/스킨 스토어 API를 호출합니다.
 */

import { getSetting } from '@/services/settings';

let _storeApiUrl: string | null = null;

async function getStoreApiUrl(): Promise<string> {
  if (_storeApiUrl) return _storeApiUrl;
  _storeApiUrl = await getSetting('store_api_url', 'https://freecart.kr');
  return _storeApiUrl;
}

interface Theme {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  isPremium: boolean;
  thumbnail?: string;
  previewUrl?: string;
  version?: string;
  downloadCount?: number;
  reviewCount?: number;
  reviewAvg?: number;
  createdAt: string;
}

interface Skin {
  id: string;
  name: string;
  slug: string;
  description?: string;
  type: string;
  price: number;
  thumbnail_url?: string;
  preview_url?: string;
  version?: string;
  download_count?: number;
  purchase_count?: number;
  review_count?: number;
  review_avg?: number;
  is_featured?: boolean;
  created_at: string;
}

interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string;
}

interface StoreResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ============================================================================
// 테마 스토어 API
// ============================================================================

export async function getStoreThemes(params?: {
  isPremium?: boolean;
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<Theme>> {
  try {
    const searchParams = new URLSearchParams();
    if (params?.isPremium !== undefined) {
      searchParams.set('isPremium', String(params.isPremium));
    }
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));

    const url = `${await getStoreApiUrl()}/api/themes${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error('Failed to fetch store themes:', error);
    return { success: false, data: [], error: '테마 목록을 불러올 수 없습니다.' };
  }
}

export async function getStoreTheme(themeId: string): Promise<StoreResponse<Theme>> {
  try {
    const res = await fetch(`${await getStoreApiUrl()}/api/themes/${themeId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('Failed to fetch theme:', error);
    return { success: false, error: '테마 정보를 불러올 수 없습니다.' };
  }
}

export async function purchaseTheme(
  themeId: string,
  accessToken: string
): Promise<StoreResponse<{ licenseKey: string }>> {
  try {
    const res = await fetch(`${await getStoreApiUrl()}/api/themes/${themeId}/purchase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error('Failed to purchase theme:', error);
    return { success: false, error: error instanceof Error ? error.message : '구매에 실패했습니다.' };
  }
}

export async function verifyThemeLicense(
  licenseKey: string,
  domain: string
): Promise<StoreResponse<{ valid: boolean; theme?: Theme }>> {
  try {
    const res = await fetch(`${await getStoreApiUrl()}/api/internal/theme-licenses/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey, domain }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('Failed to verify theme license:', error);
    return { success: false, error: '라이선스 검증에 실패했습니다.' };
  }
}

// ============================================================================
// 스킨 스토어 API
// ============================================================================

export async function getStoreSkins(params?: {
  type?: string;
  category?: string;
  isFree?: boolean;
  search?: string;
  sort?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<Skin>> {
  try {
    const searchParams = new URLSearchParams();
    if (params?.type) searchParams.set('type', params.type);
    if (params?.category) searchParams.set('category', params.category);
    if (params?.isFree !== undefined) searchParams.set('isFree', String(params.isFree));
    if (params?.search) searchParams.set('search', params.search);
    if (params?.sort) searchParams.set('sort', params.sort);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));

    const url = `${await getStoreApiUrl()}/api/skins${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error('Failed to fetch store skins:', error);
    return { success: false, data: [], error: '스킨 목록을 불러올 수 없습니다.' };
  }
}

export async function getStoreSkin(skinId: string): Promise<StoreResponse<Skin>> {
  try {
    const res = await fetch(`${await getStoreApiUrl()}/api/skins/${skinId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('Failed to fetch skin:', error);
    return { success: false, error: '스킨 정보를 불러올 수 없습니다.' };
  }
}

export async function purchaseSkin(
  skinId: string,
  accessToken: string
): Promise<StoreResponse<{ licenseKey: string }>> {
  try {
    const res = await fetch(`${await getStoreApiUrl()}/api/skins/${skinId}/purchase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error('Failed to purchase skin:', error);
    return { success: false, error: error instanceof Error ? error.message : '구매에 실패했습니다.' };
  }
}

export async function verifySkinLicense(
  licenseKey: string,
  domain: string
): Promise<StoreResponse<{ valid: boolean; skin?: Skin }>> {
  try {
    const res = await fetch(`${await getStoreApiUrl()}/api/internal/skin-licenses/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey, domain }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('Failed to verify skin license:', error);
    return { success: false, error: '라이선스 검증에 실패했습니다.' };
  }
}

// ============================================================================
// 타입 내보내기
// ============================================================================

export type { Theme, Skin, PaginatedResponse, StoreResponse };
