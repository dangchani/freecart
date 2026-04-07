import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function AdminNoticeEditPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (!user) { navigate('/auth/login'); return; }
      loadNotice();
    }
  }, [user, authLoading]);

  async function loadNotice() {
    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from('notices')
        .select('title, content, is_pinned')
        .eq('id', id!)
        .single();
      if (fetchError) throw fetchError;
      setTitle(data.title);
      setContent(data.content);
      setIsPinned(data.is_pinned);
    } catch {
      setError('공지사항을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
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
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from('notices')
        .update({ title, content, is_pinned: isPinned })
        .eq('id', id!);
      if (updateError) throw updateError;
      alert('공지사항이 수정되었습니다.');
      navigate('/admin/notices');
    } catch (err) {
      setError(err instanceof Error ? err.message : '공지사항 수정 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || loading) return <div className="container py-8">로딩 중...</div>;

  return (
    <div className="container py-8">
      <Link
        to="/admin/notices"
        className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        공지사항 목록으로 돌아가기
      </Link>

      <h1 className="mb-6 text-3xl font-bold">공지사항 수정</h1>

      {error && <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>}

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
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
              placeholder="공지 제목을 입력하세요"
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
              rows={10}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="공지 내용을 입력하세요"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPinned"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="isPinned" className="text-sm font-medium text-gray-700">
              상단 고정
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? '수정 중...' : '수정 완료'}
            </Button>
            <Link to="/admin/notices">
              <Button type="button" variant="outline">취소</Button>
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
