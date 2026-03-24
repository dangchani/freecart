import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { ArrowLeft, Pin, MessageCircle, Eye, Edit } from 'lucide-react';

interface Post {
  id: string;
  title: string;
  author: string;
  isPinned: boolean;
  isNotice: boolean;
  viewCount: number;
  commentCount: number;
  createdAt: string;
}

interface Board {
  name: string;
  description: string;
}

export default function BoardDetailPage() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [board, setBoard] = useState<Board | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBoard();
    loadPosts();
  }, [slug]);

  async function loadBoard() {
    try {
      const response = await fetch(`/api/boards/${slug}`);
      const data = await response.json();

      if (data.success) {
        setBoard(data.data);
      } else {
        alert('게시판을 찾을 수 없습니다.');
        navigate('/boards');
      }
    } catch (error) {
      console.error('Failed to load board:', error);
    }
  }

  async function loadPosts() {
    try {
      const response = await fetch(`/api/boards/${slug}/posts`);
      const data = await response.json();

      if (data.success) {
        setPosts(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load posts:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="container py-8">로딩 중...</div>;
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
        {user && (
          <Link to={`/boards/${slug}/posts/new`}>
            <Button>
              <Edit className="mr-2 h-4 w-4" />
              글쓰기
            </Button>
          </Link>
        )}
      </div>

      {posts.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="mb-4 text-gray-500">아직 게시글이 없습니다.</p>
          {user && (
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
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      {post.isPinned && <Pin className="h-4 w-4 text-blue-600" />}
                      {post.isNotice && <Badge variant="destructive">공지</Badge>}
                      <h3 className="font-medium hover:text-blue-600">{post.title}</h3>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span>{post.author}</span>
                      <span>{format(new Date(post.createdAt), 'yyyy.MM.dd')}</span>
                      <div className="flex items-center gap-1">
                        <Eye className="h-4 w-4" />
                        <span>{post.viewCount}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageCircle className="h-4 w-4" />
                        <span>{post.commentCount}</span>
                      </div>
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
