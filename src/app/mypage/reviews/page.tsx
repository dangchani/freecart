import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { ArrowLeft, Star, Edit, Trash2 } from 'lucide-react';

interface Review {
  id: string;
  productId: string;
  productName: string;
  rating: number;
  title: string;
  content: string;
  images: string[];
  createdAt: string;
}

export default function ReviewsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      loadReviews();
    }
  }, [user, authLoading, navigate]);

  async function loadReviews() {
    try {
      const response = await fetch('/api/reviews');
      const data = await response.json();

      if (data.success) {
        setReviews(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load reviews:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(reviewId: string) {
    if (!confirm('리뷰를 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch(`/api/reviews/${reviewId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || '리뷰 삭제에 실패했습니다.');
      }

      alert('리뷰가 삭제되었습니다.');
      await loadReviews();
    } catch (error) {
      console.error('Failed to delete review:', error);
      alert(error instanceof Error ? error.message : '리뷰 삭제 중 오류가 발생했습니다.');
    }
  }

  if (authLoading || loading) {
    return <div className="container py-8">로딩 중...</div>;
  }

  return (
    <div className="container py-8">
      <Link to="/mypage" className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="mr-1 h-4 w-4" />
        마이페이지로 돌아가기
      </Link>

      <h1 className="mb-8 text-3xl font-bold">내 리뷰</h1>

      {reviews.length === 0 ? (
        <Card className="p-12 text-center">
          <Star className="mx-auto mb-4 h-12 w-12 text-gray-400" />
          <p className="mb-4 text-gray-500">작성한 리뷰가 없습니다.</p>
          <Link to="/products">
            <Button>쇼핑하러 가기</Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <Card key={review.id} className="p-6">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <Link to={`/products/${review.productId}`} className="font-bold hover:underline">
                    {review.productName}
                  </Link>
                  <div className="mt-1 flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${
                          i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                        }`}
                      />
                    ))}
                    <span className="ml-2 text-sm text-gray-500">
                      {format(new Date(review.createdAt), 'yyyy.MM.dd')}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link to={`/mypage/reviews/${review.id}/edit`}>
                    <Button size="sm" variant="outline">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(review.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>

              <h3 className="mb-2 font-semibold">{review.title}</h3>
              <p className="mb-3 whitespace-pre-wrap text-gray-600">{review.content}</p>

              {review.images && review.images.length > 0 && (
                <div className="flex gap-2">
                  {review.images.map((image, index) => (
                    <div
                      key={index}
                      className="h-20 w-20 overflow-hidden rounded-lg border bg-gray-100"
                    >
                      <img src={image} alt={`리뷰 이미지 ${index + 1}`} className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
