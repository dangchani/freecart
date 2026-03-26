import { useEffect, useState, useRef } from 'react';
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
import { ArrowLeft, Star, ImagePlus, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface ExistingImage {
  id: string;
  url: string;
}

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
  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [deletedImageIds, setDeletedImageIds] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const supabase = createClient();
      const { data, error } = await supabase
        .from('reviews')
        .select('id, rating, content, user_id, review_images(id, url)')
        .eq('id', id)
        .single();

      if (error || !data) {
        throw new Error('리뷰를 불러올 수 없습니다.');
      }

      if (data.user_id !== user?.id) {
        alert('수정 권한이 없습니다.');
        navigate('/mypage/reviews');
        return;
      }

      setRating(data.rating);
      setExistingImages(
        ((data.review_images as any[]) || []).map((img) => ({
          id: img.id,
          url: img.url,
        }))
      );
      reset({
        rating: data.rating,
        title: '',
        content: data.content,
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

      const supabase = createClient();
      const { error } = await supabase
        .from('reviews')
        .update({
          rating: data.rating,
          content: data.content,
        })
        .eq('id', id)
        .eq('user_id', user!.id);

      if (error) throw error;

      // 삭제된 이미지 처리
      if (deletedImageIds.length > 0) {
        await supabase
          .from('review_images')
          .delete()
          .in('id', deletedImageIds);
      }

      // 새 이미지 업로드
      if (newImages.length > 0) {
        const currentImageCount = existingImages.length - deletedImageIds.length;
        for (let i = 0; i < newImages.length; i++) {
          const file = newImages[i];
          const ext = file.name.split('.').pop();
          const fileName = `${id}/${Date.now()}_${i}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from('review-images')
            .upload(fileName, file);

          if (uploadError) {
            console.error('Failed to upload image:', uploadError);
            continue;
          }

          const { data: urlData } = supabase.storage
            .from('review-images')
            .getPublicUrl(fileName);

          await supabase.from('review_images').insert({
            review_id: id,
            url: urlData.publicUrl,
            sort_order: currentImageCount + i,
          });
        }
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

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const totalImages = existingImages.length - deletedImageIds.length + newImages.length + files.length;

    if (totalImages > 5) {
      alert('이미지는 최대 5장까지 첨부할 수 있습니다.');
      return;
    }

    const validFiles = files.filter((file) => {
      if (!file.type.startsWith('image/')) {
        alert('이미지 파일만 업로드 가능합니다.');
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('파일 크기는 5MB 이하여야 합니다.');
        return false;
      }
      return true;
    });

    setNewImages((prev) => [...prev, ...validFiles]);

    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewImagePreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function removeExistingImage(imageId: string) {
    setDeletedImageIds((prev) => [...prev, imageId]);
  }

  function removeNewImage(index: number) {
    setNewImages((prev) => prev.filter((_, i) => i !== index));
    setNewImagePreviews((prev) => prev.filter((_, i) => i !== index));
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

            {/* 이미지 업로드 */}
            <div>
              <Label>이미지 첨부 (최대 5장)</Label>
              <div className="mt-2 flex flex-wrap gap-3">
                {/* 기존 이미지 */}
                {existingImages
                  .filter((img) => !deletedImageIds.includes(img.id))
                  .map((image) => (
                    <div key={image.id} className="relative h-24 w-24">
                      <img
                        src={image.url}
                        alt="리뷰 이미지"
                        className="h-full w-full rounded-lg border object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeExistingImage(image.id)}
                        className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow-md hover:bg-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}

                {/* 새 이미지 */}
                {newImagePreviews.map((preview, index) => (
                  <div key={`new-${index}`} className="relative h-24 w-24">
                    <img
                      src={preview}
                      alt={`새 이미지 ${index + 1}`}
                      className="h-full w-full rounded-lg border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeNewImage(index)}
                      className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow-md hover:bg-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}

                {/* 이미지 추가 버튼 */}
                {existingImages.length - deletedImageIds.length + newImages.length < 5 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-24 w-24 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-400 transition-colors hover:border-gray-400 hover:text-gray-500"
                  >
                    <ImagePlus className="h-8 w-8" />
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                className="hidden"
              />
              <p className="mt-2 text-sm text-gray-500">JPG, PNG, GIF 파일만 가능 (최대 5MB)</p>
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
