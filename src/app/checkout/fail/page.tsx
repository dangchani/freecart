import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { XCircle } from 'lucide-react';

function FailContent() {
  const [searchParams] = useSearchParams();
  const message = searchParams.get('message') || '결제가 취소되었습니다.';
  const code = searchParams.get('code');

  return (
    <div className="container flex min-h-[60vh] items-center justify-center py-8">
      <Card className="p-8 text-center max-w-md">
        <div className="mb-4 flex justify-center">
          <XCircle className="h-16 w-16 text-red-500" />
        </div>

        <h2 className="mb-2 text-2xl font-bold">결제 실패</h2>
        <p className="mb-2 text-gray-600">{message}</p>
        {code && (
          <p className="mb-6 text-sm text-gray-500">오류 코드: {code}</p>
        )}

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

export default function CheckoutFailPage() {
  return <FailContent />;
}
