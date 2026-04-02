import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@/lib/supabase/client';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    async function handleCallback() {
      const supabase = createClient();

      const { error } = await supabase.auth.getSession();

      if (error) {
        setError('소셜 로그인 처리 중 오류가 발생했습니다.');
        return;
      }

      navigate('/', { replace: true });
    }

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <a href="/auth/login" className="mt-4 text-primary underline">
            로그인 페이지로 돌아가기
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p>로그인 처리 중...</p>
    </div>
  );
}
