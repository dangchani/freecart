import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getBankTransferSettings } from '@/services/settings';
import { formatCurrency } from '@/lib/utils';
import { CheckCircle, Copy } from 'lucide-react';

export default function BankTransferPage() {
  const [searchParams] = useSearchParams();
  const orderNumber = searchParams.get('orderNumber') || '';
  const amount = parseInt(searchParams.get('amount') || '0');

  const [bank, setBank] = useState({ bankName: '', accountNumber: '', accountHolder: '', depositDeadlineHours: 24 });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getBankTransferSettings().then(setBank);
  }, []);

  function copyAccount() {
    navigator.clipboard.writeText(`${bank.bankName} ${bank.accountNumber}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="container mx-auto max-w-lg px-4 py-16">
      <div className="mb-6 text-center">
        <CheckCircle className="mx-auto mb-3 h-14 w-14 text-green-500" />
        <h1 className="text-2xl font-bold text-gray-900">주문이 완료되었습니다</h1>
        <p className="mt-1 text-sm text-gray-500">주문번호: <span className="font-mono font-medium text-gray-700">{orderNumber}</span></p>
      </div>

      <Card className="p-6">
        <h2 className="mb-4 font-bold text-gray-800">입금 계좌 정보</h2>

        <div className="space-y-3 rounded-md bg-blue-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">은행</p>
              <p className="font-medium">{bank.bankName}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">예금주</p>
              <p className="font-medium">{bank.accountHolder}</p>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-500">계좌번호</p>
            <div className="flex items-center gap-2">
              <p className="text-lg font-bold font-mono">{bank.accountNumber}</p>
              <button
                onClick={copyAccount}
                className="flex items-center gap-1 rounded-md border bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
              >
                <Copy className="h-3 w-3" />
                {copied ? '복사됨' : '복사'}
              </button>
            </div>
          </div>
          <div className="border-t border-blue-200 pt-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">입금 금액</p>
              <p className="text-xl font-bold text-blue-600">{formatCurrency(amount)}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-md bg-orange-50 p-3 text-sm text-orange-700">
          주문 후 <strong>{bank.depositDeadlineHours}시간 이내</strong> 입금이 확인되지 않으면 주문이 자동 취소됩니다.
        </div>

        <p className="mt-4 text-xs text-gray-400">
          입금자명을 주문자명과 동일하게 입력해주세요. 입금 확인 후 배송이 진행됩니다.
        </p>
      </Card>

      <div className="mt-6 flex gap-3">
        <Link to="/mypage/orders" className="flex-1">
          <Button variant="outline" className="w-full">주문 내역 보기</Button>
        </Link>
        <Link to="/" className="flex-1">
          <Button className="w-full">쇼핑 계속하기</Button>
        </Link>
      </div>
    </div>
  );
}
