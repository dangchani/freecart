import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { getCart, updateCartItem, removeFromCart } from '@/services/cart';
import { getShippingSettings } from '@/services/settings';
import { useAuth } from '@/hooks/useAuth';
import { useCartStore } from '@/store/cart';
import type { CartItem } from '@/types';

export default function CartPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const localCart = useCartStore();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [shippingConfig, setShippingConfig] = useState({ shippingFee: 3000, freeShippingThreshold: 50000 });
  const isGuest = !user;

  useEffect(() => {
    if (!authLoading) {
      loadCart();
    }
  }, [user, authLoading]);

  async function loadCart() {
    try {
      const shipping = await getShippingSettings();
      setShippingConfig(shipping);

      if (user) {
        // 로그인 사용자: DB에서 장바구니 로드
        const cartItems = await getCart(user.id);
        setItems(cartItems);
      } else {
        // 비로그인: Zustand 로컬 장바구니 사용
        setItems(localCart.items.map((item, idx) => ({
          id: `local-${idx}`,
          productId: item.product.id,
          quantity: item.quantity,
          product: item.product,
        } as any)));
      }
    } catch (error) {
      console.error('Failed to load cart:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateQuantity(itemId: string, quantity: number) {
    try {
      if (isGuest) {
        const item = items.find(i => i.id === itemId);
        if (item) localCart.updateQuantity(item.productId, quantity);
        await loadCart();
      } else {
        await updateCartItem(itemId, quantity);
        await loadCart();
      }
    } catch (error) {
      console.error('Failed to update quantity:', error);
    }
  }

  async function handleRemove(itemId: string) {
    try {
      if (isGuest) {
        const item = items.find(i => i.id === itemId);
        if (item) localCart.removeItem(item.productId);
        await loadCart();
      } else {
        await removeFromCart(itemId);
        await loadCart();
      }
    } catch (error) {
      console.error('Failed to remove item:', error);
    }
  }

  if (authLoading || loading) {
    return <div className="container py-8">로딩 중...</div>;
  }

  const subtotal = items.reduce(
    (sum, item) => sum + (item.product?.salePrice || 0) * item.quantity,
    0
  );
  const shippingCost = subtotal >= shippingConfig.freeShippingThreshold ? 0 : shippingConfig.shippingFee;
  const total = subtotal + shippingCost;

  return (
    <div className="container py-8">
      <h1 className="mb-8 text-3xl font-bold">장바구니</h1>

      {items.length === 0 ? (
        <div className="py-12 text-center">
          <p className="mb-4 text-muted-foreground">장바구니가 비어있습니다.</p>
          <Link to="/products">
            <Button>쇼핑 계속하기</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {items.map((item) => (
              <Card key={item.id} className="mb-4 p-4">
                <div className="flex gap-4">
                  <div className="relative h-24 w-24 overflow-hidden rounded-lg bg-gray-100">
                    <img
                      src={item.product?.images?.find((img) => img.isPrimary)?.url || item.product?.images?.[0]?.url || '/placeholder.png'}
                      alt={item.product?.name || ''}
                      className="object-cover w-full h-full"
                    />
                  </div>

                  <div className="flex-1">
                    <h3 className="font-medium">{item.product?.name}</h3>
                    <p className="text-lg font-bold">
                      {formatCurrency(item.product?.salePrice || 0)}
                    </p>

                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                      >
                        -
                      </Button>
                      <span className="w-12 text-center">{item.quantity}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                      >
                        +
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemove(item.id)}
                        className="ml-auto text-red-500"
                      >
                        삭제
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div>
            <Card className="p-6">
              <h2 className="mb-4 text-lg font-bold">주문 요약</h2>

              <div className="space-y-2 border-b pb-4">
                <div className="flex justify-between">
                  <span>상품 금액</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>배송비</span>
                  <span>{shippingCost === 0 ? '무료' : formatCurrency(shippingCost)}</span>
                </div>
              </div>

              <div className="mt-4 flex justify-between text-lg font-bold">
                <span>총 금액</span>
                <span>{formatCurrency(total)}</span>
              </div>

              <Link to="/checkout" className="block">
                <Button className="mt-6 w-full" size="lg">
                  주문하기
                </Button>
              </Link>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
