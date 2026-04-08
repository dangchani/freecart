import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react';
import { resetPasswordByLoginId } from '@/lib/auth';

export default function ForgotPasswordPage() {
  const [loginId, setLoginId] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!loginId.trim()) {
      setError('아이디를 입력해주세요.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await resetPasswordByLoginId(loginId);
      setSuccess(true);
    } catch (err) {
      if (err instanceof Error && err.message === 'NOT_FOUND') {
        setError('존재하지 않는 아이디입니다.');
      } else {
        setError('요청 중 오류가 발생했습니다.');
      }
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
              <h1 className="mb-2 text-xl font-bold">이메일을 확인해주세요</h1>
              <p className="mb-6 text-sm text-gray-500">
                가입하신 이메일로 비밀번호 재설정 링크를 발송했습니다.
                <br />
                이메일을 확인하고 링크를 클릭해주세요.
              </p>
              <p className="mb-4 text-xs text-gray-400">
                이메일이 오지 않으면 스팸 폴더를 확인해주세요.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => { setSuccess(false); setLoginId(''); }}
              >
                다시 시도하기
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                  <Mail className="h-6 w-6 text-blue-600" />
                </div>
                <h1 className="text-xl font-bold">비밀번호 찾기</h1>
                <p className="mt-1 text-sm text-gray-500">
                  가입하신 아이디를 입력하시면 비밀번호 재설정 링크를 보내드립니다.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">아이디</label>
                  <input
                    type="text"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    placeholder="가입하신 아이디를 입력하세요"
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    autoFocus
                  />
                </div>

                {error && (
                  <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? '전송 중...' : '재설정 링크 보내기'}
                </Button>
              </form>

              <p className="mt-4 text-center text-sm text-gray-500">
                계정이 없으신가요?{' '}
                <Link to="/auth/signup" className="font-medium text-blue-600 hover:underline">
                  회원가입
                </Link>
              </p>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
