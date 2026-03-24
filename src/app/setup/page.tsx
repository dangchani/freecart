import { useState } from 'react';

export default function SetupPage() {
  const [form, setForm] = useState({
    supabaseUrl: '',
    supabaseAnonKey: '',
    supabaseServiceRoleKey: '',
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setMessage('');

    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setMessage(data.error || '오류가 발생했습니다.');
        return;
      }

      setStatus('success');
      setMessage(data.message || '설정이 완료되었습니다.');
    } catch {
      setStatus('error');
      setMessage('서버와 통신 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-lg p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Freecart 초기 설정</h1>
          <p className="text-sm text-gray-500 mt-1">
            Supabase 프로젝트 정보를 입력하면 자동으로 설정 파일을 생성합니다.
          </p>
        </div>

        {status === 'success' ? (
          <div className="text-center py-6">
            <div className="text-5xl mb-4">✅</div>
            <p className="text-lg font-semibold text-gray-800 mb-2">설정 완료!</p>
            <p className="text-sm text-gray-500 whitespace-pre-line">{message}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
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
                Anon (Public) Key <span className="text-red-500">*</span>
              </label>
              <textarea
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={form.supabaseAnonKey}
                onChange={(e) => setForm({ ...form, supabaseAnonKey: e.target.value })}
                required
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">
                Supabase 대시보드 → Settings → API → anon public
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
                Supabase 대시보드 → Settings → API → service_role (절대 외부 노출 금지)
              </p>
            </div>

            {status === 'error' && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
            >
              {status === 'loading' ? '연결 확인 중...' : '설정 저장'}
            </button>
          </form>
        )}

        <div className="mt-6 pt-5 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">
            Supabase 프로젝트가 없으신가요?{' '}
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              supabase.com
            </a>
            에서 무료로 생성하세요.
          </p>
        </div>
      </div>
    </div>
  );
}
