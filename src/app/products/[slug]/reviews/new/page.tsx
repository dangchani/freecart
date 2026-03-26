import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Star, ImagePlus, X } from 'lucide-react';

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  content: z.string().min(10, '최소 10자 이상 입력해주세요'),
});

type ReviewForm = z.infer<typeof reviewSchema>;

export default function NewReviewPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState(5);
  const [productId, setProductId] = useState<string | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<ReviewForm>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { rating: 5 },
  });

  useEffect(() => {
    if (!authLoading) {
      if (!user) { navigate('/auth/login'); return; }
      loadProduct();
    }
  }, [user, authLoading, navigate]);

  async function loadProduct() {
    if (!slug) return;
    const supabase = createClient();
    const { data } = await supabase.from('products').select('id').eq('slug', slug).single();
    if (data) {
      setProductId(data.id);
    } else {
      alert('상품을 찾을 수 없습니다.');
      navigate('/products');
    }
  }

  async function onSubmit(data: ReviewForm) {
    if (!productId || !user) return;
    try {
      setSubmitting(true);
      const supabase = createClient();

      // 리뷰 생성
      const { data: reviewData, error } = await supabase.from('reviews').insert({
        product_id: productId,
        user_id: user.id,
        rating: data.rating,
        content: data.content,
      }).select('id').single();

      if (error) throw error;

      // 이미지 업로드
      if (images.length > 0 && reviewData) {
        for (let i = 0; i < images.length; i++) {
          const file = images[i];
          const ext = file.name.split('.').pop();
          const fileName = `${reviewData.id}/${Date.now()}_${i}.${ext}`;

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
            review_id: reviewData.id,
            url: urlData.publicUrl,
            sort_order: i,
          });
        }
      }

      alert('리뷰가 작성되었습니다.');
      navigate(`/products/${slug}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : '리뷰 작성 중 오류가 발생했습니다.');
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
    if (images.length + files.length > 5) {
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

    setImages((prev) => [...prev, ...validFiles]);

    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  }

  if (authLoading || !productId) return <div className="container py-8">로딩 중...</div>;

  return (
    <div className="container py-8">
      <Link to={`/products/${slug}`} className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="mr-1 h-4 w-4" />상품으로 돌아가기
      </Link>
      <h1 className="mb-8 text-3xl font-bold">리뷰 작성</h1>
      <div className="max-w-2xl">
        <Card className="p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <Label>평점</Label>
              <div className="mt-2 flex gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button key={value} type="button" onClick={() => handleRatingClick(value)} className="focus:outline-none">
                    <Star className={`h-8 w-8 transition-colors ${value <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                  </button>
                ))}
              </div>
              <input type="hidden" {...register('rating', { valueAsNumber: true })} />
              {errors.rating && <p className="mt-1 text-sm text-red-500">{errors.rating.message}</p>}
            </div>
            <div>
              <Label htmlFor="content">내용</Label>
              <Textarea id="content" {...register('content')} placeholder="상품에 대한 솔직한 리뷰를 작성해주세요 (최소 10자)" rows={8} />
              {errors.content && <p className="mt-1 text-sm text-red-500">{errors.content.message}</p>}
            </div>

            {/* 이미지 업로드 */}
            <div>
              <Label>이미지 첨부 (최대 5장)</Label>
              <div className="mt-2 flex flex-wrap gap-3">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative h-24 w-24">
                    <img
                      src={preview}
                      alt={`미리보기 ${index + 1}`}
                      className="h-full w-full rounded-lg border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow-md hover:bg-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {images.length < 5 && (
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
              <Button type="submit" disabled={submitting}>{submitting ? '작성 중...' : '리뷰 작성'}</Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>취소</Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
