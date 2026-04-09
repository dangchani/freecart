// joy: 동적 회원가입 폼으로 전환. 기본 필드 + 관리자가 추가한 필드를 모두 렌더링.
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DynamicSignupForm } from '@/components/signup-fields/DynamicSignupForm';
import { PageSection } from '@/components/theme/PageSection';

export default function SignupPage() {
  const navigate = useNavigate();

  return (
    <>
      <PageSection id="signup" />
      <div className="container flex min-h-[calc(100vh-200px)] items-center justify-center py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">회원가입</CardTitle>
          <CardDescription>회원 정보를 입력해 주세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <DynamicSignupForm
            onSuccess={() => {
              alert('회원가입이 완료되었습니다. 로그인해 주세요.');
              navigate('/auth/login');
            }}
          />
          <p className="mt-4 text-center text-sm text-gray-500">
            이미 계정이 있으신가요?{' '}
            <Link to="/auth/login" className="text-blue-600 hover:underline">로그인</Link>
          </p>
        </CardContent>
      </Card>
    </div>
    </>
  );
}
