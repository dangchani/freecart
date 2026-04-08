/**
 * 기본 테마 HTML 템플릿 시더
 * - Storage에 sections/*.html 업로드
 * - installed_themes DB 업데이트 (section_html_urls, settings_schema)
 *
 * 실행: node scripts/seed-default-theme.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gefwzjkgmwvgtafzfyjl.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlZnd6amtnbXd2Z3RhZnpmeWpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDE0MTcsImV4cCI6MjA5MDgxNzQxN30.PT1EeTTxNu337WzOezIy4QXDrfoeBezryqqhCjerAl0';
const ADMIN_EMAIL  = 'admin@freecart.kr';
const ADMIN_PW     = '!cE4Q4nB7wHL';
const THEME_SLUG   = 'default-shop';
const BUCKET       = 'themes';

// ============================================================
// HTML Templates
// ============================================================

const HEADER_HTML = `
<header style="
  background: var(--theme-header-bg, {{header_bg | default: '#ffffff'}});
  border-bottom: 1px solid rgba(0,0,0,0.08);
  position: sticky; top: 0; z-index: 100;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
">
  <div style="
    max-width: var(--theme-max-width, 1280px);
    margin: 0 auto;
    padding: 0 1.5rem;
    display: flex;
    align-items: center;
    height: var(--theme-header-height, 64px);
    gap: 2rem;
  ">
    <!-- 로고 -->
    <a href="/" style="text-decoration:none; flex-shrink:0;">
      {{#if header_logo_url}}
        <img src="{{header_logo_url}}" alt="{{brand_name | default: 'SHOP'}}"
          style="height: 36px; width: auto; object-fit: contain; display: block;" />
      {{else}}
        <span style="
          font-size: 1.375rem;
          font-weight: 800;
          color: var(--theme-header-text, {{header_text_color | default: '#111827'}});
          letter-spacing: -0.03em;
        ">{{brand_name | default: 'SHOP'}}</span>
      {{/if}}
    </a>

    <!-- 네비게이션 -->
    <nav style="display: flex; gap: 1.75rem; margin-left: 1rem;">
      <a href="/products" style="
        color: var(--theme-header-text, {{header_text_color | default: '#111827'}});
        text-decoration: none; font-size: 0.875rem; font-weight: 500;
        opacity: 0.8; transition: opacity 0.15s;
      " onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">전체상품</a>
      <a href="/products?sort=new" style="
        color: var(--theme-header-text, {{header_text_color | default: '#111827'}});
        text-decoration: none; font-size: 0.875rem; font-weight: 500;
        opacity: 0.8; transition: opacity 0.15s;
      " onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">신상품</a>
      <a href="/products?sort=best" style="
        color: var(--theme-header-text, {{header_text_color | default: '#111827'}});
        text-decoration: none; font-size: 0.875rem; font-weight: 500;
        opacity: 0.8; transition: opacity 0.15s;
      " onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">베스트</a>
      <a href="/brands" style="
        color: var(--theme-header-text, {{header_text_color | default: '#111827'}});
        text-decoration: none; font-size: 0.875rem; font-weight: 500;
        opacity: 0.8; transition: opacity 0.15s;
      " onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">브랜드</a>
    </nav>

    <div style="flex: 1;"></div>

    <!-- 아이콘 -->
    <div style="display: flex; align-items: center; gap: 1.25rem;">
      <a href="/products/search" style="
        color: var(--theme-header-text, {{header_text_color | default: '#374151'}});
        text-decoration: none; display: flex; align-items: center;
        opacity: 0.7; transition: opacity 0.15s;
      " onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'" title="검색">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
        </svg>
      </a>
      <a href="/mypage/wishlist" style="
        color: var(--theme-header-text, {{header_text_color | default: '#374151'}});
        text-decoration: none; display: flex; align-items: center;
        opacity: 0.7; transition: opacity 0.15s;
      " onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'" title="위시리스트">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      </a>
      <a href="/cart" style="
        color: var(--theme-header-text, {{header_text_color | default: '#374151'}});
        text-decoration: none; display: flex; align-items: center;
        opacity: 0.7; transition: opacity 0.15s;
      " onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'" title="장바구니">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
        </svg>
      </a>
      <a href="/mypage" style="
        color: var(--theme-header-text, {{header_text_color | default: '#374151'}});
        text-decoration: none; display: flex; align-items: center;
        opacity: 0.7; transition: opacity 0.15s;
      " onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'" title="마이페이지">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
      </a>
    </div>
  </div>
</header>
`.trim();

// ─────────────────────────────────────────────

const HERO_HTML = `
<section style="
  position: relative;
  background-color: {{hero_bg_color | default: '#0f172a'}};
  {{#if hero_bg_image}}
  background-image: url('{{hero_bg_image}}');
  background-size: cover;
  background-position: center;
  {{/if}}
  overflow: hidden;
">
  <!-- 오버레이 -->
  <div style="
    position: absolute; inset: 0;
    background: rgba(0,0,0,{{hero_overlay_opacity | default: '0.4'}});
    {{#unless hero_bg_image}}display:none;{{/unless}}
  "></div>

  <div style="
    position: relative; z-index: 1;
    max-width: var(--theme-max-width, 1280px);
    margin: 0 auto;
    padding: clamp(4rem, 10vw, 8rem) 1.5rem;
    text-align: {{hero_align | default: 'center'}};
  ">
    {{#if hero_badge}}
    <div style="
      display: inline-block;
      background: var(--theme-accent, #ef4444);
      color: #fff;
      font-size: 0.75rem; font-weight: 600;
      padding: 0.25rem 0.875rem;
      border-radius: 100px;
      margin-bottom: 1rem;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    ">{{hero_badge}}</div>
    {{/if}}

    <h1 style="
      font-size: clamp(2rem, 5vw, 3.75rem);
      font-weight: 800;
      color: {{hero_title_color | default: '#ffffff'}};
      margin: 0 0 1rem;
      line-height: 1.15;
      letter-spacing: -0.02em;
      white-space: pre-line;
    ">{{hero_title | default: '최고의 쇼핑 경험을\n지금 만나보세요'}}</h1>

    <p style="
      font-size: clamp(1rem, 2vw, 1.25rem);
      color: {{hero_subtitle_color | default: 'rgba(255,255,255,0.75)'}};
      margin: 0 0 2.5rem;
      line-height: 1.6;
      max-width: 600px;
      {{#if hero_align_center}}margin-left: auto; margin-right: auto;{{/if}}
    ">{{hero_subtitle | default: '엄선된 상품을 합리적인 가격으로'}}</p>

    <div style="display: flex; gap: 1rem; flex-wrap: wrap; justify-content: {{hero_align | default: 'center'}};">
      <a href="{{hero_btn_url | default: '/products'}}" style="
        display: inline-flex; align-items: center; gap: 0.5rem;
        background: var(--theme-btn-bg, {{hero_btn_bg | default: '#ffffff'}});
        color: var(--theme-btn-text, {{hero_btn_text_color | default: '#111827'}});
        padding: 0.875rem 2.25rem;
        border-radius: var(--theme-btn-radius, 6px);
        text-decoration: none;
        font-weight: 700; font-size: 1rem;
        transition: transform 0.15s, box-shadow 0.15s;
        box-shadow: 0 4px 14px rgba(0,0,0,0.15);
      " onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 20px rgba(0,0,0,0.2)'"
         onmouseout="this.style.transform='';this.style.boxShadow='0 4px 14px rgba(0,0,0,0.15)'">
        {{hero_btn_label | default: '쇼핑 시작하기'}}
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </a>

      {{#if hero_btn2_label}}
      <a href="{{hero_btn2_url | default: '/products?sort=new'}}" style="
        display: inline-flex; align-items: center;
        background: transparent;
        color: {{hero_title_color | default: '#ffffff'}};
        padding: 0.875rem 2.25rem;
        border-radius: var(--theme-btn-radius, 6px);
        border: 2px solid rgba(255,255,255,0.5);
        text-decoration: none;
        font-weight: 600; font-size: 1rem;
        transition: background 0.15s, border-color 0.15s;
      " onmouseover="this.style.background='rgba(255,255,255,0.1)';this.style.borderColor='rgba(255,255,255,0.8)'"
         onmouseout="this.style.background='transparent';this.style.borderColor='rgba(255,255,255,0.5)'">
        {{hero_btn2_label}}
      </a>
      {{/if}}
    </div>
  </div>
</section>
`.trim();

// ─────────────────────────────────────────────

const NOTICE_BAR_HTML = `
{{#if noticebar_text}}
<div style="
  background: {{noticebar_bg | default: 'var(--theme-primary, #000)'}};
  color: {{noticebar_text_color | default: '#ffffff'}};
  text-align: center;
  padding: 0.625rem 1rem;
  font-size: 0.8125rem;
  font-weight: 500;
">
  {{#if noticebar_url}}
  <a href="{{noticebar_url}}" style="color: inherit; text-decoration: none;">
    {{noticebar_text}}
    <span style="margin-left: 0.5rem; opacity: 0.7;">→</span>
  </a>
  {{else}}
  {{noticebar_text}}
  {{/if}}
</div>
{{/if}}
`.trim();

// ─────────────────────────────────────────────

const PROMO_BANNER_HTML = `
<section style="padding: 3rem 1.5rem; background: {{promo_bg | default: '#f8fafc'}};">
  <div style="max-width: var(--theme-max-width, 1280px); margin: 0 auto;">
    <div style="
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.5rem;
    ">
      <!-- 카드 1 -->
      {{#if promo1_title}}
      <a href="{{promo1_url | default: '/products'}}" style="
        display: block; text-decoration: none;
        background: {{promo1_bg | default: 'var(--theme-primary, #111)'}};
        color: {{promo1_text | default: '#fff'}};
        border-radius: calc(var(--theme-card-radius, 8px) * 1.5);
        padding: 2.5rem;
        position: relative; overflow: hidden;
        transition: transform 0.2s, box-shadow 0.2s;
        min-height: 200px;
        {{#if promo1_image}}
        background-image: url('{{promo1_image}}');
        background-size: cover; background-position: center;
        {{/if}}
      " onmouseover="this.style.transform='translateY(-4px)';this.style.boxShadow='0 16px 40px rgba(0,0,0,0.15)'"
         onmouseout="this.style.transform='';this.style.boxShadow=''">
        {{#if promo1_image}}<div style="position:absolute;inset:0;background:rgba(0,0,0,0.35);border-radius:inherit;"></div>{{/if}}
        <div style="position:relative;z-index:1;">
          <p style="font-size:0.75rem;opacity:0.7;margin:0 0 0.5rem;text-transform:uppercase;letter-spacing:0.1em;">{{promo1_badge}}</p>
          <h3 style="font-size:1.375rem;font-weight:800;margin:0 0 0.75rem;line-height:1.2;">{{promo1_title}}</h3>
          <p style="font-size:0.875rem;opacity:0.8;margin:0 0 1.5rem;">{{promo1_desc}}</p>
          <span style="font-size:0.8125rem;font-weight:600;border-bottom:1px solid currentColor;padding-bottom:2px;">보러가기 →</span>
        </div>
      </a>
      {{/if}}

      <!-- 카드 2 -->
      {{#if promo2_title}}
      <a href="{{promo2_url | default: '/products'}}" style="
        display: block; text-decoration: none;
        background: {{promo2_bg | default: '#e0f2fe'}};
        color: {{promo2_text | default: '#0369a1'}};
        border-radius: calc(var(--theme-card-radius, 8px) * 1.5);
        padding: 2.5rem;
        position: relative; overflow: hidden;
        transition: transform 0.2s, box-shadow 0.2s;
        min-height: 200px;
        {{#if promo2_image}}
        background-image: url('{{promo2_image}}');
        background-size: cover; background-position: center;
        {{/if}}
      " onmouseover="this.style.transform='translateY(-4px)';this.style.boxShadow='0 16px 40px rgba(0,0,0,0.12)'"
         onmouseout="this.style.transform='';this.style.boxShadow=''">
        {{#if promo2_image}}<div style="position:absolute;inset:0;background:rgba(0,0,0,0.3);border-radius:inherit;"></div>{{/if}}
        <div style="position:relative;z-index:1;">
          <p style="font-size:0.75rem;opacity:0.7;margin:0 0 0.5rem;text-transform:uppercase;letter-spacing:0.1em;">{{promo2_badge}}</p>
          <h3 style="font-size:1.375rem;font-weight:800;margin:0 0 0.75rem;line-height:1.2;">{{promo2_title}}</h3>
          <p style="font-size:0.875rem;opacity:0.8;margin:0 0 1.5rem;">{{promo2_desc}}</p>
          <span style="font-size:0.8125rem;font-weight:600;border-bottom:1px solid currentColor;padding-bottom:2px;">보러가기 →</span>
        </div>
      </a>
      {{/if}}

      <!-- 카드 3 -->
      {{#if promo3_title}}
      <a href="{{promo3_url | default: '/products'}}" style="
        display: block; text-decoration: none;
        background: {{promo3_bg | default: '#fef9c3'}};
        color: {{promo3_text | default: '#713f12'}};
        border-radius: calc(var(--theme-card-radius, 8px) * 1.5);
        padding: 2.5rem;
        position: relative; overflow: hidden;
        transition: transform 0.2s, box-shadow 0.2s;
        min-height: 200px;
        {{#if promo3_image}}
        background-image: url('{{promo3_image}}');
        background-size: cover; background-position: center;
        {{/if}}
      " onmouseover="this.style.transform='translateY(-4px)';this.style.boxShadow='0 16px 40px rgba(0,0,0,0.1)'"
         onmouseout="this.style.transform='';this.style.boxShadow=''">
        {{#if promo3_image}}<div style="position:absolute;inset:0;background:rgba(0,0,0,0.25);border-radius:inherit;"></div>{{/if}}
        <div style="position:relative;z-index:1;">
          <p style="font-size:0.75rem;opacity:0.7;margin:0 0 0.5rem;text-transform:uppercase;letter-spacing:0.1em;">{{promo3_badge}}</p>
          <h3 style="font-size:1.375rem;font-weight:800;margin:0 0 0.75rem;line-height:1.2;">{{promo3_title}}</h3>
          <p style="font-size:0.875rem;opacity:0.8;margin:0 0 1.5rem;">{{promo3_desc}}</p>
          <span style="font-size:0.8125rem;font-weight:600;border-bottom:1px solid currentColor;padding-bottom:2px;">보러가기 →</span>
        </div>
      </a>
      {{/if}}
    </div>
  </div>
</section>
`.trim();

// ─────────────────────────────────────────────

const FOOTER_HTML = `
<footer style="background: {{footer_bg | default: '#111827'}}; color: {{footer_text | default: '#9ca3af'}};">
  <div style="max-width: var(--theme-max-width, 1280px); margin: 0 auto; padding: 3.5rem 1.5rem 0;">
    <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 2.5rem; padding-bottom: 3rem;">

      <!-- 브랜드 -->
      <div>
        {{#if footer_logo_url}}
          <img src="{{footer_logo_url}}" alt="{{brand_name | default: 'SHOP'}}"
            style="height: 32px; width: auto; object-fit: contain; margin-bottom: 1rem; filter: brightness(0) invert(1); opacity: 0.9;" />
        {{else}}
          <div style="font-size: 1.25rem; font-weight: 800; color: #fff; margin-bottom: 1rem; letter-spacing: -0.03em;">
            {{brand_name | default: 'SHOP'}}
          </div>
        {{/if}}
        <div style="font-size: 0.75rem; line-height: 1.9; white-space: pre-line;">{{footer_business_info | default: '대표: 홍길동\n사업자번호: 000-00-00000\n통신판매업: 제0000-서울-0000호\n주소: 서울특별시 강남구'}}</div>
        <div style="margin-top: 1.5rem; display: flex; gap: 0.75rem;">
          {{#if footer_instagram}}
          <a href="{{footer_instagram}}" target="_blank" rel="noopener" style="
            width: 36px; height: 36px; border-radius: 8px;
            background: rgba(255,255,255,0.08);
            display: flex; align-items: center; justify-content: center;
            color: #9ca3af; text-decoration: none;
            transition: background 0.15s;
          " onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">
            <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
          </a>
          {{/if}}
          {{#if footer_kakao}}
          <a href="{{footer_kakao}}" target="_blank" rel="noopener" style="
            width: 36px; height: 36px; border-radius: 8px;
            background: rgba(255,255,255,0.08);
            display: flex; align-items: center; justify-content: center;
            color: #9ca3af; text-decoration: none;
            font-size: 0.75rem; font-weight: 700;
          " onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">KT</a>
          {{/if}}
        </div>
      </div>

      <!-- 고객센터 -->
      <div>
        <p style="font-size: 0.8125rem; font-weight: 700; color: #fff; margin: 0 0 1rem; text-transform: uppercase; letter-spacing: 0.05em;">고객센터</p>
        <p style="font-size: 1.625rem; font-weight: 800; color: #fff; margin: 0 0 0.375rem; letter-spacing: -0.02em;">{{footer_phone | default: '1234-5678'}}</p>
        <p style="font-size: 0.75rem; line-height: 1.7; margin: 0;">{{footer_hours | default: '평일 09:00 ~ 18:00\n토/일/공휴일 휴무'}}</p>
        {{#if footer_email}}
        <p style="font-size: 0.75rem; margin: 0.75rem 0 0;">
          <a href="mailto:{{footer_email}}" style="color: inherit; text-decoration: none; opacity: 0.8;">{{footer_email}}</a>
        </p>
        {{/if}}
      </div>

      <!-- 쇼핑 -->
      <div>
        <p style="font-size: 0.8125rem; font-weight: 700; color: #fff; margin: 0 0 1rem; text-transform: uppercase; letter-spacing: 0.05em;">쇼핑</p>
        <nav style="display: flex; flex-direction: column; gap: 0.5rem;">
          <a href="/products?sort=new" style="font-size:0.8125rem; color:inherit; text-decoration:none; opacity:0.8; transition:opacity 0.15s;"
            onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">신상품</a>
          <a href="/products?sort=best" style="font-size:0.8125rem; color:inherit; text-decoration:none; opacity:0.8; transition:opacity 0.15s;"
            onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">베스트</a>
          <a href="/brands" style="font-size:0.8125rem; color:inherit; text-decoration:none; opacity:0.8; transition:opacity 0.15s;"
            onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">브랜드</a>
          <a href="/products/search" style="font-size:0.8125rem; color:inherit; text-decoration:none; opacity:0.8; transition:opacity 0.15s;"
            onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">상품 검색</a>
        </nav>
      </div>

      <!-- 정보 -->
      <div>
        <p style="font-size: 0.8125rem; font-weight: 700; color: #fff; margin: 0 0 1rem; text-transform: uppercase; letter-spacing: 0.05em;">정보</p>
        <nav style="display: flex; flex-direction: column; gap: 0.5rem;">
          <a href="/terms/service" style="font-size:0.8125rem; color:inherit; text-decoration:none; opacity:0.8; transition:opacity 0.15s;"
            onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">이용약관</a>
          <a href="/terms/privacy" style="font-size:0.8125rem; color:inherit; text-decoration:none; opacity:0.8; transition:opacity 0.15s;"
            onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">개인정보처리방침</a>
          <a href="/boards/notice" style="font-size:0.8125rem; color:inherit; text-decoration:none; opacity:0.8; transition:opacity 0.15s;"
            onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">공지사항</a>
          <a href="/faqs" style="font-size:0.8125rem; color:inherit; text-decoration:none; opacity:0.8; transition:opacity 0.15s;"
            onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">자주 묻는 질문</a>
          <a href="/inquiries/new" style="font-size:0.8125rem; color:inherit; text-decoration:none; opacity:0.8; transition:opacity 0.15s;"
            onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">1:1 문의</a>
        </nav>
      </div>
    </div>
  </div>

  <!-- 하단 바 -->
  <div style="border-top: 1px solid rgba(255,255,255,0.08); padding: 1.25rem 1.5rem; text-align: center;">
    <p style="font-size: 0.6875rem; color: rgba(255,255,255,0.25); margin: 0;">
      © 2025 {{brand_name | default: 'SHOP'}}. All rights reserved.
      {{#if footer_powered_by}}
      &nbsp;·&nbsp; Powered by <a href="https://freecart.kr" target="_blank" style="color:inherit;text-decoration:none;opacity:0.6;">Freecart</a>
      {{/if}}
    </p>
  </div>
</footer>
`.trim();

// ============================================================
// Settings Schema
// ============================================================

const SETTINGS_JSON = {
  global: [
    { id: 'brand_name', type: 'text', label: '쇼핑몰명', default: 'SHOP', placeholder: '브랜드명 입력', info: '헤더·푸터 로고 텍스트로 사용됩니다.' },
  ],
  sections: [
    {
      id: 'header',
      name: '헤더',
      settings: [
        { id: 'logo_url', type: 'image', label: '로고 이미지', info: '권장: PNG/SVG, 높이 36px 기준. 없으면 쇼핑몰명이 표시됩니다.' },
        { id: 'bg', type: 'color', label: '배경색', default: '#ffffff' },
        { id: 'text_color', type: 'color', label: '텍스트/아이콘 색상', default: '#111827' },
      ],
    },
    {
      id: 'noticebar',
      name: '공지 바 (상단)',
      settings: [
        { id: 'text', type: 'text', label: '공지 텍스트', placeholder: '신규 회원 무료배송 이벤트 진행 중!', info: '비우면 공지 바가 숨겨집니다.' },
        { id: 'url', type: 'url', label: '링크 URL', placeholder: '/boards/notice' },
        { id: 'bg', type: 'color', label: '배경색', default: '#111827' },
        { id: 'text_color', type: 'color', label: '텍스트 색상', default: '#ffffff' },
      ],
    },
    {
      id: 'hero',
      name: '히어로 배너',
      settings: [
        { id: 'badge', type: 'text', label: '뱃지 텍스트', placeholder: 'NEW COLLECTION', info: '비우면 뱃지가 숨겨집니다.' },
        { id: 'title', type: 'textarea', label: '제목', default: '최고의 쇼핑 경험을\n지금 만나보세요', info: '줄바꿈(Enter)이 적용됩니다.' },
        { id: 'subtitle', type: 'text', label: '부제목', default: '엄선된 상품을 합리적인 가격으로' },
        { id: 'bg_image', type: 'image', label: '배경 이미지 URL' },
        { id: 'bg_color', type: 'color', label: '배경 색상', default: '#0f172a', info: '배경 이미지가 없을 때 사용됩니다.' },
        { id: 'overlay_opacity', type: 'number', label: '이미지 어둠 강도 (0~1)', default: '0.4', info: '배경 이미지 위 어두운 오버레이의 불투명도' },
        { id: 'title_color', type: 'color', label: '제목 색상', default: '#ffffff' },
        { id: 'subtitle_color', type: 'color', label: '부제목 색상', default: 'rgba(255,255,255,0.75)' },
        { id: 'align', type: 'select', label: '정렬', default: 'center', options: [{ value: 'left', label: '좌측' }, { value: 'center', label: '중앙' }] },
        { id: 'btn_label', type: 'text', label: '버튼 1 텍스트', default: '쇼핑 시작하기' },
        { id: 'btn_url', type: 'url', label: '버튼 1 링크', default: '/products' },
        { id: 'btn_bg', type: 'color', label: '버튼 배경색', default: '#ffffff' },
        { id: 'btn_text_color', type: 'color', label: '버튼 텍스트 색상', default: '#111827' },
        { id: 'btn2_label', type: 'text', label: '버튼 2 텍스트', placeholder: '신상품 보기 (비우면 숨김)' },
        { id: 'btn2_url', type: 'url', label: '버튼 2 링크', default: '/products?sort=new' },
      ],
    },
    {
      id: 'promo',
      name: '프로모션 배너',
      settings: [
        { id: 'bg', type: 'color', label: '섹션 배경색', default: '#f8fafc' },
        { id: '1_title', type: 'text', label: '카드 1 제목', placeholder: '비우면 카드가 숨겨집니다.' },
        { id: '1_badge', type: 'text', label: '카드 1 뱃지', placeholder: 'SALE' },
        { id: '1_desc', type: 'text', label: '카드 1 설명' },
        { id: '1_image', type: 'image', label: '카드 1 이미지' },
        { id: '1_bg', type: 'color', label: '카드 1 배경색', default: '#111827' },
        { id: '1_text', type: 'color', label: '카드 1 텍스트색', default: '#ffffff' },
        { id: '1_url', type: 'url', label: '카드 1 링크', default: '/products' },
        { id: '2_title', type: 'text', label: '카드 2 제목', placeholder: '비우면 카드가 숨겨집니다.' },
        { id: '2_badge', type: 'text', label: '카드 2 뱃지' },
        { id: '2_desc', type: 'text', label: '카드 2 설명' },
        { id: '2_image', type: 'image', label: '카드 2 이미지' },
        { id: '2_bg', type: 'color', label: '카드 2 배경색', default: '#e0f2fe' },
        { id: '2_text', type: 'color', label: '카드 2 텍스트색', default: '#0369a1' },
        { id: '2_url', type: 'url', label: '카드 2 링크', default: '/products' },
        { id: '3_title', type: 'text', label: '카드 3 제목', placeholder: '비우면 카드가 숨겨집니다.' },
        { id: '3_badge', type: 'text', label: '카드 3 뱃지' },
        { id: '3_desc', type: 'text', label: '카드 3 설명' },
        { id: '3_image', type: 'image', label: '카드 3 이미지' },
        { id: '3_bg', type: 'color', label: '카드 3 배경색', default: '#fef9c3' },
        { id: '3_text', type: 'color', label: '카드 3 텍스트색', default: '#713f12' },
        { id: '3_url', type: 'url', label: '카드 3 링크', default: '/products' },
      ],
    },
    {
      id: 'footer',
      name: '푸터',
      settings: [
        { id: 'logo_url', type: 'image', label: '푸터 로고', info: '없으면 쇼핑몰명이 표시됩니다.' },
        { id: 'bg', type: 'color', label: '배경색', default: '#111827' },
        { id: 'text', type: 'color', label: '텍스트 색상', default: '#9ca3af' },
        { id: 'business_info', type: 'textarea', label: '사업자 정보', default: '대표: 홍길동\n사업자번호: 000-00-00000\n통신판매업: 제0000-서울-0000호\n주소: 서울특별시 강남구' },
        { id: 'phone', type: 'text', label: '고객센터 번호', default: '1234-5678' },
        { id: 'hours', type: 'textarea', label: '운영시간', default: '평일 09:00 ~ 18:00\n토/일/공휴일 휴무' },
        { id: 'email', type: 'text', label: '이메일', placeholder: 'cs@myshop.kr' },
        { id: 'instagram', type: 'url', label: '인스타그램 URL', placeholder: 'https://instagram.com/...' },
        { id: 'kakao', type: 'url', label: '카카오톡 채널 URL' },
        { id: 'powered_by', type: 'checkbox', label: 'Powered by Freecart 표시', default: 'false' },
      ],
    },
  ],
};

// ============================================================
// Default settings values
// ============================================================

const DEFAULT_SETTINGS = {
  brand_name: 'My Shop',
  hero_title: '최고의 쇼핑 경험을\n지금 만나보세요',
  hero_subtitle: '엄선된 상품을 합리적인 가격으로',
  hero_bg_color: '#0f172a',
  hero_overlay_opacity: '0.4',
  hero_title_color: '#ffffff',
  hero_subtitle_color: 'rgba(255,255,255,0.75)',
  hero_align: 'center',
  hero_btn_label: '쇼핑 시작하기',
  hero_btn_url: '/products',
  hero_btn_bg: '#ffffff',
  hero_btn_text_color: '#111827',
  footer_bg: '#111827',
  footer_text: '#9ca3af',
  footer_phone: '1234-5678',
  footer_hours: '평일 09:00 ~ 18:00\n토/일/공휴일 휴무',
  footer_business_info: '대표: 홍길동\n사업자번호: 000-00-00000\n통신판매업: 제0000-서울-0000호\n주소: 서울특별시 강남구',
  promo_bg: '#f8fafc',
  promo1_title: '신상품 컬렉션',
  promo1_badge: 'NEW',
  promo1_desc: '이번 시즌 새로 출시된 상품을 만나보세요',
  promo1_bg: '#111827',
  promo1_text: '#ffffff',
  promo1_url: '/products?sort=new',
  promo2_title: '베스트셀러',
  promo2_badge: 'BEST',
  promo2_desc: '가장 많이 사랑받는 인기 상품',
  promo2_bg: '#1e3a5f',
  promo2_text: '#ffffff',
  promo2_url: '/products?sort=best',
  header_bg: '#ffffff',
  header_text_color: '#111827',
};

// ============================================================
// Main
// ============================================================

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

async function uploadFile(path, content, contentType = 'text/html') {
  const blob = new Blob([content], { type: contentType });
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { upsert: true, contentType });

  if (error) throw new Error(`Upload failed [${path}]: ${error.message}`);

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return publicUrl;
}

async function main() {
  console.log('🔐 관리자 로그인 중...');
  const { error: loginErr } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PW,
  });
  if (loginErr) throw new Error(`로그인 실패: ${loginErr.message}`);
  console.log('✓ 로그인 성공');

  // themes 버킷 확인/생성
  const { data: buckets } = await supabase.storage.listBuckets();
  const hasBucket = buckets?.some((b) => b.name === BUCKET);
  if (!hasBucket) {
    await supabase.storage.createBucket(BUCKET, { public: true });
    console.log('✓ themes 버킷 생성');
  }

  // HTML 파일 업로드
  const files = [
    { id: 'header',    content: HEADER_HTML },
    { id: 'noticebar', content: NOTICE_BAR_HTML },
    { id: 'hero',      content: HERO_HTML },
    { id: 'promo',     content: PROMO_BANNER_HTML },
    { id: 'footer',    content: FOOTER_HTML },
  ];

  const sectionHtmlUrls = {};

  for (const { id, content } of files) {
    const path = `themes/${THEME_SLUG}/sections/${id}.html`;
    console.log(`  ↑ ${path}`);
    sectionHtmlUrls[id] = await uploadFile(path, content);
    console.log(`  ✓ → ${sectionHtmlUrls[id]}`);
  }

  // settings.json 업로드
  const settingsPath = `themes/${THEME_SLUG}/settings.json`;
  await uploadFile(settingsPath, JSON.stringify(SETTINGS_JSON, null, 2), 'application/json');
  console.log(`✓ settings.json 업로드`);

  // DB 업데이트
  const { data: theme, error: findErr } = await supabase
    .from('installed_themes')
    .select('id, layout_config')
    .eq('slug', THEME_SLUG)
    .single();

  if (findErr || !theme) throw new Error(`테마를 찾을 수 없음: ${THEME_SLUG}`);

  // homeSections 업데이트 (header/footer 제외한 섹션들)
  const homeSections = [
    { id: 'noticebar', type: 'custom', style: 'html', title: '공지 바',      enabled: true },
    { id: 'hero',      type: 'custom', style: 'html', title: '히어로 배너',  enabled: true },
    { id: 'promo',     type: 'custom', style: 'html', title: '프로모션 배너', enabled: true },
  ];

  const newLayoutConfig = {
    ...(theme.layout_config || {}),
    homeSections,
    header: null,  // header.html로 대체됨
    footer: null,  // footer.html로 대체됨
  };

  const { error: updateErr } = await supabase
    .from('installed_themes')
    .update({
      section_html_urls: sectionHtmlUrls,
      settings_schema: SETTINGS_JSON,
      theme_settings: DEFAULT_SETTINGS,
      layout_config: newLayoutConfig,
    })
    .eq('slug', THEME_SLUG);

  if (updateErr) throw new Error(`DB 업데이트 실패: ${updateErr.message}`);

  console.log('\n✅ 완료!');
  console.log('섹션:', Object.keys(sectionHtmlUrls).join(', '));
  console.log('DB 업데이트: section_html_urls, settings_schema, theme_settings, layout_config');
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
