import { Link } from 'react-router-dom';
import { Clock, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useNavigate } from 'react-router-dom';
import { PageSection } from '@/components/theme/PageSection';

export default function PendingApprovalPage() {
  const navigate = useNavigate();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    navigate('/auth/login');
  }

  return (
    <>
      <PageSection id="pending-approval" />
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100">
          <Clock className="h-10 w-10 text-amber-500" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-3">승인 대기 중</h1>
        <p className="text-gray-500 mb-2">
          회원가입이 완료되었습니다.
        </p>
        <p className="text-gray-500 mb-6">
          이 쇼핑몰은 <strong className="text-gray-700">관리자 승인 후</strong> 이용 가능합니다.
          <br />승인이 완료되면 이메일로 안내드리겠습니다.
        </p>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 mb-6">
          승인 문의는 운영자에게 연락해 주세요.
        </div>

        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
        >
          <LogOut className="h-4 w-4" />
          로그아웃
        </button>
      </div>
    </div>
    </>
  );
}
