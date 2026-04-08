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

// 버킷 존재 여부 캐시 (한 번 확인하면 재확인 불필요)
let _bucketReady = false;

/**
 * 테마 버킷 초기화 (없으면 생성) — 세션당 1회만 실행
 */
export async function ensureThemeBucket(): Promise<boolean> {
  if (_bucketReady) return true;

  const supabase = createClient();
  const { data: buckets, error: listErr } = await supabase.storage.listBuckets();

  if (listErr) {
    console.error('[ThemeStorage] 버킷 목록 조회 실패:', listErr.message);
    // 조회 실패해도 업로드 시도는 계속 진행
    _bucketReady = true;
    return true;
  }

  const exists = buckets?.some((b) => b.name === THEME_BUCKET);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(THEME_BUCKET, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024,
    });
    if (error && !error.message.toLowerCase().includes('already exists')) {
      console.error('[ThemeStorage] 버킷 생성 실패:', error.message);
      return false;
    }
  }

  _bucketReady = true;
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
 * 섹션 HTML 파일 업로드 → Storage
 * @returns Storage 공개 URL
 */
export async function uploadSectionHTML(
  themeSlug: string,
  sectionId: string,
  htmlContent: string
): Promise<UploadResult> {
  const supabase = createClient();
  await ensureThemeBucket();

  const filePath = `${themeSlug}/sections/${sectionId}.html`;
  const blob = new Blob([htmlContent], { type: 'text/html' });

  const { error } = await supabase.storage
    .from(THEME_BUCKET)
    .upload(filePath, blob, { cacheControl: '3600', upsert: true });

  if (error) return { success: false, error: error.message };

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

// =============================================================================
// 스킨 CSS 업로드
// =============================================================================

/**
 * 스킨 CSS 파일 업로드 (themes/{themeSlug}/skins/{skinSlug}.css)
 */
export async function uploadSkinCSS(
  themeSlug: string,
  skinSlug: string,
  cssContent: string
): Promise<UploadResult> {
  const supabase = createClient();
  await ensureThemeBucket();

  const filePath = `${themeSlug}/skins/${skinSlug}.css`;
  const blob = new Blob([cssContent], { type: 'text/css' });

  const { error } = await supabase.storage
    .from(THEME_BUCKET)
    .upload(filePath, blob, { cacheControl: '3600', upsert: true });

  if (error) return { success: false, error: error.message };

  const { data: urlData } = supabase.storage.from(THEME_BUCKET).getPublicUrl(filePath);
  return { success: true, url: urlData.publicUrl };
}

// =============================================================================
// 테마 패키지 파싱 & 스킨 자동 설치
// =============================================================================

interface ThemePackageData {
  name: string;
  slug: string;
  version: string;
  description?: string;
  layout: Record<string, any>;
  scripts?: any[];
  skins?: { slug: string; name: string; default?: boolean }[];
  /** 섹션 HTML URL 맵 (섹션ID → Storage URL) */
  sectionHtmlUrls?: Record<string, string>;
  /** settings.json 스키마 */
  settingsSchema?: Record<string, any>;
  /** 기본 설정값 */
  defaultSettings?: Record<string, string>;
}

/**
 * theme.json 파싱 후 DB에 테마 + 스킨 일괄 저장
 */
export async function installThemePackage(
  themeData: ThemePackageData,
  cssUrl?: string,
  thumbnailUrl?: string
): Promise<{ success: boolean; themeId?: string; error?: string }> {
  const supabase = createClient();

  try {
    // 1. 테마 DB 저장
    const { data: theme, error: themeErr } = await supabase
      .from('installed_themes')
      .upsert({
        slug: themeData.slug,
        name: themeData.name,
        version: themeData.version,
        description: themeData.description || null,
        source: 'store',
        css_url: cssUrl || null,
        thumbnail_url: thumbnailUrl || null,
        layout_config: themeData.layout || {},
        scripts: themeData.scripts || [],
        section_html_urls: themeData.sectionHtmlUrls || {},
        settings_schema: themeData.settingsSchema || {},
        theme_settings: themeData.defaultSettings || {},
        is_active: false,
      }, { onConflict: 'slug' })
      .select('id')
      .single();

    if (themeErr) throw themeErr;

    const themeId = theme.id;

    // 2. 스킨 자동 설치 (theme.json에 포함된 스킨)
    if (themeData.skins && themeData.skins.length > 0) {
      const skinRows = themeData.skins.map((skin) => ({
        slug: skin.slug,
        name: skin.name,
        type: 'theme-skin',
        version: themeData.version,
        theme_id: themeId,
        is_active: true,
        is_system: false,
        source: 'bundled',
      }));

      // 기존 스킨 제거 후 재설치
      await supabase.from('skins').delete().eq('theme_id', themeId);
      const { error: skinErr } = await supabase.from('skins').insert(skinRows);
      if (skinErr) console.warn('[ThemeStorage] 스킨 설치 경고:', skinErr.message);

      // 기본 스킨 자동 활성화
      const defaultSkin = themeData.skins.find((s) => s.default);
      if (defaultSkin) {
        await supabase
          .from('installed_themes')
          .update({ active_skin_slug: defaultSkin.slug })
          .eq('id', themeId);
      }
    }

    return { success: true, themeId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '테마 패키지 설치 실패',
    };
  }
}

/**
 * freecart-web에서 스킨 다운로드 후 Storage에 업로드 및 DB 저장
 */
export async function downloadAndInstallSkin(
  storeApiUrl: string,
  skinId: string,
  skinSlug: string,
  themeSlug: string,
  themeId: string | null,
  licenseKey?: string,
  accessToken?: string
): Promise<{ success: boolean; error?: string; code?: string }> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

    const response = await fetch(`${storeApiUrl}/api/skins/${skinId}/download`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ licenseKey, domain: window.location.origin }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.error || `HTTP ${response.status}`, code: errorData.code };
    }

    const data = await response.json();

    // CSS 업로드
    let cssUrl: string | undefined;
    if (data.css) {
      const r = await uploadSkinCSS(themeSlug, skinSlug, data.css);
      if (!r.success) throw new Error(r.error);
      cssUrl = r.url;
    } else if (data.cssUrl) {
      const cssContent = await fetch(data.cssUrl).then((r) => r.text());
      const r = await uploadSkinCSS(themeSlug, skinSlug, cssContent);
      if (!r.success) throw new Error(r.error);
      cssUrl = r.url;
    }

    // DB 저장
    const supabase = createClient();
    const skinMeta = data.skin || {};
    await supabase.from('skins').upsert({
      slug: skinSlug,
      name: skinMeta.name || skinSlug,
      type: themeId ? 'theme-skin' : (skinMeta.type || 'product_list'),
      version: skinMeta.version || '1.0.0',
      description: skinMeta.description || null,
      theme_id: themeId || null,
      css_url: cssUrl || null,
      source: 'store',
      license_key: licenseKey || null,
      is_active: true,
      is_system: false,
    }, { onConflict: 'slug' });

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : '스킨 다운로드 실패' };
  }
}

