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
import { ArrowLeft, Star } from 'lucide-react';

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().min(1, '제목을 입력해주세요'),
  content: z.string().min(10, '최소 10자 이상 입력해주세요'),
});

type ReviewForm = z.infer<typeof reviewSchema>;

export default function EditReviewPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState(5);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ReviewForm>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      rating: 5,
    },
  });

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      loadReview();
    }
  }, [user, authLoading, navigate]);

  async function loadReview() {
    try {
      const response = await fetch(`/api/reviews/${id}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || '리뷰를 불러올 수 없습니다.');
      }

      const review = data.data;
      setRating(review.rating);
      reset({
        rating: review.rating,
        title: review.title,
        content: review.content,
      });
    } catch (error) {
      console.error('Failed to load review:', error);
      alert(error instanceof Error ? error.message : '리뷰를 불러오는 중 오류가 발생했습니다.');
      navigate('/mypage/reviews');
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(data: ReviewForm) {
    try {
      setSubmitting(true);

      const response = await fetch(`/api/reviews/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '리뷰 수정에 실패했습니다.');
      }

      alert('리뷰가 수정되었습니다.');
      navigate('/mypage/reviews');
    } catch (error) {
      console.error('Failed to update review:', error);
      alert(error instanceof Error ? error.message : '리뷰 수정 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleRatingClick(value: number) {
    setRating(value);
    setValue('rating', value);
  }

  if (authLoading || loading) {
    return <div className="container py-8">로딩 중...</div>;
  }

  return (
    <div className="container py-8">
      <Link to="/mypage/reviews" className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="mr-1 h-4 w-4" />
        리뷰 목록으로 돌아가기
      </Link>

      <h1 className="mb-8 text-3xl font-bold">리뷰 수정</h1>

      <div className="max-w-2xl">
        <Card className="p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <Label>평점</Label>
              <div className="mt-2 flex gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleRatingClick(value)}
                    className="focus:outline-none"
                  >
                    <Star
                      className={`h-8 w-8 transition-colors ${
                        value <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <input type="hidden" {...register('rating', { valueAsNumber: true })} />
              {errors.rating && <p className="mt-1 text-sm text-red-500">{errors.rating.message}</p>}
            </div>

            <div>
              <Label htmlFor="title">제목</Label>
              <Input id="title" {...register('title')} placeholder="리뷰 제목을 입력해주세요" />
              {errors.title && <p className="mt-1 text-sm text-red-500">{errors.title.message}</p>}
            </div>

            <div>
              <Label htmlFor="content">내용</Label>
              <Textarea
                id="content"
                {...register('content')}
                placeholder="상품에 대한 솔직한 리뷰를 작성해주세요 (최소 10자)"
                rows={8}
              />
              {errors.content && <p className="mt-1 text-sm text-red-500">{errors.content.message}</p>}
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? '수정 중...' : '수정하기'}
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
