import { useState, useEffect, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';

function ResetPasswordForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('유효하지 않은 링크입니다. 비밀번호 찾기를 다시 시도해주세요.');
    }
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: form.password }),
      });
      const json = await res.json();
      if (json.success) {
        setSuccess(true);
        setTimeout(() => navigate('/auth/login'), 3000);
      } else {
        setError(json.error || '비밀번호 재설정에 실패했습니다.');
      }
    } catch (err) {
      console.error('비밀번호 재설정 실패:', err);
      setError('재설정 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link
          to="/auth/login"
          className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          로그인으로 돌아가기
        </Link>

        <Card className="p-8">
          {success ? (
            <div className="text-center">
              <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
              <h1 className="mb-2 text-xl font-bold">비밀번호 변경 완료!</h1>
              <p className="mb-6 text-sm text-gray-500">
                비밀번호가 성공적으로 변경되었습니다.
                <br />
                잠시 후 로그인 페이지로 이동합니다.
              </p>
              <Link to="/auth/login">
                <Button className="w-full">로그인하러 가기</Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                  <Lock className="h-6 w-6 text-blue-600" />
                </div>
                <h1 className="text-xl font-bold">새 비밀번호 설정</h1>
                <p className="mt-1 text-sm text-gray-500">
                  새로운 비밀번호를 입력해주세요.
                </p>
              </div>

              {!token ? (
                <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">
                  유효하지 않은 링크입니다.{' '}
                  <Link to="/auth/forgot-password" className="font-medium underline">
                    비밀번호 찾기를 다시 시도해주세요.
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">새 비밀번호</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        placeholder="8자 이상 입력하세요"
                        minLength={8}
                        className="w-full rounded-md border px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                        autoFocus
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        onClick={() => setShowPassword((v) => !v)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">8자 이상 입력해주세요.</p>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium">비밀번호 확인</label>
                    <div className="relative">
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        value={form.confirmPassword}
                        onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                        placeholder="비밀번호를 다시 입력하세요"
                        className="w-full rounded-md border px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        onClick={() => setShowConfirm((v) => !v)}
                      >
                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {form.confirmPassword && form.password !== form.confirmPassword && (
                      <p className="mt-1 text-xs text-red-500">비밀번호가 일치하지 않습니다.</p>
                    )}
                    {form.confirmPassword && form.password === form.confirmPassword && (
                      <p className="mt-1 text-xs text-green-600">비밀번호가 일치합니다.</p>
                    )}
                  </div>

                  {error && (
                    <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
                  )}

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? '변경 중...' : '비밀번호 변경'}
                  </Button>
                </form>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">로딩 중...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
