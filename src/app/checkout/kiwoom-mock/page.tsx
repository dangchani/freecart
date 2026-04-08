/**
 * 키움페이 Mock 결제 페이지 (개발/테스트용)
 * /checkout/kiwoom-mock?orderId=...&amount=...&orderName=...&successUrl=...&failUrl=...
 */
import { useEffect, useState } from 'react';
import { CreditCard, X, CheckCircle } from 'lucide-react';

export default function KiwoomMockPage() {
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('orderId') || '';
  const amount = Number(params.get('amount') || 0);
  const orderName = params.get('orderName') || '주문';
  const successUrl = params.get('successUrl') || '/';
  const failUrl = params.get('failUrl') || '/checkout/fail';

  const [step, setStep] = useState<'select' | 'processing' | 'done'>('select');
  const [cardNum, setCardNum] = useState('');
  const [expiry, setExpiry] = useState('');

  function handlePay() {
    setStep('processing');
    setTimeout(() => {
      setStep('done');
      setTimeout(() => {
        // paymentKey mock — 실제 키움페이 형식을 흉내냄
        const paymentKey = `kiwoom_mock_${orderId}_${Date.now()}`;
        const url = new URL(successUrl, window.location.origin);
        url.searchParams.set('paymentKey', paymentKey);
        url.searchParams.set('orderId', orderId);
        url.searchParams.set('amount', String(amount));
        window.location.href = url.toString();
      }, 800);
    }, 1200);
  }

  function handleCancel() {
    const url = new URL(failUrl, window.location.origin);
    url.searchParams.set('orderId', orderId);
    url.searchParams.set('message', '사용자가 결제를 취소하였습니다.');
    window.location.href = url.toString();
  }

  function formatCardNum(v: string) {
    const digits = v.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  }

  function formatExpiry(v: string) {
    const digits = v.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) return digits.slice(0, 2) + '/' + digits.slice(2);
    return digits;
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-900/80">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* 헤더 */}
        <div className="bg-[#003087] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-white" />
            <span className="text-white font-bold text-sm">키움페이 (테스트)</span>
          </div>
          <button onClick={handleCancel} className="text-white/70 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === 'select' && (
          <div className="p-6 space-y-4">
            <div className="rounded-lg bg-blue-50 px-4 py-3">
              <p className="text-xs text-gray-500">결제 금액</p>
              <p className="text-2xl font-bold text-gray-900">{amount.toLocaleString()}원</p>
              <p className="text-xs text-gray-500 mt-0.5 truncate">{orderName}</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">카드번호</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0000 0000 0000 0000"
                  value={cardNum}
                  onChange={(e) => setCardNum(formatCardNum(e.target.value))}
                  className="w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#003087]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">유효기간</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="MM/YY"
                    value={expiry}
                    onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                    className="w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#003087]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">CVC</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    placeholder="000"
                    maxLength={3}
                    className="w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#003087]"
                  />
                </div>
              </div>
            </div>

            <p className="text-[10px] text-center text-gray-400">
              ⚠️ 테스트 환경입니다. 실제 결제가 발생하지 않습니다.
            </p>

            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handlePay}
                className="flex-1 rounded-lg bg-[#003087] py-2.5 text-sm font-bold text-white hover:bg-[#002070]"
              >
                결제하기
              </button>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="p-10 flex flex-col items-center gap-4">
            <span className="h-10 w-10 animate-spin rounded-full border-4 border-[#003087] border-t-transparent" />
            <p className="text-sm text-gray-600">결제 처리 중...</p>
          </div>
        )}

        {step === 'done' && (
          <div className="p-10 flex flex-col items-center gap-3">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <p className="text-sm font-medium text-gray-800">결제 완료</p>
            <p className="text-xs text-gray-500">주문 완료 페이지로 이동합니다...</p>
          </div>
        )}
      </div>
    </div>
  );
}
