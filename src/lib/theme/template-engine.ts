/**
 * Freecart 테마 템플릿 엔진
 * HTML 파일 내 {{variable}} 을 런타임에 치환합니다.
 * 테마 판매자가 자유롭게 HTML 구조를 작성할 수 있습니다.
 */

export type ThemeSettings = Record<string, string>;

/**
 * 설정 값 타입
 */
export type SettingType = 'text' | 'textarea' | 'image' | 'color' | 'select' | 'checkbox' | 'url' | 'number';

export interface SettingItem {
  id: string;
  type: SettingType;
  label: string;
  default?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];  // select용
  info?: string;
}

export interface SettingsSection {
  id: string;
  name: string;
  settings: SettingItem[];
}

export interface ThemeSettingsSchema {
  global?: SettingItem[];
  sections?: SettingsSection[];
}

/**
 * HTML 템플릿 변수 치환
 * {{variable}} → settings[variable]
 * {{variable | default: 'fallback'}} → settings[variable] ?? 'fallback'
 */
export function renderTemplate(html: string, settings: ThemeSettings): string {
  return html.replace(/\{\{([^}]+)\}\}/g, (_, expr) => {
    const parts = expr.split('|').map((s: string) => s.trim());
    const key = parts[0];

    // 기본값 처리: {{key | default: 'fallback'}}
    let fallback = '';
    if (parts[1]?.startsWith('default:')) {
      fallback = parts[1].replace(/^default:\s*['"]?/, '').replace(/['"]?$/, '');
    }

    const value = settings[key];
    if (value === undefined || value === null || value === '') return fallback;
    return String(value);
  });
}

/**
 * Storage에서 HTML 템플릿을 가져와 변수 치환
 */
export async function fetchAndRenderTemplate(
  htmlUrl: string,
  settings: ThemeSettings,
  signal?: AbortSignal
): Promise<{ html: string; error?: string }> {
  try {
    const res = await fetch(htmlUrl, { signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.text();
    return { html: renderTemplate(raw, settings) };
  } catch (err) {
    if ((err as Error).name === 'AbortError') return { html: '', error: 'aborted' };
    return { html: '', error: err instanceof Error ? err.message : '템플릿 로드 실패' };
  }
}

/**
 * settings.json 파싱 (ZIP 설치 시)
 */
export function parseSettingsSchema(json: string): ThemeSettingsSchema {
  try {
    return JSON.parse(json) as ThemeSettingsSchema;
  } catch {
    return {};
  }
}

/**
 * 스키마에서 기본값 추출
 */
export function extractDefaultSettings(schema: ThemeSettingsSchema): ThemeSettings {
  const defaults: ThemeSettings = {};

  schema.global?.forEach((s) => {
    if (s.default !== undefined) defaults[s.id] = s.default;
  });

  schema.sections?.forEach((sec) => {
    sec.settings.forEach((s) => {
      if (s.default !== undefined) defaults[`${sec.id}_${s.id}`] = s.default;
    });
  });

  return defaults;
}
