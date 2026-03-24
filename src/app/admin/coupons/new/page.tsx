import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, RefreshCw } from 'lucide-react';

interface CouponForm {
  name: string;
  code: string;
  description: string;
  discountType: 'percent' | 'fixed';
  discountValue: string;
  minOrderAmount: string;
  maxDiscountAmount: string;
  totalQuantity: string;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
}

function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 10; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default function AdminCouponNewPage() {
  const navigate = useNavigate();
  const { loading: authLoading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState<CouponForm>({
    name: '',
    code: '',
    description: '',
    discountType: 'percent',
    discountValue: '',
    minOrderAmount: '',
    maxDiscountAmount: '',
    totalQuantity: '',
    startsAt: '',
    expiresAt: '',
    isActive: true,
  });

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.code || !form.discountValue) {
      setError('이름, 코드, 할인값은 필수입니다.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        name: form.name,
        code: form.code.toUpperCase(),
        description: form.description,
        discountType: form.discountType,
        discountValue: parseFloat(form.discountValue),
        minOrderAmount: form.minOrderAmount ? parseFloat(form.minOrderAmount) : null,
        maxDiscountAmount: form.maxDiscountAmount ? parseFloat(form.maxDiscountAmount) : null,
        totalQuantity: form.totalQuantity ? parseInt(form.totalQuantity) : null,
        startsAt: form.startsAt || null,
        expiresAt: form.expiresAt || null,
        isActive: form.isActive,
      };

      const response = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      alert('쿠폰이 생성되었습니다.');
      navigate('/admin/coupons');
    } catch (err) {
      setError(err instanceof Error ? err.message : '쿠폰 생성 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) return <div className="container py-8">로딩 중...</div>;

  return (
    <div className="container py-8">
      <Link
        to="/admin/coupons"
        className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        쿠폰 목록으로 돌아가기
      </Link>

      <h1 className="mb-6 text-3xl font-bold">쿠폰 생성</h1>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>
      )}

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                쿠폰명 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="여름 특별 할인"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                쿠폰 코드 <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  name="code"
                  value={form.code}
                  onChange={handleChange}
                  required
                  className="flex-1 rounded-md border px-3 py-2 font-mono text-sm uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="SUMMER2024"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setForm((prev) => ({ ...prev, code: generateCode() }))}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">설명</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={2}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="쿠폰에 대한 설명을 입력하세요"
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                할인 유형 <span className="text-red-500">*</span>
              </label>
              <select
                name="discountType"
                value={form.discountType}
                onChange={handleChange}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="percent">퍼센트 할인 (%)</option>
                <option value="fixed">정액 할인 (원)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                할인값 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="discountValue"
                value={form.discountValue}
                onChange={handleChange}
                required
                min="0"
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={form.discountType === 'percent' ? '10' : '5000'}
              />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">최소 주문금액</label>
              <input
                type="number"
                name="minOrderAmount"
                value={form.minOrderAmount}
                onChange={handleChange}
                min="0"
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="10000"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">최대 할인금액</label>
              <input
                type="number"
                name="maxDiscountAmount"
                value={form.maxDiscountAmount}
                onChange={handleChange}
                min="0"
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="5000"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">발급 수량 (비워두면 무제한)</label>
            <input
              type="number"
              name="totalQuantity"
              value={form.totalQuantity}
              onChange={handleChange}
              min="1"
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="100"
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">시작일</label>
              <input
                type="datetime-local"
                name="startsAt"
                value={form.startsAt}
                onChange={handleChange}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">만료일</label>
              <input
                type="datetime-local"
                name="expiresAt"
                value={form.expiresAt}
                onChange={handleChange}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              name="isActive"
              checked={form.isActive}
              onChange={handleChange}
              className="h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
              즉시 활성화
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? '생성 중...' : '쿠폰 생성'}
            </Button>
            <Link to="/admin/coupons">
              <Button type="button" variant="outline">취소</Button>
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
