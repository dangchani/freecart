import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Plus, Trash2, Edit } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Board {
  id: string;
  name: string;
  slug: string;
  description: string;
  postCount: number;
}

export default function BoardsManagementPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBoard, setEditingBoard] = useState<Board | null>(null);
  const [formData, setFormData] = useState({ name: '', slug: '', description: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      loadBoards();
    }
  }, [user, authLoading, navigate]);

  async function loadBoards() {
    try {
      const response = await fetch('/api/boards');
      const data = await response.json();

      if (data.success) {
        setBoards(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load boards:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(board: Board) {
    setEditingBoard(board);
    setFormData({
      name: board.name,
      slug: board.slug,
      description: board.description,
    });
    setShowForm(true);
  }

  function handleCancelEdit() {
    setEditingBoard(null);
    setFormData({ name: '', slug: '', description: '' });
    setShowForm(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSubmitting(true);

      const url = editingBoard ? `/api/boards/${editingBoard.slug}` : '/api/boards';
      const method = editingBoard ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || '게시판 저장에 실패했습니다.');
      }

      alert(editingBoard ? '게시판이 수정되었습니다.' : '게시판이 생성되었습니다.');
      handleCancelEdit();
      await loadBoards();
    } catch (error) {
      console.error('Failed to save board:', error);
      alert(error instanceof Error ? error.message : '게시판 저장 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(boardSlug: string) {
    if (!confirm('게시판을 삭제하시겠습니까? 모든 게시글도 함께 삭제됩니다.')) {
      return;
    }

    try {
      const response = await fetch(`/api/boards/${boardSlug}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || '게시판 삭제에 실패했습니다.');
      }

      alert('게시판이 삭제되었습니다.');
      await loadBoards();
    } catch (error) {
      console.error('Failed to delete board:', error);
      alert(error instanceof Error ? error.message : '게시판 삭제 중 오류가 발생했습니다.');
    }
  }

  if (authLoading || loading) {
    return <div className="container py-8">로딩 중...</div>;
  }

  return (
    <div className="container py-8">
      <Link to="/admin" className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="mr-1 h-4 w-4" />
        대시보드로 돌아가기
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">게시판 관리</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-2 h-4 w-4" />
          {showForm ? '취소' : '게시판 추가'}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6 p-6">
          <h2 className="mb-4 text-lg font-bold">
            {editingBoard ? '게시판 수정' : '새 게시판'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">게시판명</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="게시판명"
                required
              />
            </div>

            <div>
              <Label htmlFor="slug">URL 슬러그</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="board-slug"
                required
                disabled={!!editingBoard}
              />
              {editingBoard && (
                <p className="mt-1 text-xs text-gray-500">슬러그는 수정할 수 없습니다.</p>
              )}
            </div>

            <div>
              <Label htmlFor="description">설명</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="게시판 설명"
                rows={3}
                required
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? '저장 중...' : '저장'}
              </Button>
              <Button type="button" variant="outline" onClick={handleCancelEdit}>
                취소
              </Button>
            </div>
          </form>
        </Card>
      )}

      {boards.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500">등록된 게시판이 없습니다.</p>
        </Card>
      ) : (
        <Card>
          <div className="divide-y">
            {boards.map((board) => (
              <div key={board.id} className="flex items-center justify-between p-4">
                <div className="flex-1">
                  <h3 className="font-bold">{board.name}</h3>
                  <p className="text-sm text-gray-500">{board.slug}</p>
                  <p className="text-sm text-gray-600">{board.description}</p>
                  <p className="mt-1 text-xs text-gray-500">게시글: {board.postCount || 0}개</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(board)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(board.slug)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
