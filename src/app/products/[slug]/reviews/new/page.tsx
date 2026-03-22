'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
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

export default function NewReviewPage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState(5);
  const [productId, setProductId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
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
        router.push('/auth/login');
        return;
      }
      loadProduct();
    }
  }, [user, authLoading, router]);

  async function loadProduct() {
    try {
      const response = await fetch(`/api/products/${params.slug}`);
      const data = await response.json();

      if (data.success && data.data) {
        setProductId(data.data.id);
      } else {
        alert('상품을 찾을 수 없습니다.');
        router.push('/products');
      }
    } catch (error) {
      console.error('Failed to load product:', error);
      router.push('/products');
    }
  }

  async function onSubmit(data: ReviewForm) {
    if (!productId) return;

    try {
      setSubmitting(true);

      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          productId,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '리뷰 작성에 실패했습니다.');
      }

      alert('리뷰가 작성되었습니다.');
      router.push(`/products/${params.slug}`);
    } catch (error) {
      console.error('Failed to create review:', error);
      alert(error instanceof Error ? error.message : '리뷰 작성 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleRatingClick(value: number) {
    setRating(value);
    setValue('rating', value);
  }

  if (authLoading || !productId) {
    return <div className="container py-8">로딩 중...</div>;
  }

  return (
    <div className="container py-8">
      <Link href={`/products/${params.slug}`} className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="mr-1 h-4 w-4" />
        상품으로 돌아가기
      </Link>

      <h1 className="mb-8 text-3xl font-bold">리뷰 작성</h1>

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
                {submitting ? '작성 중...' : '리뷰 작성'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                취소
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
