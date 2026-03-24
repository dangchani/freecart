import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import { ArrowLeft, Plus, Edit, Trash2 } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  stock: number;
  thumbnail: string;
  isActive: boolean;
}

export default function AdminProductsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      loadProducts();
    }
  }, [user, authLoading, navigate]);

  async function loadProducts() {
    try {
      const response = await fetch('/api/products');
      const data = await response.json();

      if (data.success) {
        setProducts(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(productId: string) {
    if (!confirm('상품을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || '상품 삭제에 실패했습니다.');
      }

      alert('상품이 삭제되었습니다.');
      await loadProducts();
    } catch (error) {
      console.error('Failed to delete product:', error);
      alert(error instanceof Error ? error.message : '상품 삭제 중 오류가 발생했습니다.');
    }
  }

  if (authLoading || loading) {
    return <div className="container py-8">로딩 중...</div>;
  }

  return (
    <div className="container py-8">
      <Link to="/admin" className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="mr-1 h-4 w-4" />
        대시보드로 돌아가기
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">상품 관리</h1>
        <Link to="/admin/products/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            상품 등록
          </Button>
        </Link>
      </div>

      {products.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="mb-4 text-gray-500">등록된 상품이 없습니다.</p>
          <Link to="/admin/products/new">
            <Button>첫 상품 등록하기</Button>
          </Link>
        </Card>
      ) : (
        <Card>
          <div className="divide-y">
            {products.map((product) => (
              <div key={product.id} className="flex items-center gap-4 p-4">
                <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-gray-100">
                  <img
                    src={product.thumbnail || '/placeholder.png'}
                    alt={product.name}
                    className="object-cover w-full h-full"
                  />
                </div>

                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <h3 className="font-bold">{product.name}</h3>
                    <Badge variant={product.isActive ? 'default' : 'secondary'}>
                      {product.isActive ? '판매중' : '판매중지'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>{formatCurrency(product.price)}</span>
                    <span>재고: {product.stock}개</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Link to={`/admin/products/${product.slug}/edit`}>
                    <Button size="sm" variant="outline">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(product.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
