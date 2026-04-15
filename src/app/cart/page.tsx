import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { PageSection } from '@/components/theme/PageSection';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { getCart, updateCartItem, removeFromCart } from '@/services/cart';
import { getShippingSettings } from '@/services/settings';
import { useAuth } from '@/hooks/useAuth';
import { useCartStore } from '@/store/cart';
import { Trash2 } from 'lucide-react';
import type { CartItem } from '@/types';

export default function CartPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const localCart = useCartStore();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [shippingConfig, setShippingConfig] = useState({ shippingFee: 3000, freeShippingThreshold: 50000 });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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

  function toggleSelectAll() {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleRemoveSelected() {
    if (selectedIds.size === 0) return;
    if (!confirm(`선택한 ${selectedIds.size}개 상품을 삭제하시겠습니까?`)) return;
    try {
      for (const itemId of selectedIds) {
        if (isGuest) {
          const item = items.find((i) => i.id === itemId);
          if (item) localCart.removeItem(item.productId);
        } else {
          await removeFromCart(itemId);
        }
      }
      setSelectedIds(new Set());
      await loadCart();
    } catch (error) {
      console.error('Failed to remove items:', error);
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

  // 선택된 항목이 있으면 선택 기준으로, 없으면 전체 기준으로 요약
  const summaryItems = selectedIds.size > 0 ? items.filter((i) => selectedIds.has(i.id)) : items;
  const subtotal = summaryItems.reduce(
    (sum, item) => sum + (item.product?.salePrice || 0) * item.quantity,
    0
  );
  const shippingCost = subtotal >= shippingConfig.freeShippingThreshold ? 0 : shippingConfig.shippingFee;
  const total = subtotal + shippingCost;

  function handleOrderSelected() {
    if (!user) {
      navigate('/auth/login');
      return;
    }
    const ids = [...selectedIds].join(',');
    navigate(`/checkout?itemIds=${ids}`);
  }

  function handleOrderAll() {
    if (!user) {
      navigate('/auth/login');
      return;
    }
    navigate('/checkout');
  }

  return (
    <>
      <PageSection id="cart" />
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
            <div className="mb-3 flex items-center gap-3 px-1">
              <input
                type="checkbox"
                id="select-all"
                checked={selectedIds.size === items.length}
                onChange={toggleSelectAll}
                className="h-4 w-4 cursor-pointer"
              />
              <label htmlFor="select-all" className="cursor-pointer text-sm">
                전체선택 ({selectedIds.size}/{items.length})
              </label>
              {selectedIds.size > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRemoveSelected}
                  className="ml-auto text-red-500 border-red-200 hover:bg-red-50"
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  선택 삭제 ({selectedIds.size})
                </Button>
              )}
            </div>
            {items.map((item) => (
              <Card key={item.id} className={`mb-4 p-4 transition-colors ${selectedIds.has(item.id) ? 'border-primary/50 bg-primary/5' : ''}`}>
                <div className="flex gap-4">
                  <div className="flex items-start pt-1">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="h-4 w-4 cursor-pointer"
                    />
                  </div>
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

              {selectedIds.size > 0 && (
                <p className="mb-3 text-sm text-blue-600">
                  선택 {selectedIds.size}개 항목 기준
                </p>
              )}

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

              <div className="mt-6 space-y-2">
                {selectedIds.size > 0 ? (
                  <>
                    <Button className="w-full" size="lg" onClick={handleOrderSelected}>
                      선택 주문하기 ({selectedIds.size}개)
                    </Button>
                    <Button
                      className="w-full"
                      size="lg"
                      variant="outline"
                      onClick={handleOrderAll}
                    >
                      전체 주문하기
                    </Button>
                  </>
                ) : (
                  <Button className="w-full" size="lg" onClick={handleOrderAll}>
                    주문하기
                  </Button>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
