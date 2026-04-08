/**
 * Theme Storage Service
 * Supabase Storage를 사용하여 테마 파일을 관리합니다.
 */

import { createClient } from '@/lib/supabase/client';

const THEME_BUCKET = 'themes';

interface ThemeFiles {
  cssUrl?: string;
  thumbnailUrl?: string;
  additionalFiles?: { name: string; url: string }[];
}

interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * 테마 버킷 초기화 (없으면 생성)
 */
export async function ensureThemeBucket(): Promise<boolean> {
  const supabase = createClient();

  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === THEME_BUCKET);

  if (!exists) {
    const { error } = await supabase.storage.createBucket(THEME_BUCKET, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024, // 10MB
    });
    if (error && !error.message.includes('already exists')) {
      console.error('Failed to create theme bucket:', error);
      return false;
    }
  }

  return true;
}

/**
 * 테마 CSS 파일 업로드
 */
export async function uploadThemeCSS(
  themeSlug: string,
  cssContent: string
): Promise<UploadResult> {
  const supabase = createClient();

  await ensureThemeBucket();

  const filePath = `${themeSlug}/theme.css`;
  const blob = new Blob([cssContent], { type: 'text/css' });

  const { error } = await supabase.storage
    .from(THEME_BUCKET)
    .upload(filePath, blob, {
      cacheControl: '3600',
      upsert: true,
    });

  if (error) {
    return { success: false, error: error.message };
  }

  const { data: urlData } = supabase.storage
    .from(THEME_BUCKET)
    .getPublicUrl(filePath);

  return { success: true, url: urlData.publicUrl };
}

/**
 * 테마 썸네일 업로드
 */
export async function uploadThemeThumbnail(
  themeSlug: string,
  file: File
): Promise<UploadResult> {
  const supabase = createClient();

  await ensureThemeBucket();

  const ext = file.name.split('.').pop() || 'png';
  const filePath = `${themeSlug}/thumbnail.${ext}`;

  const { error } = await supabase.storage
    .from(THEME_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (error) {
    return { success: false, error: error.message };
  }

  const { data: urlData } = supabase.storage
    .from(THEME_BUCKET)
    .getPublicUrl(filePath);

  return { success: true, url: urlData.publicUrl };
}

/**
 * 테마 파일 업로드 (일반)
 */
export async function uploadThemeFile(
  themeSlug: string,
  fileName: string,
  file: File | Blob
): Promise<UploadResult> {
  const supabase = createClient();

  await ensureThemeBucket();

  const filePath = `${themeSlug}/${fileName}`;

  const { error } = await supabase.storage
    .from(THEME_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (error) {
    return { success: false, error: error.message };
  }

  const { data: urlData } = supabase.storage
    .from(THEME_BUCKET)
    .getPublicUrl(filePath);

  return { success: true, url: urlData.publicUrl };
}

/**
 * 테마 파일 삭제
 */
export async function deleteThemeFiles(themeSlug: string): Promise<boolean> {
  const supabase = createClient();

  // 해당 테마 폴더의 모든 파일 목록
  const { data: files, error: listError } = await supabase.storage
    .from(THEME_BUCKET)
    .list(themeSlug);

  if (listError || !files || files.length === 0) {
    return true; // 파일이 없으면 성공으로 처리
  }

  const filePaths = files.map((f) => `${themeSlug}/${f.name}`);

  const { error } = await supabase.storage
    .from(THEME_BUCKET)
    .remove(filePaths);

  return !error;
}

/**
 * 테마 파일 목록 조회
 */
export async function getThemeFiles(themeSlug: string): Promise<ThemeFiles> {
  const supabase = createClient();

  const { data: files } = await supabase.storage
    .from(THEME_BUCKET)
    .list(themeSlug);

  if (!files || files.length === 0) {
    return {};
  }

  const result: ThemeFiles = { additionalFiles: [] };

  for (const file of files) {
    const { data: urlData } = supabase.storage
      .from(THEME_BUCKET)
      .getPublicUrl(`${themeSlug}/${file.name}`);

    if (file.name === 'theme.css') {
      result.cssUrl = urlData.publicUrl;
    } else if (file.name.startsWith('thumbnail')) {
      result.thumbnailUrl = urlData.publicUrl;
    } else {
      result.additionalFiles?.push({
        name: file.name,
        url: urlData.publicUrl,
      });
    }
  }

  return result;
}

/**
 * freecart-web에서 테마 다운로드 후 Storage에 업로드
 */
export async function downloadAndInstallTheme(
  storeApiUrl: string,
  themeId: string,
  themeSlug: string,
  licenseKey?: string,
  accessToken?: string
): Promise<{ success: boolean; cssUrl?: string; error?: string; code?: string; activatedDomains?: string[] }> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    const response = await fetch(`${storeApiUrl}/api/themes/${themeId}/download`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ licenseKey, domain: window.location.origin }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}`,
        code: errorData.code,
        activatedDomains: errorData.activatedDomains,
      };
    }

    const data = await response.json();

    // CSS 내용이 있으면 Storage에 업로드
    if (data.css) {
      const uploadResult = await uploadThemeCSS(themeSlug, data.css);
      if (!uploadResult.success) {
        throw new Error(uploadResult.error);
      }
      return { success: true, cssUrl: uploadResult.url };
    }

    // CSS URL이 있으면 다운로드 후 Storage에 업로드
    if (data.cssUrl) {
      const cssResponse = await fetch(data.cssUrl);
      const cssContent = await cssResponse.text();

      const uploadResult = await uploadThemeCSS(themeSlug, cssContent);
      if (!uploadResult.success) {
        throw new Error(uploadResult.error);
      }
      return { success: true, cssUrl: uploadResult.url };
    }

    return { success: true };
  } catch (error) {
    console.error('Theme download failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '테마 다운로드 실패',
    };
  }
}
