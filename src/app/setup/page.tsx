// joy: 설치 시 입력된 이메일을 super_admin으로 생성.
// super_admin은 최대 2명까지만 허용하고, 2명에 도달하면 페이지에서 안내 화면을 보여준다.
// 관리자 페이지에서 강등되면 다시 생성 가능.
import { useState } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SCHEMA_SQL_URL = 'https://raw.githubusercontent.com/dangchani/freecart/main/supabase/db-schema-full.sql';
const MAX_SUPER_ADMIN = 2;

type Step = 'supabase' | 'database' | 'account' | 'theme' | 'complete' | 'locked';
type DbStatus = 'idle' | 'checking' | 'not_ready' | 'ready' | 'creating_admin' | 'done' | 'uploading_theme' | 'error';

// 기본 테마 섹션 HTML 템플릿
const DEFAULT_SECTION_HTML: Record<string, string> = {
  hero: `<section class="tep" style="background:var(--theme-bg,#f8f8f8);padding:80px 20px;text-align:center;">
  <div style="max-width:var(--theme-max-width,1200px);margin:0 auto;">
    <h1 style="font-size:2.5rem;font-weight:700;color:var(--theme-text,#111);margin-bottom:16px;">{{hero_title | default: 쇼핑몰에 오신 것을 환영합니다}}</h1>
    <p style="font-size:1.1rem;color:var(--theme-text-muted,#666);margin-bottom:32px;">{{hero_subtitle | default: 최고의 상품을 만나보세요}}</p>
    <a href="/products" style="display:inline-block;background:var(--theme-btn-bg,#111);color:var(--theme-btn-text,#fff);padding:14px 36px;border-radius:var(--theme-btn-radius,6px);font-weight:600;text-decoration:none;">쇼핑하기</a>
  </div>
</section>`,

  features: `<section class="tep" style="background:var(--theme-bg-secondary,#fff);padding:60px 20px;">
  <div style="max-width:var(--theme-max-width,1200px);margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:32px;text-align:center;">
    <div>
      <div style="font-size:2rem;margin-bottom:12px;">🚚</div>
      <h3 style="font-weight:600;color:var(--theme-text,#111);margin-bottom:8px;">무료 배송</h3>
      <p style="color:var(--theme-text-muted,#666);font-size:.9rem;">5만원 이상 구매 시 무료 배송</p>
    </div>
    <div>
      <div style="font-size:2rem;margin-bottom:12px;">🔄</div>
      <h3 style="font-weight:600;color:var(--theme-text,#111);margin-bottom:8px;">간편 반품</h3>
      <p style="color:var(--theme-text-muted,#666);font-size:.9rem;">30일 이내 무료 반품</p>
    </div>
    <div>
      <div style="font-size:2rem;margin-bottom:12px;">🔒</div>
      <h3 style="font-weight:600;color:var(--theme-text,#111);margin-bottom:8px;">안전 결제</h3>
      <p style="color:var(--theme-text-muted,#666);font-size:.9rem;">암호화된 안전한 결제</p>
    </div>
    <div>
      <div style="font-size:2rem;margin-bottom:12px;">💬</div>
      <h3 style="font-weight:600;color:var(--theme-text,#111);margin-bottom:8px;">고객 지원</h3>
      <p style="color:var(--theme-text-muted,#666);font-size:.9rem;">평일 9시~18시 상담</p>
    </div>
  </div>
</section>`,

  categories: `<section class="tep" style="background:var(--theme-bg,#f8f8f8);padding:60px 20px;">
  <div style="max-width:var(--theme-max-width,1200px);margin:0 auto;">
    <h2 style="text-align:center;font-size:1.8rem;font-weight:700;color:var(--theme-text,#111);margin-bottom:40px;">카테고리</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px;">
      <a href="/categories" style="display:block;background:var(--theme-bg-secondary,#fff);border-radius:var(--theme-card-radius,8px);padding:24px 16px;text-align:center;text-decoration:none;color:var(--theme-text,#111);font-weight:500;box-shadow:0 1px 3px rgba(0,0,0,.08);">전체 상품</a>
    </div>
  </div>
</section>`,

  'new-products': `<section class="tep" style="background:var(--theme-bg-secondary,#fff);padding:60px 20px;">
  <div style="max-width:var(--theme-max-width,1200px);margin:0 auto;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:32px;">
      <h2 style="font-size:1.8rem;font-weight:700;color:var(--theme-text,#111);">신상품</h2>
      <a href="/products?sort=newest" style="color:var(--theme-primary,#2563eb);font-size:.9rem;text-decoration:none;">전체보기 →</a>
    </div>
    <p style="color:var(--theme-text-muted,#666);text-align:center;padding:40px 0;">상품이 등록되면 여기에 표시됩니다.</p>
  </div>
</section>`,

  'best-products': `<section class="tep" style="background:var(--theme-bg,#f8f8f8);padding:60px 20px;">
  <div style="max-width:var(--theme-max-width,1200px);margin:0 auto;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:32px;">
      <h2 style="font-size:1.8rem;font-weight:700;color:var(--theme-text,#111);">베스트셀러</h2>
      <a href="/products?sort=best" style="color:var(--theme-primary,#2563eb);font-size:.9rem;text-decoration:none;">전체보기 →</a>
    </div>
    <p style="color:var(--theme-text-muted,#666);text-align:center;padding:40px 0;">상품이 등록되면 여기에 표시됩니다.</p>
  </div>
</section>`,

  reviews: `<section class="tep" style="background:var(--theme-bg-secondary,#fff);padding:60px 20px;">
  <div style="max-width:var(--theme-max-width,1200px);margin:0 auto;">
    <h2 style="text-align:center;font-size:1.8rem;font-weight:700;color:var(--theme-text,#111);margin-bottom:40px;">고객 후기</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px;">
      <div style="background:var(--theme-bg,#f8f8f8);border-radius:var(--theme-card-radius,8px);padding:24px;">
        <div style="color:#f59e0b;margin-bottom:8px;">★★★★★</div>
        <p style="color:var(--theme-text,#111);margin-bottom:12px;">"정말 만족스러운 쇼핑이었습니다!"</p>
        <span style="color:var(--theme-text-muted,#666);font-size:.85rem;">- 고객님</span>
      </div>
      <div style="background:var(--theme-bg,#f8f8f8);border-radius:var(--theme-card-radius,8px);padding:24px;">
        <div style="color:#f59e0b;margin-bottom:8px;">★★★★★</div>
        <p style="color:var(--theme-text,#111);margin-bottom:12px;">"배송이 빠르고 상품 품질이 좋아요."</p>
        <span style="color:var(--theme-text-muted,#666);font-size:.85rem;">- 고객님</span>
      </div>
      <div style="background:var(--theme-bg,#f8f8f8);border-radius:var(--theme-card-radius,8px);padding:24px;">
        <div style="color:#f59e0b;margin-bottom:8px;">★★★★★</div>
        <p style="color:var(--theme-text,#111);margin-bottom:12px;">"또 구매하고 싶은 쇼핑몰입니다."</p>
        <span style="color:var(--theme-text-muted,#666);font-size:.85rem;">- 고객님</span>
      </div>
    </div>
  </div>
</section>`,

  newsletter: `<section class="tep" style="background:var(--theme-primary,#2563eb);padding:60px 20px;text-align:center;">
  <div style="max-width:600px;margin:0 auto;">
    <h2 style="font-size:1.8rem;font-weight:700;color:#fff;margin-bottom:12px;">뉴스레터 구독</h2>
    <p style="color:rgba(255,255,255,.8);margin-bottom:32px;">신상품 소식과 특별 혜택을 가장 먼저 받아보세요.</p>
    <form style="display:flex;gap:12px;max-width:420px;margin:0 auto;" onsubmit="return false;">
      <input type="email" placeholder="이메일 주소" style="flex:1;padding:12px 16px;border-radius:var(--theme-btn-radius,6px);border:none;font-size:.95rem;" />
      <button type="submit" style="background:#fff;color:var(--theme-primary,#2563eb);padding:12px 24px;border-radius:var(--theme-btn-radius,6px);border:none;font-weight:600;cursor:pointer;white-space:nowrap;">구독하기</button>
    </form>
  </div>
</section>`,

  cta: `<section class="tep" style="background:var(--theme-bg,#f8f8f8);padding:80px 20px;text-align:center;">
  <div style="max-width:var(--theme-max-width,1200px);margin:0 auto;">
    <h2 style="font-size:2rem;font-weight:700;color:var(--theme-text,#111);margin-bottom:16px;">지금 바로 시작하세요</h2>
    <p style="color:var(--theme-text-muted,#666);margin-bottom:32px;">특별한 혜택과 함께 쇼핑을 시작해보세요.</p>
    <a href="/products" style="display:inline-block;background:var(--theme-btn-bg,#111);color:var(--theme-btn-text,#fff);padding:16px 48px;border-radius:var(--theme-btn-radius,6px);font-weight:700;text-decoration:none;font-size:1.05rem;">쇼핑 시작하기</a>
  </div>
</section>`,

  // ── 인증 페이지 섹션 ──
  login: `<section class="tep" style="background:linear-gradient(135deg,var(--theme-primary,#2563eb),#7c3aed);padding:32px 20px;text-align:center;">
  <div style="max-width:600px;margin:0 auto;color:#fff;">
    <p style="font-size:1rem;font-weight:500;margin:0;">회원이 되시면 포인트 적립·쿠폰·무료배송 혜택을 누리세요!</p>
  </div>
</section>`,

  signup: `<section class="tep" style="background:var(--theme-bg-secondary,#fff);border-bottom:1px solid #e5e7eb;padding:28px 20px;">
  <div style="max-width:600px;margin:0 auto;display:flex;flex-wrap:wrap;gap:20px;justify-content:center;text-align:center;">
    <div style="flex:1;min-width:120px;">
      <div style="font-size:1.5rem;margin-bottom:4px;">🎁</div>
      <p style="font-size:.85rem;color:var(--theme-text-muted,#666);margin:0;">가입 즉시<br/><strong style="color:var(--theme-text,#111);">웰컴 쿠폰</strong></p>
    </div>
    <div style="flex:1;min-width:120px;">
      <div style="font-size:1.5rem;margin-bottom:4px;">⭐</div>
      <p style="font-size:.85rem;color:var(--theme-text-muted,#666);margin:0;">구매마다<br/><strong style="color:var(--theme-text,#111);">포인트 적립</strong></p>
    </div>
    <div style="flex:1;min-width:120px;">
      <div style="font-size:1.5rem;margin-bottom:4px;">🚚</div>
      <p style="font-size:.85rem;color:var(--theme-text-muted,#666);margin:0;">5만원 이상<br/><strong style="color:var(--theme-text,#111);">무료 배송</strong></p>
    </div>
    <div style="flex:1;min-width:120px;">
      <div style="font-size:1.5rem;margin-bottom:4px;">👑</div>
      <p style="font-size:.85rem;color:var(--theme-text-muted,#666);margin:0;">등급별<br/><strong style="color:var(--theme-text,#111);">VIP 혜택</strong></p>
    </div>
  </div>
</section>`,

  'forgot-password': `<section class="tep" style="background:var(--theme-bg-secondary,#f9fafb);border-bottom:1px solid #e5e7eb;padding:20px;text-align:center;">
  <p style="color:var(--theme-text-muted,#666);font-size:.9rem;margin:0;">아이디/비밀번호가 기억나지 않으시면 고객센터로 문의해 주세요.</p>
</section>`,

  'pending-approval': `<section class="tep" style="background:#fffbeb;border-bottom:1px solid #fde68a;padding:20px;text-align:center;">
  <p style="color:#92400e;font-size:.9rem;margin:0;">⏳ 가입 승인 후 모든 서비스를 이용하실 수 있습니다. 승인은 보통 1~2 영업일 내에 처리됩니다.</p>
</section>`,

  'login-closed-mall': `<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f9fafb;padding:16px;">
  <div style="width:100%;max-width:420px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:14px;background:#111;color:#fff;font-size:1.3rem;font-weight:700;margin-bottom:16px;" id="fc-logo">F</div>
      <h1 style="font-size:1.5rem;font-weight:700;color:#111;margin:0 0 6px;" id="fc-site-name">쇼핑몰</h1>
      <p style="font-size:.875rem;color:#6b7280;margin:0;" id="fc-site-desc">회원 전용 쇼핑몰입니다. 로그인 후 이용해 주세요.</p>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:32px;box-shadow:0 1px 4px rgba(0,0,0,.06);">
      <div id="fc-error" style="display:none;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;font-size:.875rem;color:#dc2626;margin-bottom:16px;"></div>
      <form id="fc-login-form" style="display:flex;flex-direction:column;gap:18px;">
        <div>
          <label for="fc-id" style="display:block;font-size:.875rem;font-weight:500;color:#374151;margin-bottom:6px;">아이디</label>
          <input id="fc-id" type="text" placeholder="아이디를 입력하세요" autofocus
            style="width:100%;height:40px;border:1px solid #d1d5db;border-radius:8px;padding:0 12px;font-size:.875rem;box-sizing:border-box;outline:none;transition:border-color .15s;"
            onfocus="this.style.borderColor='#6366f1'" onblur="this.style.borderColor='#d1d5db'" required />
        </div>
        <div>
          <label for="fc-pw" style="display:block;font-size:.875rem;font-weight:500;color:#374151;margin-bottom:6px;">비밀번호</label>
          <input id="fc-pw" type="password" placeholder="비밀번호를 입력하세요"
            style="width:100%;height:40px;border:1px solid #d1d5db;border-radius:8px;padding:0 12px;font-size:.875rem;box-sizing:border-box;outline:none;transition:border-color .15s;"
            onfocus="this.style.borderColor='#6366f1'" onblur="this.style.borderColor='#d1d5db'" required />
        </div>
        <button id="fc-submit" type="submit"
          style="height:42px;background:#111;color:#fff;border:none;border-radius:8px;font-size:.9rem;font-weight:600;cursor:pointer;transition:background .15s;"
          onmouseover="this.style.background='#374151'" onmouseout="this.style.background='#111'">로그인</button>
      </form>
      <div style="display:flex;justify-content:space-between;margin-top:18px;font-size:.85rem;color:#6b7280;">
        <a href="/auth/forgot-password" style="color:#6b7280;text-decoration:none;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">비밀번호 찾기</a>
        <a href="/auth/signup" style="color:#6b7280;text-decoration:none;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">회원가입</a>
      </div>
    </div>
  </div>
  <script>
    (function() {
      var auth = window.__fc_auth;
      if (!auth) return;
      var logo = document.getElementById('fc-logo');
      var nameEl = document.getElementById('fc-site-name');
      var descEl = document.getElementById('fc-site-desc');
      if (nameEl && auth.siteName) { nameEl.textContent = auth.siteName; if(logo) logo.textContent = auth.siteName.charAt(0); }
      if (descEl && auth.siteDescription) descEl.textContent = auth.siteDescription;
      var form = document.getElementById('fc-login-form');
      var errEl = document.getElementById('fc-error');
      var btn = document.getElementById('fc-submit');
      if (!form) return;
      form.addEventListener('submit', async function(e) {
        e.preventDefault();
        var id = document.getElementById('fc-id').value.trim();
        var pw = document.getElementById('fc-pw').value;
        if (!id || !pw) return;
        btn.disabled = true; btn.textContent = '로그인 중...';
        errEl.style.display = 'none';
        var result = await auth.submitLogin(id, pw);
        if (result && result.error) {
          errEl.textContent = result.error;
          errEl.style.display = 'block';
        }
        btn.disabled = false; btn.textContent = '로그인';
      });
    })();
  </script>
</div>`,

  // ── 상품/쇼핑 섹션 ──
  'product-list': `<section class="tep" style="background:linear-gradient(135deg,var(--theme-primary,#2563eb)15,#eff6ff);padding:24px 20px;">
  <div style="max-width:var(--theme-max-width,1200px);margin:0 auto;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
    <div>
      <h2 style="font-size:1.1rem;font-weight:700;color:var(--theme-text,#111);margin:0 0 4px;">전체 상품</h2>
      <p style="color:var(--theme-text-muted,#666);font-size:.85rem;margin:0;">다양한 상품을 만나보세요</p>
    </div>
    <a href="/products/search" style="background:var(--theme-primary,#2563eb);color:#fff;padding:8px 20px;border-radius:var(--theme-btn-radius,6px);font-size:.85rem;font-weight:600;text-decoration:none;">상품 검색</a>
  </div>
</section>`,

  'product-detail': `<section class="tep" style="background:var(--theme-bg-secondary,#f9fafb);border-bottom:1px solid #e5e7eb;padding:12px 20px;">
  <div style="max-width:var(--theme-max-width,1200px);margin:0 auto;display:flex;gap:24px;flex-wrap:wrap;font-size:.82rem;color:var(--theme-text-muted,#666);">
    <span>✅ 정품 보장</span>
    <span>🚚 오늘 주문 시 내일 출고</span>
    <span>🔄 30일 무료 반품</span>
    <span>🔒 안전한 결제</span>
  </div>
</section>`,

  cart: `<section class="tep" style="background:#eff6ff;border-bottom:1px solid #bfdbfe;padding:14px 20px;">
  <div style="max-width:var(--theme-max-width,1200px);margin:0 auto;text-align:center;font-size:.9rem;color:#1d4ed8;font-weight:500;">
    🎉 5만원 이상 구매 시 무료배송! 쿠폰도 함께 사용해보세요.
  </div>
</section>`,

  checkout: `<section class="tep" style="background:var(--theme-bg-secondary,#f9fafb);border-bottom:1px solid #e5e7eb;padding:14px 20px;">
  <div style="max-width:var(--theme-max-width,1200px);margin:0 auto;display:flex;gap:20px;justify-content:center;flex-wrap:wrap;font-size:.82rem;color:var(--theme-text-muted,#666);">
    <span>🔒 SSL 암호화 결제</span>
    <span>✅ 신뢰할 수 있는 PG사</span>
    <span>📞 결제 문제 즉시 지원</span>
    <span>🔄 환불 보장</span>
  </div>
</section>`,

  'checkout-success': `<section class="tep" style="background:#f0fdf4;border-bottom:1px solid #bbf7d0;padding:16px 20px;text-align:center;">
  <p style="color:#166534;font-size:.9rem;font-weight:500;margin:0;">✅ 주문이 완료되었습니다! 마이페이지에서 주문 현황을 확인하실 수 있습니다.</p>
</section>`,

  search: `<section class="tep" style="background:var(--theme-bg-secondary,#f9fafb);border-bottom:1px solid #e5e7eb;padding:16px 20px;">
  <div style="max-width:var(--theme-max-width,1200px);margin:0 auto;">
    <p style="color:var(--theme-text-muted,#666);font-size:.9rem;margin:0;">원하시는 상품을 검색해보세요. 카테고리·가격·브랜드로 필터링할 수 있습니다.</p>
  </div>
</section>`,

  category: `<section class="tep" style="background:linear-gradient(to right,var(--theme-bg-secondary,#f9fafb),var(--theme-bg,#fff));padding:20px;border-bottom:1px solid #e5e7eb;">
  <div style="max-width:var(--theme-max-width,1200px);margin:0 auto;">
    <p style="color:var(--theme-text-muted,#666);font-size:.9rem;margin:0;">카테고리별 다양한 상품을 찾아보세요.</p>
  </div>
</section>`,

  // ── 커뮤니티 섹션 ──
  boards: `<section class="tep" style="background:linear-gradient(135deg,#f5f3ff,#ede9fe);padding:28px 20px;border-bottom:1px solid #ddd6fe;">
  <div style="max-width:var(--theme-max-width,1200px);margin:0 auto;text-align:center;">
    <h2 style="font-size:1.3rem;font-weight:700;color:#4c1d95;margin-bottom:6px;">커뮤니티</h2>
    <p style="color:#6d28d9;font-size:.9rem;margin:0;">고객님들과 소통하는 공간입니다. 자유롭게 게시글을 작성해보세요.</p>
  </div>
</section>`,

  board: `<section class="tep" style="background:var(--theme-bg-secondary,#f9fafb);border-bottom:1px solid #e5e7eb;padding:16px 20px;">
  <div style="max-width:var(--theme-max-width,1200px);margin:0 auto;">
    <p style="color:var(--theme-text-muted,#666);font-size:.85rem;margin:0;">커뮤니티 게시판입니다. 건전한 소통 문화를 만들어 주세요.</p>
  </div>
</section>`,

  notices: `<section class="tep" style="background:linear-gradient(135deg,#fef3c7,#fffbeb);padding:24px 20px;border-bottom:1px solid #fde68a;">
  <div style="max-width:var(--theme-max-width,1200px);margin:0 auto;text-align:center;">
    <h2 style="font-size:1.2rem;font-weight:700;color:#92400e;margin-bottom:4px;">📢 공지사항</h2>
    <p style="color:#b45309;font-size:.85rem;margin:0;">쇼핑몰 운영 관련 중요 공지를 확인하세요.</p>
  </div>
</section>`,

  faqs: `<section class="tep" style="background:linear-gradient(135deg,#f0f9ff,#e0f2fe);padding:28px 20px;border-bottom:1px solid #bae6fd;">
  <div style="max-width:var(--theme-max-width,1200px);margin:0 auto;text-align:center;">
    <h2 style="font-size:1.2rem;font-weight:700;color:#0c4a6e;margin-bottom:6px;">❓ 자주 묻는 질문</h2>
    <p style="color:#0369a1;font-size:.85rem;margin:0;">궁금하신 점은 FAQ에서 빠르게 해결하세요. 답변이 없으면 1:1 문의를 이용해 주세요.</p>
  </div>
</section>`,

  // ── 브랜드 ──
  brands: `<section class="tep" style="background:linear-gradient(135deg,var(--theme-bg-secondary,#f9fafb),var(--theme-bg,#fff));padding:24px 20px;border-bottom:1px solid #e5e7eb;">
  <div style="max-width:var(--theme-max-width,1200px);margin:0 auto;text-align:center;">
    <h2 style="font-size:1.2rem;font-weight:700;color:var(--theme-text,#111);margin-bottom:4px;">🏷️ 브랜드</h2>
    <p style="color:var(--theme-text-muted,#666);font-size:.85rem;margin:0;">다양한 브랜드의 상품을 한 곳에서 만나보세요.</p>
  </div>
</section>`,

  // ── 마이페이지 ──
  mypage: `<section class="tep" style="background:linear-gradient(135deg,var(--theme-primary,#2563eb),#1e40af);padding:28px 20px;">
  <div style="max-width:var(--theme-max-width,1200px);margin:0 auto;color:#fff;">
    <p style="font-size:1rem;font-weight:600;margin:0 0 4px;">나의 쇼핑 현황</p>
    <p style="font-size:.85rem;color:rgba(255,255,255,.8);margin:0;">주문·포인트·쿠폰·배송지를 한눈에 관리하세요.</p>
  </div>
</section>`,

  // ── 404 ──
  'not-found': `<section class="tep" style="background:var(--theme-bg-secondary,#f9fafb);padding:20px;border-bottom:1px solid #e5e7eb;text-align:center;">
  <p style="color:var(--theme-text-muted,#666);font-size:.9rem;margin:0;">찾으시는 페이지가 없으신가요? <a href="/products" style="color:var(--theme-primary,#2563eb);text-decoration:none;font-weight:600;">상품 목록</a>이나 <a href="/" style="color:var(--theme-primary,#2563eb);text-decoration:none;font-weight:600;">홈</a>으로 이동해보세요.</p>
</section>`,
};

