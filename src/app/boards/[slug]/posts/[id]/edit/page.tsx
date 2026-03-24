import { useEffect, useState } from 'react';
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

export default function EditPostPage() {
  const navigate = useNavigate();
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PostForm>({
    resolver: zodResolver(postSchema),
  });

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        alert('로그인이 필요합니다.');
        navigate('/auth/login');
        return;
      }
      loadPost();
    }
  }, [user, authLoading, navigate]);

  async function loadPost() {
    try {
      const response = await fetch(`/api/posts/${id}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || '게시글을 불러올 수 없습니다.');
      }

      const post = data.data;

      if (post.authorId !== user?.id) {
        alert('수정 권한이 없습니다.');
        navigate(`/boards/${slug}/posts/${id}`);
        return;
      }

      reset({
        title: post.title,
        content: post.content,
      });
    } catch (error) {
      console.error('Failed to load post:', error);
      alert(error instanceof Error ? error.message : '게시글을 불러오는 중 오류가 발생했습니다.');
      navigate(`/boards/${slug}`);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(data: PostForm) {
    try {
      const response = await fetch(`/api/posts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '게시글 수정에 실패했습니다.');
      }

      alert('게시글이 수정되었습니다.');
      navigate(`/boards/${slug}/posts/${id}`);
    } catch (error) {
      console.error('Failed to update post:', error);
      alert(error instanceof Error ? error.message : '게시글 수정 중 오류가 발생했습니다.');
    }
  }

  if (authLoading || loading) {
    return <div className="container py-8">로딩 중...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="container py-8">
      <Link to={`/boards/${slug}/posts/${id}`} className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="mr-1 h-4 w-4" />
        게시글로 돌아가기
      </Link>

      <h1 className="mb-8 text-3xl font-bold">글 수정</h1>

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
                {isSubmitting ? '수정 중...' : '수정하기'}
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