/**
 * freecart-web에서 테마 다운로드 후 Storage에 업로드
 */
export async function downloadAndInstallTheme(
  storeApiUrl: string,
  themeId: string,
  themeSlug: string,
  licenseKey?: string,
  accessToken?: string,
  onProgress?: (step: string) => void
): Promise<{ success: boolean; cssUrl?: string; error?: string; code?: string; activatedDomains?: string[] }> {
  const log = (msg: string) => {
    console.log(`[ThemeInstall] ${msg}`);
    onProgress?.(msg);
  };

  try {
    // 1단계: 스토어에서 다운로드
    log('스토어에서 테마 정보 요청 중...');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

    let response: Response;
    try {
      response = await fetch(`${storeApiUrl}/api/themes/${themeId}/download`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ licenseKey, domain: window.location.origin }),
      });
    } catch (fetchErr) {
      return { success: false, error: `스토어 서버 연결 실패: ${fetchErr instanceof Error ? fetchErr.message : '네트워크 오류'}` };
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `스토어 응답 오류 (HTTP ${response.status})`,
        code: errorData.code,
        activatedDomains: errorData.activatedDomains,
      };
    }

    const data = await response.json();
    log('테마 정보 수신 완료');

    let cssUrl: string | undefined;
    let thumbnailUrl: string | undefined;

    // 2단계: CSS Storage 업로드
    if (data.css) {
      log('CSS 업로드 중...');
      const r = await uploadThemeCSS(themeSlug, data.css);
      if (!r.success) return { success: false, error: `CSS 업로드 실패: ${r.error}` };
      cssUrl = r.url;
      log('CSS 업로드 완료');
    } else if (data.cssUrl) {
      log('CSS 파일 다운로드 중...');
      try {
        const cssResp = await fetch(data.cssUrl);
        if (!cssResp.ok) throw new Error(`HTTP ${cssResp.status}`);
        const cssContent = await cssResp.text();
        log('CSS Storage에 업로드 중...');
        const r = await uploadThemeCSS(themeSlug, cssContent);
        if (r.success) {
          cssUrl = r.url;
          log('CSS 업로드 완료');
        } else {
          console.warn('[ThemeInstall] CSS 업로드 실패 (설치는 계속):', r.error);
        }
      } catch (cssErr) {
        console.warn('[ThemeInstall] CSS fetch 실패 (설치는 계속):', cssErr);
      }
    }

    // 3단계: 스킨 CSS 업로드
    if (data.skins && Array.isArray(data.skins) && data.skins.length > 0) {
      log(`스킨 ${data.skins.length}개 업로드 중...`);
      for (const skin of data.skins) {
        if (skin.css) {
          const r = await uploadSkinCSS(themeSlug, skin.slug, skin.css);
          if (!r.success) console.warn(`[ThemeInstall] 스킨 ${skin.slug} 업로드 실패:`, r.error);
        }
      }
    }

    // 4단계: DB 저장
    log('테마 정보 저장 중...');
    const themePackage = data.theme ?? {
      slug:    data.slug     || themeSlug,
      name:    data.themeName || themeSlug,
      version: data.version  || '1.0.0',
      skins:   data.skins    || [],
    };

    const installResult = await installThemePackage(themePackage, cssUrl, thumbnailUrl);
    if (!installResult.success) {
      return { success: false, error: `DB 저장 실패: ${installResult.error}` };
    }

    log('설치 완료!');
    return { success: true, cssUrl };

  } catch (error) {
    const msg = error instanceof Error ? error.message : '알 수 없는 오류';
    console.error('[ThemeInstall] 예상치 못한 오류:', error);
    return { success: false, error: msg };
  }
}
