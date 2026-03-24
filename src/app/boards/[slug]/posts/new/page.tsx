import { useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft } from 'lucide-react';

const postSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요'),
  content: z.string().min(10, '최소 10자 이상 입력해주세요'),
});

type PostForm = z.infer<typeof postSchema>;

export default function NewPostPage() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PostForm>({
    resolver: zodResolver(postSchema),
  });

  useEffect(() => {
    if (!authLoading && !user) {
      alert('로그인이 필요합니다.');
      navigate('/auth/login');
    }
  }, [user, authLoading, navigate]);

  async function onSubmit(data: PostForm) {
    try {
      const response = await fetch(`/api/boards/${slug}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '게시글 작성에 실패했습니다.');
      }

      alert('게시글이 작성되었습니다.');
      navigate(`/boards/${slug}`);
    } catch (error) {
      console.error('Failed to create post:', error);
      alert(error instanceof Error ? error.message : '게시글 작성 중 오류가 발생했습니다.');
    }
  }

  if (authLoading) {
    return <div className="container py-8">로딩 중...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="container py-8">
      <Link to={`/boards/${slug}`} className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="mr-1 h-4 w-4" />
        목록으로
      </Link>

      <h1 className="mb-8 text-3xl font-bold">글쓰기</h1>

      <div className="max-w-4xl">
        <Card className="p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <Label htmlFor="title">제목</Label>
              <Input id="title" {...register('title')} placeholder="제목을 입력해주세요" />
              {errors.title && <p className="mt-1 text-sm text-red-500">{errors.title.message}</p>}
            </div>

            <div>
              <Label htmlFor="content">내용</Label>
              <Textarea
                id="content"
                {...register('content')}
                placeholder="내용을 입력해주세요 (최소 10자)"
                rows={15}
              />
              {errors.content && <p className="mt-1 text-sm text-red-500">{errors.content.message}</p>}
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? '작성 중...' : '작성하기'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                취소
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
