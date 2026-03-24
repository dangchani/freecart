import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'admin@admin.com';
const ADMIN_PASSWORD = 'admin@admin';
const ADMIN_NAME = '관리자';

export default function SetupPage() {
  const [form, setForm] = useState({
    supabaseUrl: '',
    supabaseServiceRoleKey: '',
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setMessage('');

    try {
      const adminSupabase = createClient(
        form.supabaseUrl.trim(),
        form.supabaseServiceRoleKey.trim(),
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      // 이미 관리자가 있는지 확인
      const { data: existing } = await adminSupabase
        .from('profiles')
        .select('id')
        .eq('email', ADMIN_EMAIL)
        .single();

      if (existing) {
        setStatus('error');
        setMessage(`이미 초기 설정이 완료되었습니다.\n관리자 이메일: ${ADMIN_EMAIL}`);
        return;
      }

      // Supabase Auth 사용자 생성
      const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
      });

      if (authError) throw authError;

      // profiles 테이블에 관리자 정보 삽입
      const { error: profileError } = await adminSupabase
        .from('profiles')
        .upsert({
          id: authData.user.id,
          email: ADMIN_EMAIL,
          name: ADMIN_NAME,
          role: 'admin',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (profileError) throw profileError;

      setStatus('success');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : '오류가 발생했습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-lg p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Freecart 초기 설정</h1>
          <p className="text-sm text-gray-500 mt-1">
            Supabase Service Role Key를 입력하면 관리자 계정을 자동으로 생성합니다.
          </p>
        </div>

        {status === 'success' ? (
          <div className="text-center py-6">
            <div className="text-5xl mb-4">✅</div>
            <p className="text-lg font-semibold text-gray-800 mb-4">초기 설정 완료!</p>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-left mb-4">
              <p className="text-sm font-semibold text-blue-800 mb-3">초기 관리자 계정</p>
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
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 생성될 계정 미리보기 */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-600 mb-2">생성될 관리자 계정</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-16">이메일</span>
                  <code className="text-xs font-mono text-gray-800">{ADMIN_EMAIL}</code>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-16">비밀번호</span>
                  <code className="text-xs font-mono text-gray-800">{ADMIN_PASSWORD}</code>
                </div>
              </div>
            </div>

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
              <p className="text-xs text-gray-400 mt-1">
                Supabase 대시보드 → Settings → API → Project URL
              </p>
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
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">
                Supabase 대시보드 → Settings → API → service_role
              </p>
            </div>

            {status === 'error' && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 whitespace-pre-line">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
            >
              {status === 'loading' ? '관리자 계정 생성 중...' : '초기 설정 시작'}
            </button>
          </form>
        )}

        <div className="mt-6 pt-5 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">
            이 페이지는 최초 1회만 사용하세요. 설정 완료 후 접근을 차단하는 것을 권장합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
