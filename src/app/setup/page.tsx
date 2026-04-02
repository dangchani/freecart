import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'admin@admin.com';
const ADMIN_PASSWORD = 'admin@admin';
const ADMIN_NAME = '관리자';
const SCHEMA_SQL_URL = 'https://raw.githubusercontent.com/dangchani/freecart/main/supabase/db-schema-full.sql';

type Step = 'supabase' | 'database' | 'complete';
type DbStatus = 'idle' | 'checking' | 'not_ready' | 'ready' | 'creating_admin' | 'done' | 'error';

export default function SetupPage() {
  const [step, setStep] = useState<Step>('supabase');
  const [form, setForm] = useState({
    supabaseUrl: '',
    supabaseAnonKey: '',
    supabaseServiceRoleKey: '',
  });

  // DB step
  const [sqlCopied, setSqlCopied] = useState(false);
  const [dbStatus, setDbStatus] = useState<DbStatus>('idle');
  const [dbMessage, setDbMessage] = useState('');
  const [error, setError] = useState('');

  // ─── Step 1: Supabase 연결 정보 ───
  function handleSupabaseNext(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.supabaseUrl.trim() || !form.supabaseAnonKey.trim() || !form.supabaseServiceRoleKey.trim()) {
      setError('모든 필드를 입력해주세요.');
      return;
    }
    setStep('database');
  }

  // ─── Step 2: SQL 복사 ───
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

  // ─── Step 2: DB 확인 & 관리자 생성 ───
  async function handleVerifyAndCreateAdmin() {
    setDbStatus('checking');
    setDbMessage('');
    setError('');

    try {
      const adminSupabase = createClient(
        form.supabaseUrl.trim(),
        form.supabaseServiceRoleKey.trim(),
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      // 1. settings 테이블 존재 확인 (스키마 적용 여부)
      const { data: settings, error: settingsError } = await adminSupabase
        .from('settings')
        .select('key')
        .eq('key', 'schema_version')
        .single();

      if (settingsError || !settings) {
        setDbStatus('not_ready');
        setDbMessage('DB 스키마가 아직 적용되지 않았습니다.\nSQL을 복사하여 Supabase SQL Editor에서 실행해주세요.');
        return;
      }

      setDbStatus('ready');
      setDbMessage('DB 스키마 확인 완료!');

      // 2. 관리자 계정 확인
      const { data: existingAdmin } = await adminSupabase
        .from('users')
        .select('id, role')
        .eq('email', ADMIN_EMAIL)
        .single();

      if (existingAdmin) {
        // 이미 관리자가 존재
        if (existingAdmin.role === 'admin') {
          setDbStatus('done');
          setDbMessage('관리자 계정이 이미 존재합니다.');
          return;
        }
        // 프로필은 있지만 admin이 아닌 경우
        await adminSupabase
          .from('users')
          .update({ role: 'admin', updated_at: new Date().toISOString() })
          .eq('id', existingAdmin.id);
        setDbStatus('done');
        setDbMessage('기존 계정에 관리자 권한을 부여했습니다.');
        return;
      }

      // 3. 관리자 계정 생성
      setDbStatus('creating_admin');
      setDbMessage('관리자 계정 생성 중...');

      // user_metadata에 role: admin을 넘기면 트리거가 자동으로 admin 계정 생성
      const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: { name: ADMIN_NAME, role: 'admin' },
      });

      if (authError) throw authError;

      // 트리거가 users 테이블에 레코드를 생성할 때까지 대기
      await new Promise((r) => setTimeout(r, 2000));

      // 기본 회원 등급 조회
      const { data: defaultLevel } = await adminSupabase
        .from('user_levels')
        .select('id')
        .order('level', { ascending: true })
        .limit(1)
        .single();

      // role이 admin으로 설정되었는지 확인하고, 안 되어 있으면 업데이트
      const { error: profileError } = await adminSupabase
        .from('users')
        .upsert({
          id: authData.user.id,
          email: ADMIN_EMAIL,
          name: ADMIN_NAME,
          role: 'admin',
          level_id: defaultLevel?.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (profileError) throw profileError;

      setDbStatus('done');
      setDbMessage('관리자 계정이 생성되었습니다.');
    } catch (err) {
      setDbStatus('error');
      setError(err instanceof Error ? err.message : 'DB 확인 중 오류가 발생했습니다.');
    }
  }

  // ─── Step 2 → Complete ───
  function handleComplete() {
    setStep('complete');
  }

  // ─── Supabase SQL Editor URL 생성 ───
  function getSqlEditorUrl() {
    try {
      const url = new URL(form.supabaseUrl.trim());
      const projectRef = url.hostname.split('.')[0];
      return `https://supabase.com/dashboard/project/${projectRef}/sql/new`;
    } catch {
      return 'https://supabase.com/dashboard';
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-lg p-8">
        {/* 헤더 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Freecart 초기 설정</h1>
          <div className="flex items-center gap-2 mt-3">
            {(['supabase', 'database', 'complete'] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    step === s
                      ? 'bg-blue-600 text-white'
                      : i < ['supabase', 'database', 'complete'].indexOf(step)
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {i < ['supabase', 'database', 'complete'].indexOf(step) ? '✓' : i + 1}
                </div>
                {i < 2 && <div className="w-8 h-0.5 bg-gray-200" />}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {step === 'supabase' && 'Step 1: Supabase 연결'}
            {step === 'database' && 'Step 2: DB 초기화 & 관리자 생성'}
            {step === 'complete' && '설정 완료'}
          </p>
        </div>

        {/* ─── Step 1: Supabase ─── */}
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
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
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
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={form.supabaseServiceRoleKey}
                onChange={(e) => setForm({ ...form, supabaseServiceRoleKey: e.target.value })}
                required
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">
                Supabase Dashboard → Settings → API
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
            >
              다음 →
            </button>
          </form>
        )}

        {/* ─── Step 2: Database ─── */}
        {step === 'database' && (
          <div className="space-y-5">
            {/* SQL 복사 */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">1. DB 스키마 SQL 복사</p>
              <p className="text-xs text-gray-500 mb-3">
                아래 버튼으로 SQL을 복사한 뒤, Supabase SQL Editor에서 실행하세요.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleCopySQL}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
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
                  className="flex-1 py-2 rounded-lg text-sm font-medium text-center border border-gray-300 hover:bg-gray-100 transition-colors"
                >
                  SQL Editor 열기 ↗
                </a>
              </div>
            </div>

            {/* DB 확인 */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">2. DB 확인 & 관리자 생성</p>
              <p className="text-xs text-gray-500 mb-3">
                SQL 실행 후 아래 버튼을 눌러주세요. DB를 검증하고 관리자 계정을 자동 생성합니다.
              </p>

              <button
                onClick={handleVerifyAndCreateAdmin}
                disabled={dbStatus === 'checking' || dbStatus === 'creating_admin'}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
              >
                {dbStatus === 'checking' && 'DB 확인 중...'}
                {dbStatus === 'creating_admin' && '관리자 생성 중...'}
                {(dbStatus === 'idle' || dbStatus === 'not_ready' || dbStatus === 'error') && 'DB 확인 & 관리자 생성'}
                {(dbStatus === 'ready' || dbStatus === 'done') && '✓ 완료'}
              </button>

              {/* 상태 메시지 */}
              {dbMessage && (
                <div
                  className={`mt-3 rounded-lg px-3 py-2 text-xs whitespace-pre-line ${
                    dbStatus === 'done' || dbStatus === 'ready'
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : dbStatus === 'not_ready'
                        ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                        : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {dbMessage}
                </div>
              )}

              {/* 관리자 계정 정보 */}
              {dbStatus === 'done' && (
                <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-blue-800 mb-2">관리자 계정</p>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-blue-600 w-14">이메일</span>
                      <code className="text-xs font-mono text-blue-900">{ADMIN_EMAIL}</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-blue-600 w-14">비밀번호</span>
                      <code className="text-xs font-mono text-blue-900">{ADMIN_PASSWORD}</code>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 whitespace-pre-line">
                {error}
              </div>
            )}

            {/* 다음 버튼 */}
            <button
              onClick={handleComplete}
              disabled={dbStatus !== 'done'}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
            >
              {dbStatus !== 'done' ? 'DB 확인 완료 후 진행 가능' : '설정 완료 →'}
            </button>

            <button
              onClick={() => { setStep('supabase'); setError(''); }}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              ← 이전 단계
            </button>
          </div>
        )}

        {/* ─── Complete ─── */}
        {step === 'complete' && (
          <div className="text-center py-6">
            <div className="text-5xl mb-4">✅</div>
            <p className="text-lg font-semibold text-gray-800 mb-4">초기 설정 완료!</p>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-left mb-4">
              <p className="text-sm font-semibold text-blue-800 mb-3">관리자 계정</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-blue-600 font-medium w-20">이메일</span>
                  <code className="text-sm bg-white border border-blue-200 rounded px-2 py-0.5 text-blue-900 font-mono">
                    {ADMIN_EMAIL}
                  </code>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-blue-600 font-medium w-20">비밀번호</span>
                  <code className="text-sm bg-white border border-blue-200 rounded px-2 py-0.5 text-blue-900 font-mono">
                    {ADMIN_PASSWORD}
                  </code>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-left mb-6">
              <p className="text-xs text-yellow-800">
                ⚠️ 보안을 위해 로그인 후 반드시 비밀번호를 변경하세요.
              </p>
            </div>

            <a
              href="/auth/login"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-6 rounded-lg text-sm transition-colors"
            >
              로그인 페이지로 이동
            </a>
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">
            이 페이지는 최초 1회만 사용하세요.
          </p>
        </div>
      </div>
    </div>
  );
}
