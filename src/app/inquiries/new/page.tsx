import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft } from 'lucide-react';

const categoryOptions = [
  { value: 'order', label: '주문' },
  { value: 'shipping', label: '배송' },
  { value: 'product', label: '상품' },
  { value: 'payment', label: '결제' },
  { value: 'refund', label: '환불' },
  { value: 'etc', label: '기타' },
];

export default function InquiryNewPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [category, setCategory] = useState('order');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!authLoading && !user) {
    navigate('/auth/login');
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError('제목과 내용을 입력해주세요.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, title, content }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      alert('문의가 등록되었습니다.');
      navigate('/mypage/inquiries');
    } catch (err) {
      setError(err instanceof Error ? err.message : '문의 등록 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) return <div className="container py-8">로딩 중...</div>;

  return (
    <div className="container py-8 max-w-2xl">
      <Link
        to="/mypage/inquiries"
        className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        문의 목록으로 돌아가기
      </Link>

      <h1 className="mb-6 text-3xl font-bold">1:1 문의 작성</h1>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>
      )}

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              분류 <span className="text-red-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {categoryOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              제목 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="문의 제목을 입력하세요"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              내용 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={8}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="문의 내용을 자세히 입력해주세요"
            />
          </div>

          <p className="text-xs text-gray-500">
            * 문의 답변은 마이페이지 &gt; 1:1 문의에서 확인하실 수 있습니다.
          </p>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? '등록 중...' : '문의 등록'}
            </Button>
            <Link to="/mypage/inquiries">
              <Button type="button" variant="outline">취소</Button>
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
