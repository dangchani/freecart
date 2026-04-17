import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { PageSection } from '@/components/theme/PageSection';

type Status = 'loading' | 'success' | 'invalid' | 'expired' | 'already_used' | 'error';

function VerifyEmailContent() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }

    const supabase = createClient();
    supabase.functions
      .invoke('verify-email', { body: { token } })
      .then(({ data, error }) => {
        if (error) { setStatus('error'); return; }
        if (data?.ok) { setStatus('success'); return; }
        const code: string = data?.error ?? 'ERROR';
        if (code === 'INVALID_TOKEN') setStatus('invalid');
        else if (code === 'EXPIRED')   setStatus('expired');
        else if (code === 'ALREADY_USED') setStatus('already_used');
        else setStatus('error');
      });
  }, [token]);

  return (
    <>
      <PageSection id="verify-email" />
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <div className="w-full max-w-md">
          <Card className="p-8 text-center">
            {status === 'loading' && (
              <>
                <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-blue-500" />
                <h1 className="text-xl font-bold">이메일 인증 중...</h1>
                <p className="mt-2 text-sm text-gray-500">잠시만 기다려주세요.</p>
              </>
            )}

            {status === 'success' && (
              <>
                <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
                <h1 className="mb-2 text-xl font-bold">이메일 인증 완료!</h1>
                <p className="mb-6 text-sm text-gray-500">
                  이메일 인증이 완료되었습니다.<br />이제 로그인할 수 있습니다.
                </p>
                <Link to="/auth/login">
                  <Button className="w-full">로그인하기</Button>
                </Link>
              </>
            )}

            {status === 'already_used' && (
              <>
                <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-400" />
                <h1 className="mb-2 text-xl font-bold">이미 인증된 계정입니다</h1>
                <p className="mb-6 text-sm text-gray-500">이미 이메일 인증이 완료된 계정입니다.</p>
                <Link to="/auth/login">
                  <Button className="w-full">로그인하기</Button>
                </Link>
              </>
            )}

            {status === 'expired' && (
              <>
                <XCircle className="mx-auto mb-4 h-12 w-12 text-orange-500" />
                <h1 className="mb-2 text-xl font-bold">인증 링크가 만료되었습니다</h1>
                <p className="mb-6 text-sm text-gray-500">
                  인증 링크의 유효 기간(24시간)이 지났습니다.<br />
                  로그인 페이지에서 인증 메일을 재발송해주세요.
                </p>
                <Link to="/auth/login">
                  <Button variant="outline" className="w-full">로그인 페이지로</Button>
                </Link>
              </>
            )}

            {(status === 'invalid' || status === 'error') && (
              <>
                <XCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
                <h1 className="mb-2 text-xl font-bold">유효하지 않은 링크입니다</h1>
                <p className="mb-6 text-sm text-gray-500">
                  인증 링크가 올바르지 않습니다.<br />
                  로그인 페이지에서 인증 메일을 재발송해주세요.
                </p>
                <Link to="/auth/login">
                  <Button variant="outline" className="w-full">로그인 페이지로</Button>
                </Link>
              </>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">로딩 중...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
