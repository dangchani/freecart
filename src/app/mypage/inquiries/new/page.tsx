import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const categories = [
  { value: 'order', label: '주문' },
  { value: 'shipping', label: '배송' },
  { value: 'product', label: '상품' },
  { value: 'payment', label: '결제' },
  { value: 'refund', label: '환불' },
  { value: 'other', label: '기타' },
];

export default function NewInquiryPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [form, setForm] = useState({ category: '', title: '', content: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth/login');
    }
  }, [user, authLoading, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.category) { setError('문의 유형을 선택해주세요.'); return; }
    if (!form.title.trim()) { setError('제목을 입력해주세요.'); return; }
    if (!form.content.trim()) { setError('내용을 입력해주세요.'); return; }
    if (form.content.trim().length < 10) { setError('내용을 10자 이상 입력해주세요.'); return; }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        navigate('/mypage/inquiries');
      } else {
        setError(json.error || '문의 등록에 실패했습니다.');
      }
    } catch (err) {
      console.error('문의 등록 실패:', err);
      setError('문의 등록 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) {
    return <div className="p-8 text-center text-gray-500">로딩 중...</div>;
  }

  return (
    <div>
      <Link
        to="/mypage/inquiries"
        className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        문의 목록으로
      </Link>

      <h1 className="mb-6 text-2xl font-bold">1:1 문의하기</h1>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              문의 유형 <span className="text-red-500">*</span>
            </label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">문의 유형을 선택하세요</option>
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              제목 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="문의 제목을 입력하세요"
              maxLength={100}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="mt-1 text-right text-xs text-gray-400">{form.title.length}/100</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              내용 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="문의 내용을 상세히 입력해주세요. (최소 10자)"
              rows={8}
              maxLength={2000}
              className="w-full resize-none rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="mt-1 text-right text-xs text-gray-400">{form.content.length}/2000</p>
          </div>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <div className="flex justify-end gap-3">
            <Link to="/mypage/inquiries">
              <Button type="button" variant="outline">
                취소
              </Button>
            </Link>
            <Button type="submit" disabled={submitting}>
              {submitting ? '제출 중...' : '문의 등록'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
