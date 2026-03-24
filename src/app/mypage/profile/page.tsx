import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const profileSchema = z.object({
  displayName: z.string().min(1, '이름을 입력해주세요').optional(),
  phone: z.string().min(10, '휴대폰 번호를 입력해주세요').optional(),
  address: z.string().optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
  });

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      loadProfile();
    }
  }, [user, authLoading, navigate]);

  async function loadProfile() {
    try {
      if (!user) return;

      const response = await fetch('/api/profiles');
      const data = await response.json();

      if (data.success && data.data) {
        setProfile(data.data);
        reset({
          displayName: data.data.displayName || '',
          phone: data.data.phone || '',
          address: data.data.address || '',
        });
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  }

  async function onSubmit(data: ProfileForm) {
    if (!user) return;

    try {
      setLoading(true);

      const response = await fetch(`/api/profiles/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '프로필 업데이트에 실패했습니다.');
      }

      alert('프로필이 업데이트되었습니다.');
      await loadProfile();
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert(error instanceof Error ? error.message : '프로필 업데이트 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteAccount() {
    if (!user) return;

    if (!confirm('정말로 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    try {
      const response = await fetch(`/api/profiles/${user.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '계정 삭제에 실패했습니다.');
      }

      alert('계정이 삭제되었습니다.');
      navigate('/');
    } catch (error) {
      console.error('Failed to delete account:', error);
      alert(error instanceof Error ? error.message : '계정 삭제 중 오류가 발생했습니다.');
    }
  }

  if (authLoading) {
    return <div className="container py-8">로딩 중...</div>;
  }

  return (
    <div className="container py-8">
      <Link to="/mypage" className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="mr-1 h-4 w-4" />
        마이페이지로 돌아가기
      </Link>

      <h1 className="mb-8 text-3xl font-bold">프로필 수정</h1>

      <div className="max-w-2xl">
        <Card className="p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <Label>이메일</Label>
              <Input value={user?.email || ''} disabled />
              <p className="mt-1 text-sm text-gray-500">이메일은 변경할 수 없습니다.</p>
            </div>

            <div>
              <Label htmlFor="displayName">이름</Label>
              <Input id="displayName" {...register('displayName')} placeholder="이름을 입력해주세요" />
              {errors.displayName && (
                <p className="mt-1 text-sm text-red-500">{errors.displayName.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="phone">휴대폰 번호</Label>
              <Input id="phone" {...register('phone')} placeholder="01012345678" />
              {errors.phone && <p className="mt-1 text-sm text-red-500">{errors.phone.message}</p>}
            </div>

            <div>
              <Label htmlFor="address">주소</Label>
              <Input id="address" {...register('address')} placeholder="주소를 입력해주세요" />
              {errors.address && <p className="mt-1 text-sm text-red-500">{errors.address.message}</p>}
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? '저장 중...' : '저장'}
            </Button>
          </form>
        </Card>

        <Card className="mt-6 p-6 border-red-200">
          <h2 className="mb-2 text-lg font-bold text-red-600">위험 영역</h2>
          <p className="mb-4 text-sm text-gray-600">
            계정을 삭제하면 모든 데이터가 영구적으로 삭제됩니다.
          </p>
          <Button variant="destructive" onClick={handleDeleteAccount}>
            계정 삭제
          </Button>
        </Card>
      </div>
    </div>
  );
}
