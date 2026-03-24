import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft } from 'lucide-react';

const productSchema = z.object({
  name: z.string().min(1, '상품명을 입력해주세요'),
  description: z.string().min(10, '최소 10자 이상 입력해주세요'),
  price: z.number().min(0, '가격을 입력해주세요'),
  comparePrice: z.number().min(0).optional(),
  stock: z.number().int().min(0, '재고를 입력해주세요'),
  categoryId: z.string().uuid(),
  thumbnail: z.string().url().optional(),
  isActive: z.boolean(),
});

type ProductForm = z.infer<typeof productSchema>;

export default function EditProductPage() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuth();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
  });

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      loadCategories();
      loadProduct();
    }
  }, [user, authLoading, navigate]);

  async function loadCategories() {
    try {
      const response = await fetch('/api/categories');
      const data = await response.json();

      if (data.success) {
        setCategories(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }

  async function loadProduct() {
    try {
      const response = await fetch(`/api/products/${slug}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error('상품을 찾을 수 없습니다.');
      }

      const product = data.data;
      reset({
        name: product.name,
        description: product.description,
        price: product.price,
        comparePrice: product.comparePrice,
        stock: product.stock,
        categoryId: product.categoryId,
        thumbnail: product.thumbnail,
        isActive: product.isActive,
      });
    } catch (error) {
      console.error('Failed to load product:', error);
      alert('상품을 불러오는 중 오류가 발생했습니다.');
      navigate('/admin/products');
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(data: ProductForm) {
    try {
      setSubmitting(true);

      const response = await fetch(`/api/products/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '상품 수정에 실패했습니다.');
      }

      alert('상품이 수정되었습니다.');
      navigate('/admin/products');
    } catch (error) {
      console.error('Failed to update product:', error);
      alert(error instanceof Error ? error.message : '상품 수정 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || loading) {
    return <div className="container py-8">로딩 중...</div>;
  }

  return (
    <div className="container py-8">
      <Link to="/admin/products" className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="mr-1 h-4 w-4" />
        상품 관리로 돌아가기
      </Link>

      <h1 className="mb-8 text-3xl font-bold">상품 수정</h1>

      <div className="max-w-2xl">
        <Card className="p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <Label htmlFor="name">상품명</Label>
              <Input id="name" {...register('name')} placeholder="상품명을 입력해주세요" />
              {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>}
            </div>

            <div>
              <Label htmlFor="description">상품 설명</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="상품 설명을 입력해주세요"
                rows={5}
              />
              {errors.description && <p className="mt-1 text-sm text-red-500">{errors.description.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price">판매가</Label>
                <Input
                  id="price"
                  type="number"
                  {...register('price', { valueAsNumber: true })}
                  placeholder="0"
                />
                {errors.price && <p className="mt-1 text-sm text-red-500">{errors.price.message}</p>}
              </div>

              <div>
                <Label htmlFor="comparePrice">정가 (선택)</Label>
                <Input
                  id="comparePrice"
                  type="number"
                  {...register('comparePrice', { valueAsNumber: true })}
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="stock">재고</Label>
              <Input
                id="stock"
                type="number"
                {...register('stock', { valueAsNumber: true })}
                placeholder="0"
              />
              {errors.stock && <p className="mt-1 text-sm text-red-500">{errors.stock.message}</p>}
            </div>

            <div>
              <Label htmlFor="categoryId">카테고리</Label>
              <Select onValueChange={(value) => setValue('categoryId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="카테고리 선택" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.categoryId && <p className="mt-1 text-sm text-red-500">{errors.categoryId.message}</p>}
            </div>

            <div>
              <Label htmlFor="thumbnail">썸네일 URL (선택)</Label>
              <Input
                id="thumbnail"
                {...register('thumbnail')}
                placeholder="https://example.com/image.jpg"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="isActive"
                type="checkbox"
                {...register('isActive')}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="isActive" className="font-normal">판매 활성화</Label>
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
