import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { dispatchThemeEvent } from '@/lib/theme';

function SuccessContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [confirming, setConfirming] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const orderId = searchParams.get('orderId');
  const paymentKey = searchParams.get('paymentKey');
  const amount = searchParams.get('amount');

  useEffect(() => {
    if (!orderId || !paymentKey || !amount) {
      setError('잘못된 접근입니다.');
      setConfirming(false);
      return;
    }
    confirmPayment();
  }, [orderId, paymentKey, amount]);

  async function confirmPayment() {
    try {
      const supabase = createClient();

      // Edge Function 호출 - 서버에서 PG 검증 + 금액 위변조 방지
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/verify-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ paymentKey, orderId, amount: parseInt(amount || '0', 10) }),
      });

      const result = await res.json();

      if (!result.success) {
        throw new Error(result.error || '결제 검증에 실패했습니다.');
      }

      dispatchThemeEvent('checkout-complete', {
        orderId,
        amount: parseInt(amount || '0', 10),
        paymentKey,
      });
      setConfirming(false);
    } catch (err) {
      console.error('Payment confirmation failed:', err);
      setError(err instanceof Error ? err.message : '결제 확인 중 오류가 발생했습니다.');
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="container flex min-h-[60vh] items-center justify-center py-8">
        <Card className="p-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"></div>
          </div>
          <h2 className="text-xl font-bold">결제를 확인하고 있습니다...</h2>
          <p className="mt-2 text-gray-500">잠시만 기다려주세요.</p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container flex min-h-[60vh] items-center justify-center py-8">
        <Card className="p-8 text-center max-w-md">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <svg
                className="h-8 w-8 text-red-600"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
          </div>
          <h2 className="mb-2 text-2xl font-bold">결제 확인 실패</h2>
          <p className="mb-6 text-gray-600">{error}</p>
          <div className="flex gap-2">
            <Button variant="outline" asChild className="flex-1">
              <Link to="/cart">장바구니로</Link>
            </Button>
            <Button asChild className="flex-1">
              <Link to="/">홈으로</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container flex min-h-[60vh] items-center justify-center py-8">
      <Card className="p-8 text-center max-w-md">
        <div className="mb-4 flex justify-center">
          <CheckCircle2 className="h-16 w-16 text-green-500" />
        </div>

        <h2 className="mb-2 text-2xl font-bold">주문이 완료되었습니다!</h2>
        <p className="mb-6 text-gray-600">
          주문해주셔서 감사합니다.<br />
          주문 내역은 마이페이지에서 확인하실 수 있습니다.
        </p>

        <div className="mb-6 rounded-lg bg-gray-50 p-4">
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-gray-600">주문번호</span>
            <span className="font-medium">{orderId}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">결제금액</span>
            <span className="font-bold text-lg">{formatCurrency(parseInt(amount || '0'))}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" asChild className="flex-1">
            <Link to="/mypage/orders">주문내역</Link>
          </Button>
          <Button asChild className="flex-1">
            <Link to="/">홈으로</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return <SuccessContent />;
}
