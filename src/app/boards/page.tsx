import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { PageSection } from '@/components/theme/PageSection';
import { MessageSquare, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Board {
  id: string;
  name: string;
  slug: string;
  description: string;
  postCount: number;
}

export default function BoardsPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBoards();
  }, []);

  async function loadBoards() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('boards')
        .select('id, name, slug, description')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      // Get post counts for each board
      const boardsWithCounts = await Promise.all(
        (data || []).map(async (board: any) => {
          const { count } = await supabase
            .from('posts')
            .select('*', { count: 'exact', head: true })
            .eq('board_id', board.id)
            .eq('is_visible', true);

          return {
            id: board.id,
            name: board.name,
            slug: board.slug,
            description: board.description || '',
            postCount: count || 0,
          };
        })
      );

      setBoards(boardsWithCounts);
    } catch (error) {
      console.error('Failed to load boards:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="container py-8">로딩 중...</div>;
  }

  return (
    <>
      <PageSection id="boards" />
      <div className="container py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">커뮤니티</h1>
        <p className="text-gray-600">다양한 주제로 소통하세요</p>
      </div>

      {boards.length === 0 ? (
        <Card className="p-12 text-center">
          <MessageSquare className="mx-auto mb-4 h-12 w-12 text-gray-400" />
          <p className="text-gray-500">게시판이 없습니다.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <Link key={board.id} to={`/boards/${board.slug}`}>
              <Card className="p-6 transition-shadow hover:shadow-md cursor-pointer h-full">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                    <MessageSquare className="h-6 w-6 text-blue-600" />
                  </div>
                  <h2 className="font-bold text-lg">{board.name}</h2>
                </div>
                <p className="mb-3 text-sm text-gray-600">{board.description}</p>
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <Users className="h-4 w-4" />
                  <span>{board.postCount || 0}개의 게시글</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
    </>
  );
}
