import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { ArrowLeft, Pin, MessageCircle, Eye, Edit } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getSystemSetting } from '@/lib/permissions';

interface Post {
  id: string;
  title: string;
  author: string;
  categoryName: string;
  isPinned: boolean;
  isNotice: boolean;
  viewCount: number;
  commentCount: number;
  createdAt: string;
}

interface BoardCategory {
  id: string;
  name: string;
}

interface Board {
  id: string;
  name: string;
  description: string;
  writeLevel: number;
  useCategory: boolean;
  useComment: boolean;
}

export default function BoardDetailPage() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAdmin } = useAuth();
  const [board, setBoard] = useState<Board | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<BoardCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLevel, setUserLevel] = useState<number>(0); // 0 = 비로그인
  const [useLevels, setUseLevels] = useState(true);

  const selectedCategory = searchParams.get('category') || '';

  useEffect(() => {
    loadBoard();
  }, [slug]);

  useEffect(() => {
    if (board) loadPosts();
  }, [board, selectedCategory]);

  useEffect(() => {
    getSystemSetting<boolean>('use_user_levels').then(val => {
      setUseLevels(val !== false);
    });
  }, []);

  // 로그인 사용자 레벨 조회
  useEffect(() => {
    async function loadUserLevel() {
      if (!user) { setUserLevel(0); return; }
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('users')
          .select('user_levels(level)')
          .eq('id', user.id)
          .single();
        setUserLevel((data?.user_levels as any)?.level ?? 1);
      } catch {
        setUserLevel(1); // 로그인했으면 기본 1레벨
      }
    }
    loadUserLevel();
  }, [user]);

  async function loadBoard() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('boards')
        .select('id, name, description, write_level, use_category, use_comment, board_categories(id, name, sort_order)')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        navigate('/boards');
        return;
      }

      setBoard({
        id: data.id,
        name: data.name,
        description: data.description || '',
        writeLevel: data.write_level,
        useCategory: data.use_category,
        useComment: data.use_comment,
      });

      const cats = ((data.board_categories as any[]) || [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((c) => ({ id: c.id, name: c.name }));
      setCategories(cats);
    } catch (error) {
      console.error('Failed to load board:', error);
    }
  }

  async function loadPosts() {
    if (!board) return;
    try {
      const supabase = createClient();
      let query = supabase
        .from('posts')
        .select('id, title, is_pinned, is_notice, view_count, comment_count, created_at, user_id, users(name), board_categories(name)')
        .eq('board_id', board.id)
        .eq('is_visible', true)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (selectedCategory) {
        // category_id 먼저 조회
        const cat = categories.find((c) => c.id === selectedCategory);
        if (cat) query = query.eq('category_id', selectedCategory);
      }

      const { data, error } = await query;
      if (error) throw error;

      setPosts(
        (data || []).map((p: any) => ({
          id: p.id,
          title: p.title,
          author: p.users?.name || '익명',
          categoryName: p.board_categories?.name || '',
          isPinned: p.is_pinned,
          isNotice: p.is_notice,
          viewCount: p.view_count,
          commentCount: p.comment_count,
          createdAt: p.created_at,
        }))
      );
    } catch (error) {
      console.error('Failed to load posts:', error);
    } finally {
      setLoading(false);
    }
  }

  // 글쓰기 권한 체크: admin은 항상 허용, 등급 기능 ON이면 write_level 비교, OFF면 로그인만 확인
  const canWrite = board ? (isAdmin || (useLevels ? userLevel >= board.writeLevel : !!user)) : false;

  if (loading) {
    return (
      <div className="container py-8">
        <div className="h-8 w-48 bg-gray-200 animate-pulse rounded mb-4" />
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-gray-200 animate-pulse rounded" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <Link to="/boards" className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="mr-1 h-4 w-4" />
        커뮤니티 목록으로
      </Link>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold">{board?.name}</h1>
          <p className="text-gray-600">{board?.description}</p>
        </div>
        {canWrite ? (
          <Link to={`/boards/${slug}/posts/new`}>
            <Button>
              <Edit className="mr-2 h-4 w-4" />
              글쓰기
            </Button>
          </Link>
        ) : !user ? (
          <Link to="/auth/login">
            <Button variant="outline">로그인 후 글쓰기</Button>
          </Link>
        ) : null}
      </div>

      {/* 카테고리 필터 */}
      {board?.useCategory && categories.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setSearchParams({})}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              !selectedCategory ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            전체
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSearchParams({ category: cat.id })}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                selectedCategory === cat.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {posts.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="mb-4 text-gray-500">아직 게시글이 없습니다.</p>
          {canWrite && (
            <Link to={`/boards/${slug}/posts/new`}>
              <Button>첫 게시글 작성하기</Button>
            </Link>
          )}
        </Card>
      ) : (
        <Card>
          <div className="divide-y">
            {posts.map((post) => (
              <Link
                key={post.id}
                to={`/boards/${slug}/posts/${post.id}`}
                className="block p-4 transition-colors hover:bg-gray-50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="mb-1 flex items-center gap-2 flex-wrap">
                      {post.isPinned && <Pin className="h-4 w-4 shrink-0 text-blue-600" />}
                      {post.isNotice && <Badge variant="destructive" className="shrink-0">공지</Badge>}
                      {post.categoryName && (
                        <Badge variant="outline" className="shrink-0 text-xs">{post.categoryName}</Badge>
                      )}
                      <h3 className="font-medium hover:text-blue-600 truncate">{post.title}</h3>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span>{post.author}</span>
                      <span>{format(new Date(post.createdAt), 'yyyy.MM.dd')}</span>
                      <div className="flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" />
                        <span>{post.viewCount}</span>
                      </div>
                      {board?.useComment && (
                        <div className="flex items-center gap-1">
                          <MessageCircle className="h-3.5 w-3.5" />
                          <span>{post.commentCount}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
