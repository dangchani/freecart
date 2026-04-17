import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { signIn, PENDING_APPROVAL_ERROR, EMAIL_NOT_VERIFIED_ERROR } from '@/lib/auth';
import { createClient } from '@/lib/supabase/client';
import { PageSection } from '@/components/theme/PageSection';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const reason = searchParams.get('reason') as string | null;
  const nextPath = searchParams.get('next') || '/';

  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [unverifiedUserId, setUnverifiedUserId] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

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
      } else if (err instanceof Error && err.message === 'MUST_CHANGE_PASSWORD') {
        navigate('/auth/change-password', { replace: true });
      } else if (err instanceof Error && err.message === EMAIL_NOT_VERIFIED_ERROR) {
        const supabase = createClient();
        const { data: userRow } = await supabase
          .from('users').select('id').eq('login_id', loginId).maybeSingle();
        setUnverifiedUserId(userRow?.id ?? null);
        setError('이메일 인증이 완료되지 않았습니다. 가입 시 받은 인증 메일을 확인해주세요.');
      } else {
        const msg = err instanceof Error ? err.message : '';
        // GoTrue 에러 메시지를 한국어로 변환
        if (msg.toLowerCase().includes('email not confirmed')) {
          setError('이메일 인증이 완료되지 않았습니다. 관리자에게 문의하거나 인증 메일을 확인해주세요.');
        } else if (msg.toLowerCase().includes('invalid login credentials') || msg.toLowerCase().includes('invalid password')) {
          setError('아이디 또는 비밀번호가 올바르지 않습니다.');
        } else if (msg) {
          setError(`로그인 실패: ${msg}`);
        } else {
          setError('아이디 또는 비밀번호가 올바르지 않습니다.');
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    if (!unverifiedUserId) return;
    setResending(true);
    try {
      const supabase = createClient();
      await supabase.functions.invoke('send-verification-email', { body: { userId: unverifiedUserId } });
      alert('인증 메일을 재발송했습니다. 받은편지함을 확인해주세요.');
    } catch {
      alert('재발송 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setResending(false);
    }
  }

  return (
    <>
      <PageSection id="login" />
      <div className="container flex min-h-[calc(100vh-200px)] items-center justify-center py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>로그인</CardTitle>
          <CardDescription>아이디와 비밀번호를 입력하세요</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {reason === 'closed_mall' && (
              <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700">
                이 쇼핑몰은 승인된 회원만 이용 가능합니다. 로그인 후 이용해 주세요.
              </div>
            )}
            {reason === 'session_expired' && (
              <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
                세션이 만료되었습니다. 다시 로그인해 주세요.
              </div>
            )}
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                <p>{error}</p>
                {unverifiedUserId && (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resending}
                    className="mt-2 text-xs font-medium text-blue-600 hover:underline disabled:opacity-50"
                  >
                    {resending ? '발송 중...' : '인증 메일 재발송'}
                  </button>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="loginId">아이디</Label>
              <Input
                id="loginId"
                type="text"
                placeholder="영문/숫자 5자 이상"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '로그인 중...' : '로그인'}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              <Link to="/auth/forgot-id" className="hover:underline">
                아이디 찾기
              </Link>
              {' · '}
              <Link to="/auth/forgot-password" className="hover:underline">
                비밀번호 찾기
              </Link>
            </div>

            <div className="text-center text-sm">
              계정이 없으신가요?{' '}
              <Link to="/auth/signup" className="text-primary hover:underline">
                회원가입
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
    </>
  );
}
