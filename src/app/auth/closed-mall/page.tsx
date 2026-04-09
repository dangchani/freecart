import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signIn, PENDING_APPROVAL_ERROR } from '@/lib/auth';
import { ThemeSection } from '@/components/theme/ThemeSection';
import { useThemeConfig } from '@/lib/theme';
import { getSettings } from '@/services/settings';

export default function ClosedMallLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const nextPath = searchParams.get('next') || '/';
  const { activeTheme } = useThemeConfig();

  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [siteName, setSiteName] = useState('');
  const [siteDescription, setSiteDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  const { loading: themeLoading, htmlCacheVersion } = useThemeConfig();
  const rawThemeHtmlUrl = activeTheme?.sectionHtmlUrls?.['login-closed-mall'];
  const themeHtmlUrl = rawThemeHtmlUrl ? `${rawThemeHtmlUrl}?v=${htmlCacheVersion}` : undefined;

  useEffect(() => {
    getSettings(['site_name', 'site_description', 'logo_url']).then((s) => {
      setSiteName(s.site_name || 'Freecart');
      setSiteDescription(s.site_description || '');
      setLogoUrl(s.logo_url || '');
    });
  }, []);

  // 테마 HTML이 있을 때: window.__fc_auth API 노출 (테마 JS에서 호출)
  useEffect(() => {
    if (!themeHtmlUrl) return;

    (window as any).__fc_auth = {
      nextPath,
      siteName,
      siteDescription,
      logoUrl,
      submitLogin: async (id: string, pw: string) => {
        try {
          await signIn(id, pw);
          navigate(nextPath);
          return { success: true };
        } catch (err) {
          if (err instanceof Error && err.message === PENDING_APPROVAL_ERROR) {
            return { success: false, error: '관리자 승인 대기 중인 계정입니다.' };
          }
          return { success: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' };
        }
      },
    };

    return () => { delete (window as any).__fc_auth; };
  }, [themeHtmlUrl, nextPath, siteName, siteDescription, logoUrl, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(loginId, password);
      navigate(nextPath);
    } catch (err) {
      if (err instanceof Error && err.message === PENDING_APPROVAL_ERROR) {
        setError('관리자 승인 대기 중인 계정입니다. 승인 후 다시 시도해 주세요.');
      } else {
        setError('아이디 또는 비밀번호가 올바르지 않습니다.');
      }
    } finally {
      setLoading(false);
    }
  }

  // 테마 로딩 중 → 다크 배경만 표시 (기본 폼 깜빡임 방지)
  if (themeLoading) {
    return <div style={{ minHeight: '100vh', background: '#0f172a' }} />;
  }

  // ── 테마 HTML 있음 → 전체 페이지를 테마가 제어 ──
  if (themeHtmlUrl) {
    const settings = {
      site_name: siteName,
      site_description: siteDescription,
      logo_url: logoUrl,
      ...(activeTheme?.themeSettings ?? {}),
    };
    return (
      <ThemeSection
        htmlUrl={themeHtmlUrl}
        settings={settings}
        className="min-h-screen"
        fallback={<div style={{ minHeight: '100vh', background: '#0f172a' }} />}
      />
    );
  }

  // ── 테마 HTML 없음 → 기본 React 폼 ──
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          {logoUrl ? (
            <img src={logoUrl} alt={siteName} className="mx-auto mb-4 h-12 object-contain" />
          ) : (
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-900 text-white font-bold text-lg">
              {siteName.charAt(0)}
            </div>
          )}
          <h1 className="text-2xl font-bold text-gray-900">{siteName}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {siteDescription || '회원 전용 쇼핑몰입니다. 로그인 후 이용해 주세요.'}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
            )}
            <div className="space-y-2">
              <Label htmlFor="loginId">아이디</Label>
              <Input
                id="loginId"
                type="text"
                placeholder="아이디를 입력하세요"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                placeholder="비밀번호를 입력하세요"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '로그인 중...' : '로그인'}
            </Button>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <Link to="/auth/forgot-password" className="hover:underline">비밀번호 찾기</Link>
              <Link to="/auth/signup" className="hover:underline">회원가입</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
