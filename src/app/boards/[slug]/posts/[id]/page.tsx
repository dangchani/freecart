import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { ArrowLeft, Eye, Edit, Trash2, MessageCircle } from 'lucide-react';

interface Post {
  id: string;
  title: string;
  content: string;
  author: string;
  authorId: string;
  viewCount: number;
  createdAt: string;
}

interface Comment {
  id: string;
  content: string;
  author: string;
  authorId: string;
  createdAt: string;
}

export default function PostDetailPage() {
  const navigate = useNavigate();
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const { user } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadPost();
    loadComments();
  }, [id]);

  async function loadPost() {
    try {
      const response = await fetch(`/api/posts/${id}`);
      const data = await response.json();

      if (data.success) {
        setPost(data.data);
      } else {
        alert('게시글을 찾을 수 없습니다.');
        navigate(`/boards/${slug}`);
      }
    } catch (error) {
      console.error('Failed to load post:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadComments() {
    try {
      const response = await fetch(`/api/posts/${id}/comments`);
      const data = await response.json();

      if (data.success) {
        setComments(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load comments:', error);
    }
  }

  async function handleDeletePost() {
    if (!confirm('게시글을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch(`/api/posts/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || '게시글 삭제에 실패했습니다.');
      }

      alert('게시글이 삭제되었습니다.');
      navigate(`/boards/${slug}`);
    } catch (error) {
      console.error('Failed to delete post:', error);
      alert(error instanceof Error ? error.message : '게시글 삭제 중 오류가 발생했습니다.');
    }
  }

  async function handleSubmitComment() {
    if (!user) {
      alert('로그인이 필요합니다.');
      navigate('/auth/login');
      return;
    }

    if (!newComment.trim()) {
      alert('댓글 내용을 입력해주세요.');
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(`/api/posts/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || '댓글 작성에 실패했습니다.');
      }

      setNewComment('');
      await loadComments();
    } catch (error) {
      console.error('Failed to create comment:', error);
      alert(error instanceof Error ? error.message : '댓글 작성 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!confirm('댓글을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || '댓글 삭제에 실패했습니다.');
      }

      await loadComments();
    } catch (error) {
      console.error('Failed to delete comment:', error);
      alert(error instanceof Error ? error.message : '댓글 삭제 중 오류가 발생했습니다.');
    }
  }

  if (loading) {
    return <div className="container py-8">로딩 중...</div>;
  }

  if (!post) {
    return <div className="container py-8">게시글을 찾을 수 없습니다.</div>;
  }

  const isAuthor = user?.id === post.authorId;

  return (
    <div className="container py-8">
      <Link to={`/boards/${slug}`} className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="mr-1 h-4 w-4" />
        목록으로
      </Link>

      <Card className="mb-6 p-6">
        <div className="mb-4 flex items-start justify-between border-b pb-4">
          <div>
            <h1 className="mb-2 text-2xl font-bold">{post.title}</h1>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span>{post.author}</span>
              <span>{format(new Date(post.createdAt), 'yyyy.MM.dd HH:mm')}</span>
              <div className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                <span>{post.viewCount}</span>
              </div>
            </div>
          </div>
          {isAuthor && (
            <div className="flex gap-2">
              <Link to={`/boards/${slug}/posts/${post.id}/edit`}>
                <Button size="sm" variant="outline">
                  <Edit className="h-4 w-4" />
                </Button>
              </Link>
              <Button size="sm" variant="ghost" onClick={handleDeletePost}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          )}
        </div>

        <div className="whitespace-pre-wrap text-gray-700">{post.content}</div>
      </Card>

      {/* 댓글 */}
      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          <h2 className="text-lg font-bold">댓글 {comments.length}</h2>
        </div>

        {user && (
          <div className="mb-6 rounded-lg border p-4">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="댓글을 입력해주세요"
              rows={3}
              className="mb-2"
            />
            <div className="flex justify-end">
              <Button onClick={handleSubmitComment} disabled={submitting}>
                {submitting ? '작성 중...' : '댓글 작성'}
              </Button>
            </div>
          </div>
        )}

        {comments.length === 0 ? (
          <p className="py-8 text-center text-gray-500">아직 댓글이 없습니다.</p>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => {
              const isCommentAuthor = user?.id === comment.authorId;

              return (
                <div key={comment.id} className="border-t pt-4">
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{comment.author}</span>
                      <span className="text-gray-500">
                        {format(new Date(comment.createdAt), 'yyyy.MM.dd HH:mm')}
                      </span>
                    </div>
                    {isCommentAuthor && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteComment(comment.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-gray-700">{comment.content}</p>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