export default function SetupPage() {
  const [step, setStep] = useState<Step>('supabase');
  const [form, setForm] = useState({
    supabaseUrl: '',
    supabaseAnonKey: '',
    supabaseServiceRoleKey: '',
  });

  // 계정 입력
  const [account, setAccount] = useState({ email: '', password: '', name: '' });
  const [superAdminCount, setSuperAdminCount] = useState(0);

  // DB step
  const [sqlCopied, setSqlCopied] = useState(false);
  const [dbStatus, setDbStatus] = useState<DbStatus>('idle');
  const [themeProgress, setThemeProgress] = useState<{ done: number; total: number; current: string }>({ done: 0, total: 0, current: '' });
  const [dbMessage, setDbMessage] = useState('');
  const [error, setError] = useState('');

  function getAdminClient(): SupabaseClient {
    return createClient(
      form.supabaseUrl.trim(),
      form.supabaseServiceRoleKey.trim(),
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }

  // Step 1 → DB
  function handleSupabaseNext(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.supabaseUrl.trim() || !form.supabaseAnonKey.trim() || !form.supabaseServiceRoleKey.trim()) {
      setError('모든 필드를 입력해주세요.');
      return;
    }
    setStep('database');
  }

  async function handleCopySQL() {
    try {
      const res = await fetch(SCHEMA_SQL_URL);
      if (!res.ok) throw new Error('SQL 파일을 가져올 수 없습니다.');
      const sql = await res.text();
      await navigator.clipboard.writeText(sql);
      setSqlCopied(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SQL 복사 실패');
    }
  }

  // Step 2: DB 확인 + super_admin 수 체크
  async function handleVerifyDb() {
    setDbStatus('checking');
    setDbMessage('');
    setError('');
    try {
      const supabase = getAdminClient();
      const { data: settings, error: settingsError } = await supabase
        .from('settings')
        .select('key')
        .eq('key', 'schema_version')
        .single();

      if (settingsError || !settings) {
        setDbStatus('not_ready');
        setDbMessage('DB 스키마가 아직 적용되지 않았습니다.\nSQL을 복사하여 Supabase SQL Editor에서 실행해주세요.');
        return;
      }

      const { count } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'super_admin');
      const c = count ?? 0;
      setSuperAdminCount(c);

      if (c >= MAX_SUPER_ADMIN) {
        setDbStatus('ready');
        setStep('locked');
        return;
      }

      setDbStatus('ready');
      setDbMessage(`DB 확인 완료. 현재 super_admin: ${c}/${MAX_SUPER_ADMIN}`);
      setStep('account');
    } catch (err) {
      setDbStatus('error');
      setError(err instanceof Error ? err.message : 'DB 확인 중 오류가 발생했습니다.');
    }
  }

  // Step 3: super_admin 계정 생성
  async function handleCreateSuperAdmin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!account.email.trim() || !account.password.trim() || !account.name.trim()) {
      setError('모든 필드를 입력해주세요.');
      return;
    }
    if (account.password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }

    setDbStatus('creating_admin');
    try {
      const supabase = getAdminClient();

      // 개수 재확인 (race condition 방지)
      const { count } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'super_admin');
      if ((count ?? 0) >= MAX_SUPER_ADMIN) {
        setStep('locked');
        setSuperAdminCount(count ?? 0);
        return;
      }

      // 기존 사용자 확인
      const { data: existing } = await supabase
        .from('users')
        .select('id, role')
        .eq('email', account.email.trim())
        .maybeSingle();

      if (existing) {
        // 기존 계정을 super_admin으로 승격
        const { error: upErr } = await supabase
          .from('users')
          .update({ role: 'super_admin', is_approved: true, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (upErr) throw upErr;
      } else {
        // 신규 생성
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: account.email.trim(),
          password: account.password,
          email_confirm: true,
          user_metadata: { name: account.name.trim(), role: 'super_admin' },
        });
        if (authError) throw authError;

        await new Promise((r) => setTimeout(r, 1500));

        const { data: defaultLevel } = await supabase
          .from('user_levels')
          .select('id')
          .order('level', { ascending: true })
          .limit(1)
          .single();

        const { error: profileError } = await supabase.from('users').upsert({
          id: authData.user.id,
          email: account.email.trim(),
          name: account.name.trim(),
          role: 'super_admin',
          is_approved: true,
          level_id: defaultLevel?.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        if (profileError) throw profileError;
      }

      setDbStatus('done');
      setStep('theme');
    } catch (err) {
      setDbStatus('error');
      setError(err instanceof Error ? err.message : '계정 생성 중 오류가 발생했습니다.');
    }
  }

  // Step 4: 기본 테마 HTML 업로드
  async function handleInstallDefaultTheme() {
    setError('');
    setDbStatus('uploading_theme');

    try {
      const supabase = getAdminClient();
      const BUCKET = 'themes';
      const THEME_SLUG = 'default-shop';

      // 버킷 존재 확인 및 생성
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets?.some((b: any) => b.name === BUCKET);
      if (!bucketExists) {
        await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 10485760 });
      }

      const sections = Object.keys(DEFAULT_SECTION_HTML);
      setThemeProgress({ done: 0, total: sections.length, current: '' });
      const sectionHtmlUrls: Record<string, string> = {};

      for (let i = 0; i < sections.length; i++) {
        const sectionId = sections[i];
        setThemeProgress({ done: i, total: sections.length, current: sectionId });

        const html = DEFAULT_SECTION_HTML[sectionId];
        const filePath = `${THEME_SLUG}/sections/${sectionId}.html`;
        const blob = new Blob([html], { type: 'text/html' });

        const { error: uploadErr } = await supabase.storage
          .from(BUCKET)
          .upload(filePath, blob, { cacheControl: '3600', upsert: true });

        if (uploadErr) throw new Error(`${sectionId} 업로드 실패: ${uploadErr.message}`);

        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
        sectionHtmlUrls[sectionId] = urlData.publicUrl;
      }

      setThemeProgress({ done: sections.length, total: sections.length, current: '' });

      // installed_themes 업데이트
      const { error: updateErr } = await supabase
        .from('installed_themes')
        .update({ section_html_urls: sectionHtmlUrls })
        .eq('slug', THEME_SLUG);

      if (updateErr) throw new Error(`테마 DB 업데이트 실패: ${updateErr.message}`);

      setDbStatus('done');
      setStep('complete');
    } catch (err) {
      setDbStatus('error');
      setError(err instanceof Error ? err.message : '테마 초기화 중 오류가 발생했습니다.');
    }
  }

  // 테마 초기화 건너뛰기
  function skipThemeInstall() {
    setStep('complete');
  }

  // locked 단계에서 강등 후 재시도 체크
  async function recheckSuperAdminCount() {
    try {
      const supabase = getAdminClient();
      const { count } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'super_admin');
      const c = count ?? 0;
      setSuperAdminCount(c);
      if (c < MAX_SUPER_ADMIN) {
        setStep('account');
        setError('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '재확인 실패');
    }
  }

  function getSqlEditorUrl() {
    try {
      const url = new URL(form.supabaseUrl.trim());
      const projectRef = url.hostname.split('.')[0];
      return `https://supabase.com/dashboard/project/${projectRef}/sql/new`;
    } catch {
      return 'https://supabase.com/dashboard';
    }
  }

  const stepOrder: Step[] = ['supabase', 'database', 'account', 'theme', 'complete'];
  const currentIdx = stepOrder.indexOf(step === 'locked' ? 'account' : step);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-lg p-8">
        {/* 헤더 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Freecart 초기 설정</h1>
          <div className="flex items-center gap-2 mt-3">
            {stepOrder.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    step === s
                      ? 'bg-blue-600 text-white'
                      : i < currentIdx
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {i < currentIdx ? '✓' : i + 1}
                </div>
                {i < stepOrder.length - 1 && <div className="w-8 h-0.5 bg-gray-200" />}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {step === 'supabase' && 'Step 1: Supabase 연결'}
            {step === 'database' && 'Step 2: DB 초기화'}
            {step === 'account' && 'Step 3: 최고 관리자 계정 생성'}
            {step === 'locked' && 'Step 3: 생성 제한'}
            {step === 'theme' && 'Step 4: 기본 테마 초기화'}
            {step === 'complete' && '설정 완료'}
          </p>
        </div>

        {/* Step 1 */}
        {step === 'supabase' && (
          <form onSubmit={handleSupabaseNext} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supabase Project URL <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                placeholder="https://xxxxxxxxxxxx.supabase.co"
                value={form.supabaseUrl}
                onChange={(e) => setForm({ ...form, supabaseUrl: e.target.value })}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Anon (Public) Key <span className="text-red-500">*</span>
              </label>
              <textarea
                placeholder="eyJhbGciOiJIUzI1NiIs..."
                value={form.supabaseAnonKey}
                onChange={(e) => setForm({ ...form, supabaseAnonKey: e.target.value })}
                required
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Service Role Key <span className="text-red-500">*</span>
              </label>
              <textarea
                placeholder="eyJhbGciOiJIUzI1NiIs..."
                value={form.supabaseServiceRoleKey}
                onChange={(e) => setForm({ ...form, supabaseServiceRoleKey: e.target.value })}
                required
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">Supabase Dashboard → Settings → API</p>
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
            )}
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm"
            >
              다음 →
            </button>
          </form>
        )}

        {/* Step 2 */}
        {step === 'database' && (
          <div className="space-y-5">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">1. DB 스키마 SQL 복사</p>
              <p className="text-xs text-gray-500 mb-3">
                아래 버튼으로 SQL을 복사한 뒤, Supabase SQL Editor에서 실행하세요.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleCopySQL}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                    sqlCopied
                      ? 'bg-green-100 text-green-700 border border-green-300'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {sqlCopied ? '✓ SQL 복사됨' : 'SQL 복사'}
                </button>
                <a
                  href={getSqlEditorUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 rounded-lg text-sm font-medium text-center border border-gray-300 hover:bg-gray-100"
                >
                  SQL Editor 열기 ↗
                </a>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">2. DB 스키마 확인</p>
              <p className="text-xs text-gray-500 mb-3">SQL 실행 후 아래 버튼을 눌러 확인합니다.</p>
              <button
                onClick={handleVerifyDb}
                disabled={dbStatus === 'checking'}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-lg text-sm"
              >
                {dbStatus === 'checking' ? 'DB 확인 중...' : 'DB 확인'}
              </button>
              {dbMessage && (
                <div
                  className={`mt-3 rounded-lg px-3 py-2 text-xs whitespace-pre-line ${
                    dbStatus === 'ready'
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : dbStatus === 'not_ready'
                        ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                        : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {dbMessage}
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            <button
              onClick={() => { setStep('supabase'); setError(''); }}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              ← 이전 단계
            </button>
          </div>
        )}

        {/* Step 3: 계정 생성 */}
        {step === 'account' && (
          <form onSubmit={handleCreateSuperAdmin} className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-800">
              현재 super_admin 계정: <strong>{superAdminCount}/{MAX_SUPER_ADMIN}</strong>
              <br />
              입력한 이메일이 최고 관리자(super_admin) 계정으로 등록됩니다.
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이메일 <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={account.email}
                onChange={(e) => setAccount({ ...account, email: e.target.value })}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                비밀번호 <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={account.password}
                onChange={(e) => setAccount({ ...account, password: e.target.value })}
                required
                minLength={8}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">8자 이상</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이름 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={account.name}
                onChange={(e) => setAccount({ ...account, name: e.target.value })}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
            )}
            <button
              type="submit"
              disabled={dbStatus === 'creating_admin'}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-lg text-sm"
            >
              {dbStatus === 'creating_admin' ? '생성 중...' : 'super_admin 계정 생성'}
            </button>
          </form>
        )}

        {/* Step 4: 기본 테마 초기화 */}
        {step === 'theme' && (
          <div className="space-y-5">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-blue-800 mb-1">기본 쇼핑몰 테마 초기화</p>
              <p className="text-xs text-blue-700 leading-relaxed">
                <strong>default-shop</strong> 테마의 섹션 HTML 파일을 Supabase Storage에 업로드합니다.<br />
                Hero, 특징, 카테고리, 신상품, 베스트, 후기, 뉴스레터 등 8개 섹션이 설치됩니다.
              </p>
            </div>

            {dbStatus === 'uploading_theme' && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent flex-shrink-0" />
                  <span className="text-sm text-gray-700">업로드 중...</span>
                </div>
                {themeProgress.total > 0 && (
                  <>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${(themeProgress.done / themeProgress.total) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      {themeProgress.done}/{themeProgress.total}
                      {themeProgress.current && ` — ${themeProgress.current}.html`}
                    </p>
                  </>
                )}
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            <button
              onClick={handleInstallDefaultTheme}
              disabled={dbStatus === 'uploading_theme'}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-lg text-sm"
            >
              {dbStatus === 'uploading_theme' ? '업로드 중...' : '기본 테마 초기화'}
            </button>
            <button
              onClick={skipThemeInstall}
              disabled={dbStatus === 'uploading_theme'}
              className="w-full text-sm text-gray-400 hover:text-gray-600 disabled:opacity-40"
            >
              건너뛰기 (나중에 직접 업로드)
            </button>
          </div>
        )}

        {/* locked */}
        {step === 'locked' && (
          <div className="text-center py-4 space-y-4">
            <div className="text-5xl">🔒</div>
            <p className="text-lg font-semibold text-gray-800">생성 제한</p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-left text-sm text-yellow-800">
              super_admin 계정이 이미 최대({MAX_SUPER_ADMIN}명)에 도달했습니다.
              <br />
              <br />
              새 super_admin을 만들려면 기존 관리자 페이지에서 한 명을 강등해 주세요.
              <br />
              강등 후 아래 "재확인" 버튼을 누르면 다시 생성할 수 있습니다.
            </div>
            <div className="text-xs text-gray-500">현재: {superAdminCount}/{MAX_SUPER_ADMIN}</div>
            <button
              onClick={recheckSuperAdminCount}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm"
            >
              재확인
            </button>
            <a
              href="/auth/login"
              className="block text-sm text-gray-500 hover:text-gray-700"
            >
              로그인 페이지로 이동
            </a>
          </div>
        )}

        {/* complete */}
        {step === 'complete' && (
          <div className="text-center py-6">
            <div className="text-5xl mb-4">✅</div>
            <p className="text-lg font-semibold text-gray-800 mb-4">초기 설정 완료!</p>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-left mb-4">
              <p className="text-sm font-semibold text-blue-800 mb-3">최고 관리자(super_admin) 계정</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-blue-600 font-medium w-20">이메일</span>
                  <code className="text-sm bg-white border border-blue-200 rounded px-2 py-0.5 text-blue-900 font-mono">
                    {account.email}
                  </code>
                </div>
              </div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-left mb-6">
              <p className="text-xs text-yellow-800">
                ⚠️ 이 계정은 모든 권한을 가진 최고 관리자입니다. 비밀번호를 안전하게 보관하세요.
              </p>
            </div>
            <a
              href="/auth/login"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-6 rounded-lg text-sm"
            >
              로그인 페이지로 이동
            </a>
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">
            super_admin은 최대 {MAX_SUPER_ADMIN}명까지 등록 가능합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
