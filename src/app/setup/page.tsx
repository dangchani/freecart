// joy: 설치 시 입력된 이메일을 super_admin으로 생성.
// super_admin은 최대 2명까지만 허용하고, 2명에 도달하면 페이지에서 안내 화면을 보여준다.
// 관리자 페이지에서 강등되면 다시 생성 가능.
import { useState } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SCHEMA_SQL_URL = 'https://raw.githubusercontent.com/dangchani/freecart/main/supabase/db-schema-full.sql';
const MAX_SUPER_ADMIN = 2;

type Step = 'supabase' | 'database' | 'account' | 'theme' | 'complete' | 'locked';
type DbStatus = 'idle' | 'checking' | 'not_ready' | 'ready' | 'creating_admin' | 'done' | 'uploading_theme' | 'error';

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

      // 1. 섹션 HTML을 스토어 API에서 가져옴 — 단일 소스 (freecart-web/lib/default-theme-sections.ts)
      //    store_api_url은 settings 테이블에서 읽음 (기본값: https://freecart.kr)
      const { data: storeUrlSetting } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'store_api_url')
        .single();
      const storeUrl = storeUrlSetting?.value || 'https://freecart.kr';
      const sectionsRes = await fetch(`${storeUrl}/api/themes/default-shop/sections`);
      if (!sectionsRes.ok) throw new Error(`테마 섹션 로드 실패: ${sectionsRes.status}`);
      const { sections: sectionHtmlMap } = await sectionsRes.json() as { sections: Record<string, string> };

      // 2. 버킷 존재 확인 및 생성
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets?.some((b: any) => b.name === BUCKET);
      if (!bucketExists) {
        await supabase.storage.createBucket(BUCKET, {
          public: true,
          fileSizeLimit: 10 * 1024 * 1024,
          allowedMimeTypes: ['text/css', 'text/html', 'text/plain', 'image/jpeg', 'image/png', 'image/webp', 'application/zip'],
        });
      }

      const sectionIds = Object.keys(sectionHtmlMap);
      setThemeProgress({ done: 0, total: sectionIds.length, current: '' });
      const sectionHtmlUrls: Record<string, string> = {};

      for (let i = 0; i < sectionIds.length; i++) {
        const sectionId = sectionIds[i];
        setThemeProgress({ done: i, total: sectionIds.length, current: sectionId });

        const filePath = `${THEME_SLUG}/sections/${sectionId}.html`;
        const blob = new Blob([sectionHtmlMap[sectionId]], { type: 'text/html' });

        const { error: uploadErr } = await supabase.storage
          .from(BUCKET)
          .upload(filePath, blob, { cacheControl: '3600', upsert: true });

        if (uploadErr) throw new Error(`${sectionId} 업로드 실패: ${uploadErr.message}`);

        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
        sectionHtmlUrls[sectionId] = urlData.publicUrl;
      }

      setThemeProgress({ done: sectionIds.length, total: sectionIds.length, current: '' });

      // 3. installed_themes 업데이트
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
