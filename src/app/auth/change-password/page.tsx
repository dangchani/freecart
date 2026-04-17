import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

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
      const supabase = createClient();

      // 1. 비밀번호 변경
      const { error: pwError } = await supabase.auth.updateUser({ password: form.password });
      if (pwError) throw pwError;

      // 2. must_change_password 플래그 해제
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('users')
          .update({ must_change_password: false })
          .eq('id', user.id);
      }

      setSuccess(true);
      setTimeout(() => navigate('/'), 2000);
    } catch (err: any) {
      console.error('비밀번호 변경 실패:', err);
      setError(err?.message ?? '비밀번호 변경 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Card className="p-8">
          {success ? (
            <div className="text-center">
              <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
              <h1 className="mb-2 text-xl font-bold">비밀번호 변경 완료!</h1>
              <p className="text-sm text-gray-500">잠시 후 메인 페이지로 이동합니다.</p>
            </div>
          ) : (
            <>
              <div className="mb-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
                  <Lock className="h-6 w-6 text-orange-600" />
                </div>
                <h1 className="text-xl font-bold">비밀번호 변경 필요</h1>
                <p className="mt-1 text-sm text-gray-500">
                  임시 비밀번호로 로그인하셨습니다.
                  <br />
                  새 비밀번호를 설정해야 서비스를 이용할 수 있습니다.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">새 비밀번호</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="8자 이상 입력하세요"
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
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
