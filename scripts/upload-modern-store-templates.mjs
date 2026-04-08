/**
 * modern-store 테마 HTML 템플릿 업로드 스크립트
 * - sections/*.html → Supabase Storage
 * - theme.css → Supabase Storage
 * - DB installed_themes 업데이트 (section_html_urls, settings_schema, css_url, layout_config)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = 'https://gefwzjkgmwvgtafzfyjl.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const SUPABASE_ANON_KEY = 'sb_publishable_BjVMTU04QXxnmHBrN-Ty4w_7WVEXaci';

const THEME_ID = '789d9dae-0c94-4108-bdaa-b3a8241d44a6';
const THEME_SLUG = 'modern-store';
const THEME_DIR = join(__dirname, 'themes', 'modern-store');
const BUCKET = 'themes';

// service key 없으면 anon key 사용 (버킷이 public이면 업로드 가능)
const key = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, key);

// 섹션 ID 목록
// 레이아웃: header, footer
// 홈: hero, features, products, banner, reviews, newsletter, categories, cta
// 상품/쇼핑: product-list, product-detail, cart, checkout
// 커뮤니티: board-list, board-detail, board-write
// 계정/기타: login, signup, mypage, terms, privacy
const SECTIONS = [
  // 레이아웃
  'header', 'footer',
  // 홈
  'hero', 'features', 'products', 'banner', 'reviews', 'newsletter', 'categories', 'cta',
  // 상품/쇼핑
  'product-list', 'product-detail', 'cart', 'checkout',
  // 커뮤니티
  'board-list', 'board-detail', 'board-write',
  // 계정/기타
  'login', 'signup', 'mypage', 'terms', 'privacy',
];

async function uploadFile(storagePath, content, contentType) {
  const blob = new Blob([content], { type: contentType });
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, blob, { cacheControl: '3600', upsert: true });

  if (error) throw new Error(`Upload failed: ${storagePath} — ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

async function run() {
  console.log('🚀 modern-store 템플릿 업로드 시작\n');

  // 1. 버킷은 SQL로 미리 생성됨 (service key 불필요)
  console.log('✓ themes 버킷 준비 완료\n');

  // 2. 섹션 HTML 업로드
  const sectionHtmlUrls = {};
  for (const sectionId of SECTIONS) {
    const filePath = join(THEME_DIR, 'sections', `${sectionId}.html`);
    const html = readFileSync(filePath, 'utf-8');
    const storagePath = `${THEME_SLUG}/sections/${sectionId}.html`;
    const url = await uploadFile(storagePath, html, 'text/html');
    sectionHtmlUrls[sectionId] = url;
    console.log(`✓ ${sectionId}.html → ${url}`);
  }

  // 3. theme.css 업로드
  const css = readFileSync(join(THEME_DIR, 'theme.css'), 'utf-8');
  const cssUrl = await uploadFile(`${THEME_SLUG}/theme.css`, css, 'text/css');
  console.log(`\n✓ theme.css → ${cssUrl}`);

  // 4. settings.json 파싱
  const settingsSchema = JSON.parse(readFileSync(join(THEME_DIR, 'settings.json'), 'utf-8'));

  // 5. 기본 설정값 추출 (global + sections)
  const defaultSettings = {};
  for (const item of settingsSchema.global || []) {
    if (item.default !== undefined) defaultSettings[item.id] = String(item.default);
  }
  for (const section of settingsSchema.sections || []) {
    for (const item of section.settings || []) {
      if (item.default !== undefined) {
        defaultSettings[`${section.id}_${item.id}`] = String(item.default);
      }
    }
  }

  // 6. layout_config 구성 — homeSections는 홈 섹션만 (header/footer/비홈 제외)
  const HOME_SECTION_IDS = ['hero', 'features', 'products', 'banner', 'reviews', 'newsletter', 'categories', 'cta'];
  const sectionLabels = {
    hero: '히어로 배너',
    features: '특징 아이콘',
    products: '추천 상품',
    banner: '배너 2분할',
    reviews: '고객 후기',
    newsletter: '뉴스레터 구독',
    categories: '카테고리',
    cta: 'CTA 배너',
    'product-list': '상품 목록',
    'product-detail': '상품 상세',
    cart: '장바구니',
    checkout: '주문하기',
    'board-list': '게시판 목록',
    'board-detail': '게시글 상세',
    'board-write': '글쓰기',
    login: '로그인',
    signup: '회원가입',
    mypage: '마이페이지',
    terms: '이용약관',
    privacy: '개인정보처리방침',
  };
  const homeSections = HOME_SECTION_IDS.map((id) => ({
    id,
    type: 'custom',
    style: 'html',
    title: sectionLabels[id] || id,
    enabled: true,
  }));

  const layoutConfig = {
    header: null,
    footer: null,
    productCard: 'basic',
    productGrid: 'grid-4',
    settings: {
      headerFixed: true,
      showBreadcrumb: false,
      sidebarPosition: 'none',
      productImageRatio: '3:4',
    },
    homeSections,
  };

  // 7. DB 업데이트
  const { error: dbErr } = await supabase
    .from('installed_themes')
    .update({
      css_url: cssUrl,
      section_html_urls: sectionHtmlUrls,
      settings_schema: settingsSchema,
      theme_settings: defaultSettings,
      layout_config: layoutConfig,
    })
    .eq('id', THEME_ID);

  if (dbErr) throw new Error(`DB 업데이트 실패: ${dbErr.message}`);

  console.log('\n✓ DB 업데이트 완료');
  console.log('\n🎉 업로드 완료!');
  console.log(`\n에디터 확인: http://localhost:5173/admin/themes/editor?id=${THEME_ID}`);
}

run().catch((err) => {
  console.error('\n❌ 오류:', err.message);
  process.exit(1);
});
