import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { Heart, Trash2 } from 'lucide-react';

interface WishlistItem {
  id: string;
  productId: string;
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    comparePrice?: number;
    thumbnail?: string;
    images: string[];
    stock: number;
  };
  createdAt: string;
}

export default function WishlistPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      fetchWishlist();
    }
  }, [user, authLoading, navigate]);

  async function fetchWishlist() {
    try {
      const res = await fetch('/api/users/me/wishlist');
      const json = await res.json();
      if (json.success) setWishlist(json.data || []);
    } catch (err) {
      console.error('찜 목록 로딩 실패:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(productId: string) {
    if (!confirm('찜 목록에서 삭제하시겠습니까?')) return;
    setDeletingId(productId);
    try {
      const res = await fetch(`/api/users/me/wishlist/${productId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setWishlist((prev) => prev.filter((item) => item.productId !== productId));
      } else {
        alert(json.error || '삭제에 실패했습니다.');
      }
    } catch (err) {
      console.error('찜 삭제 실패:', err);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setDeletingId(null);
    }
  }

  if (authLoading || loading) {
    return <div className="p-8 text-center text-gray-500">로딩 중...</div>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">찜 목록</h1>

      {wishlist.length === 0 ? (
        <Card className="p-12 text-center">
          <Heart className="mx-auto mb-4 h-12 w-12 text-gray-300" />
          <p className="mb-4 text-gray-500">찜한 상품이 없습니다.</p>
          <Link to="/products">
            <Button>쇼핑하러 가기</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {wishlist.map((item) => {
            const product = item.product;
            const hasDiscount = product.comparePrice && product.comparePrice > product.price;
            const discountPercent = hasDiscount
              ? Math.round(((product.comparePrice! - product.price) / product.comparePrice!) * 100)
              : 0;
            const imageUrl = product.thumbnail || product.images?.[0] || '/placeholder.png';

            return (
              <Card key={item.id} className="overflow-hidden">
                <Link to={`/products/${product.slug}`} className="block">
                  <div className="relative aspect-square bg-gray-100">
                    <img
                      src={imageUrl}
                      alt={product.name}
                      className="object-cover transition-transform hover:scale-105 h-full w-full"
                    />
                    {hasDiscount && (
                      <span className="absolute left-2 top-2 rounded bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white">
                        {discountPercent}% OFF
                      </span>
                    )}
                    {product.stock === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <span className="rounded bg-black/70 px-3 py-1 text-sm text-white">품절</span>
                      </div>
                    )}
                  </div>
                </Link>
                <div className="p-4">
                  <Link to={`/products/${product.slug}`}>
                    <h3 className="mb-1 line-clamp-2 text-sm font-medium hover:text-blue-600">
                      {product.name}
                    </h3>
                  </Link>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="font-bold">{formatCurrency(product.price)}</span>
                    {hasDiscount && (
                      <span className="text-sm text-gray-400 line-through">
                        {formatCurrency(product.comparePrice!)}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-red-500 hover:bg-red-50 hover:text-red-600"
                    onClick={() => handleDelete(product.id)}
                    disabled={deletingId === product.id}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    {deletingId === product.id ? '삭제 중...' : '찜 해제'}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
