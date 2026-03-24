import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { signOut } from '@/lib/auth';
import { ShoppingBag, Star, User, LogOut } from 'lucide-react';

export default function MyPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth/login');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return <div className="container py-8">로딩 중...</div>;
  }

  if (!user) {
    return null;
  }

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <div className="container py-8">
      <h1 className="mb-8 text-3xl font-bold">마이페이지</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* 프로필 */}
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <User className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="font-bold">내 정보</h2>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
          </div>
          <Link to="/mypage/profile">
            <Button variant="outline" className="w-full">
              프로필 수정
            </Button>
          </Link>
        </Card>

        {/* 주문 내역 */}
        <Link to="/mypage/orders">
          <Card className="p-6 transition-shadow hover:shadow-md cursor-pointer h-full">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <ShoppingBag className="h-6 w-6 text-green-600" />
              </div>
              <h2 className="font-bold">주문 내역</h2>
            </div>
            <p className="text-sm text-gray-500">
              나의 주문 내역을 확인하고<br />관리할 수 있습니다.
            </p>
          </Card>
        </Link>

        {/* 리뷰 관리 */}
        <Link to="/mypage/reviews">
          <Card className="p-6 transition-shadow hover:shadow-md cursor-pointer h-full">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
                <Star className="h-6 w-6 text-yellow-600" />
              </div>
              <h2 className="font-bold">내 리뷰</h2>
            </div>
            <p className="text-sm text-gray-500">
              작성한 리뷰를 확인하고<br />수정할 수 있습니다.
            </p>
          </Card>
        </Link>
      </div>

      <div className="mt-8">
        <Button variant="ghost" onClick={handleSignOut} className="text-red-500">
          <LogOut className="mr-2 h-4 w-4" />
          로그아웃
        </Button>
      </div>
    </div>
  );
}
