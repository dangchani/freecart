import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Edit, ChevronDown, ChevronUp, Tag, Settings, Paintbrush } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface BoardCategory {
  id: string;
  name: string;
  sortOrder: number;
}

interface Skin {
  id: string;
  name: string;
  slug: string;
  type: string;
  thumbnail_url?: string;
}

interface Board {
  id: string;
  name: string;
  slug: string;
  description: string;
  type: string;
  listLevel: number;
  readLevel: number;
  writeLevel: number;
  commentLevel: number;
  useCategory: boolean;
  useComment: boolean;
  useSecret: boolean;
  useAttachment: boolean;
  sortOrder: number;
  isActive: boolean;
  postCount: number;
  categories: BoardCategory[];
  listSkinId?: string;
  viewSkinId?: string;
}

const LEVEL_OPTIONS = [
  { value: 0, label: '모든 사용자 (비로그인 포함)' },
  { value: 1, label: '로그인 회원' },
  { value: 2, label: '2등급 이상' },
  { value: 3, label: '3등급 이상' },
  { value: 9, label: '관리자만' },
];

const BOARD_TYPES = [
  { value: 'normal', label: '일반 게시판' },
  { value: 'notice', label: '공지사항' },
  { value: 'qna', label: 'Q&A' },
  { value: 'gallery', label: '갤러리' },
  { value: 'review', label: '리뷰' },
];

const defaultForm = {
  name: '',
  slug: '',
  description: '',
  type: 'normal',
  listLevel: 0,
  readLevel: 0,
  writeLevel: 1,
  commentLevel: 1,
  useCategory: false,
  useComment: true,
  useSecret: false,
  useAttachment: true,
  sortOrder: 0,
  isActive: true,
  listSkinId: '',
  viewSkinId: '',
};

export default function BoardsManagementPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBoard, setEditingBoard] = useState<Board | null>(null);
  const [formData, setFormData] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [expandedBoard, setExpandedBoard] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [listSkins, setListSkins] = useState<Skin[]>([]);
  const [viewSkins, setViewSkins] = useState<Skin[]>([]);

  useEffect(() => {
    loadBoards();
    loadSkins();
  }, []);

  async function loadSkins() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('skins')
        .select('id, name, slug, type, thumbnail_url')
        .eq('is_active', true)
        .in('type', ['board_list', 'board_view'])
        .order('name');

      if (error) throw error;

      const listType = (data || []).filter((s) => s.type === 'board_list');
      const viewType = (data || []).filter((s) => s.type === 'board_view');
      setListSkins(listType);
      setViewSkins(viewType);
    } catch (error) {
      console.error('Failed to load skins:', error);
    }
  }

  async function loadBoards() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('boards')
        .select(`
          id, name, slug, description, type,
          list_level, read_level, write_level, comment_level,
          use_category, use_comment, use_secret, use_attachment,
          sort_order, is_active,
          board_categories(id, name, sort_order),
          board_skin_settings(list_skin_id, view_skin_id)
        `)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      const boardList: Board[] = [];
      for (const board of data || []) {
        const { count } = await supabase
          .from('posts')
          .select('id', { count: 'exact', head: true })
          .eq('board_id', board.id);

        const skinSettings = board.board_skin_settings?.[0];

        boardList.push({
          id: board.id,
          name: board.name,
          slug: board.slug,
          description: board.description || '',
          type: board.type,
          listLevel: board.list_level,
          readLevel: board.read_level,
          writeLevel: board.write_level,
          commentLevel: board.comment_level,
          useCategory: board.use_category,
          useComment: board.use_comment,
          useSecret: board.use_secret,
          useAttachment: board.use_attachment,
          sortOrder: board.sort_order,
          isActive: board.is_active,
          postCount: count || 0,
          categories: (board.board_categories || []).map((c: any) => ({
            id: c.id,
            name: c.name,
            sortOrder: c.sort_order,
          })),
          listSkinId: skinSettings?.list_skin_id || undefined,
          viewSkinId: skinSettings?.view_skin_id || undefined,
        });
      }

      setBoards(boardList);
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
      type: board.type,
      listLevel: board.listLevel,
      readLevel: board.readLevel,
      writeLevel: board.writeLevel,
      commentLevel: board.commentLevel,
      useCategory: board.useCategory,
      useComment: board.useComment,
      useSecret: board.useSecret,
      useAttachment: board.useAttachment,
      sortOrder: board.sortOrder,
      isActive: board.isActive,
      listSkinId: board.listSkinId || '',
      viewSkinId: board.viewSkinId || '',
    });
    setShowForm(true);
    setExpandedBoard(null);
  }

  function handleCancel() {
    setEditingBoard(null);
    setFormData(defaultForm);
    setShowForm(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSubmitting(true);
      const supabase = createClient();

      const payload = {
        name: formData.name,
        description: formData.description,
        type: formData.type,
        list_level: formData.listLevel,
        read_level: formData.readLevel,
        write_level: formData.writeLevel,
        comment_level: formData.commentLevel,
        use_category: formData.useCategory,
        use_comment: formData.useComment,
        use_secret: formData.useSecret,
        use_attachment: formData.useAttachment,
        sort_order: formData.sortOrder,
        is_active: formData.isActive,
      };

      let boardId: string;

      if (editingBoard) {
        const { error } = await supabase.from('boards').update(payload).eq('id', editingBoard.id);
        if (error) throw error;
        boardId = editingBoard.id;
      } else {
        const { data, error } = await supabase.from('boards').insert({ ...payload, slug: formData.slug }).select('id').single();
        if (error) throw error;
        boardId = data.id;
      }

      // 스킨 설정 저장
      const skinPayload = {
        board_id: boardId,
        list_skin_id: formData.listSkinId || null,
        view_skin_id: formData.viewSkinId || null,
      };

      // 기존 스킨 설정이 있는지 확인
      const { data: existingSkin } = await supabase
        .from('board_skin_settings')
        .select('id')
        .eq('board_id', boardId)
        .single();

      if (existingSkin) {
        await supabase
          .from('board_skin_settings')
          .update({ list_skin_id: skinPayload.list_skin_id, view_skin_id: skinPayload.view_skin_id })
          .eq('board_id', boardId);
      } else if (skinPayload.list_skin_id || skinPayload.view_skin_id) {
        await supabase.from('board_skin_settings').insert(skinPayload);
      }

      handleCancel();
      await loadBoards();
    } catch (error) {
      console.error('Failed to save board:', error);
      alert(error instanceof Error ? error.message : '게시판 저장 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(boardId: string) {
    if (!confirm('게시판을 삭제하시겠습니까? 모든 게시글도 함께 삭제됩니다.')) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from('boards').delete().eq('id', boardId);
      if (error) throw error;
      await loadBoards();
    } catch (error) {
      alert(error instanceof Error ? error.message : '삭제 중 오류가 발생했습니다.');
    }
  }

  async function handleToggleActive(board: Board) {
    try {
      const supabase = createClient();
      await supabase.from('boards').update({ is_active: !board.isActive }).eq('id', board.id);
      await loadBoards();
    } catch (error) {
      alert('상태 변경 중 오류가 발생했습니다.');
    }
  }

  async function handleAddCategory(boardId: string) {
    if (!newCategoryName.trim()) return;
    try {
      setAddingCategory(true);
      const supabase = createClient();
      const { error } = await supabase.from('board_categories').insert({
        board_id: boardId,
        name: newCategoryName.trim(),
        sort_order: 0,
      });
      if (error) throw error;
      setNewCategoryName('');
      await loadBoards();
    } catch (error) {
      alert(error instanceof Error ? error.message : '카테고리 추가 중 오류가 발생했습니다.');
    } finally {
      setAddingCategory(false);
    }
  }

  async function handleDeleteCategory(categoryId: string) {
    if (!confirm('카테고리를 삭제하시겠습니까?')) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from('board_categories').delete().eq('id', categoryId);
      if (error) throw error;
      await loadBoards();
    } catch (error) {
      alert('카테고리 삭제 중 오류가 발생했습니다.');
    }
  }

  const levelLabel = (v: number) => LEVEL_OPTIONS.find((o) => o.value === v)?.label ?? v;

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-200 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">게시판 관리</h1>
          <p className="text-sm text-gray-500 mt-1">게시판 생성, 권한 설정, 카테고리를 관리합니다.</p>
        </div>
        <Button onClick={() => { setShowForm(!showForm); if (showForm) handleCancel(); }}>
          <Plus className="mr-2 h-4 w-4" />
          게시판 추가
        </Button>
      </div>

      {/* 게시판 생성/수정 폼 */}
      {showForm && (
        <Card className="mb-6 p-6">
          <h2 className="mb-5 text-lg font-bold">{editingBoard ? '게시판 수정' : '새 게시판'}</h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">게시판명 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="자유게시판"
                  required
                />
              </div>
              <div>
                <Label htmlFor="slug">URL 슬러그 *</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="free-board"
                  required
                  disabled={!!editingBoard}
                />
                {editingBoard && <p className="mt-1 text-xs text-gray-400">슬러그는 변경할 수 없습니다.</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="type">게시판 유형</Label>
                <select
                  id="type"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {BOARD_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="sortOrder">정렬 순서</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">설명</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="게시판 설명"
                rows={2}
              />
            </div>

            {/* 권한 설정 */}
            <div className="rounded-lg border bg-gray-50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">접근 권한 설정</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'listLevel', label: '목록 보기' },
                  { key: 'readLevel', label: '글 읽기' },
                  { key: 'writeLevel', label: '글 쓰기' },
                  { key: 'commentLevel', label: '댓글 쓰기' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <Label className="text-xs">{label}</Label>
                    <select
                      value={(formData as any)[key]}
                      onChange={(e) => setFormData({ ...formData, [key]: parseInt(e.target.value) })}
                      className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {LEVEL_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* 기능 설정 */}
            <div className="rounded-lg border bg-gray-50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">기능 설정</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'useComment', label: '댓글 허용' },
                  { key: 'useSecret', label: '비밀글 허용' },
                  { key: 'useAttachment', label: '첨부파일 허용' },
                  { key: 'useCategory', label: '카테고리 사용' },
                  { key: 'isActive', label: '게시판 활성화' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(formData as any)[key]}
                      onChange={(e) => setFormData({ ...formData, [key]: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 스킨 설정 */}
            <div className="rounded-lg border bg-gray-50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-700 flex items-center gap-1">
                <Paintbrush className="h-4 w-4" /> 스킨 설정
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">목록 스킨</Label>
                  <select
                    value={formData.listSkinId}
                    onChange={(e) => setFormData({ ...formData, listSkinId: e.target.value })}
                    className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">기본 스킨</option>
                    {listSkins.map((skin) => (
                      <option key={skin.id} value={skin.id}>{skin.name}</option>
                    ))}
                  </select>
                  {listSkins.length === 0 && (
                    <p className="mt-1 text-xs text-gray-400">등록된 목록 스킨이 없습니다.</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs">상세 스킨</Label>
                  <select
                    value={formData.viewSkinId}
                    onChange={(e) => setFormData({ ...formData, viewSkinId: e.target.value })}
                    className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">기본 스킨</option>
                    {viewSkins.map((skin) => (
                      <option key={skin.id} value={skin.id}>{skin.name}</option>
                    ))}
                  </select>
                  {viewSkins.length === 0 && (
                    <p className="mt-1 text-xs text-gray-400">등록된 상세 스킨이 없습니다.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? '저장 중...' : '저장'}
              </Button>
              <Button type="button" variant="outline" onClick={handleCancel}>
                취소
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* 게시판 목록 */}
      {boards.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500 mb-3">등록된 게시판이 없습니다.</p>
          <Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" />첫 게시판 만들기</Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {boards.map((board) => (
            <Card key={board.id} className={!board.isActive ? 'opacity-60' : ''}>
              <div className="flex items-center justify-between p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold">{board.name}</h3>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{board.slug}</span>
                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                      {BOARD_TYPES.find((t) => t.value === board.type)?.label}
                    </span>
                    {!board.isActive && (
                      <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded">비활성</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{board.description}</p>
                  <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-gray-400">
                    <span>게시글 {board.postCount}개</span>
                    <span>쓰기: {levelLabel(board.writeLevel)}</span>
                    <span>댓글: {levelLabel(board.commentLevel)}</span>
                    {board.useCategory && <span className="text-purple-600">카테고리 {board.categories.length}개</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <button
                    onClick={() => setExpandedBoard(expandedBoard === board.id ? null : board.id)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    {expandedBoard === board.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                  <Button size="sm" variant="outline" onClick={() => handleEdit(board)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(board.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>

              {/* 확장 패널 - 권한 상세 + 카테고리 */}
              {expandedBoard === board.id && (
                <div className="border-t bg-gray-50 p-4 space-y-4">
                  {/* 권한 요약 */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-600 mb-2">권한 설정</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { label: '목록', value: board.listLevel },
                        { label: '읽기', value: board.readLevel },
                        { label: '쓰기', value: board.writeLevel },
                        { label: '댓글', value: board.commentLevel },
                      ].map(({ label, value }) => (
                        <div key={label} className="rounded bg-white border px-3 py-2 text-xs">
                          <span className="text-gray-500">{label}: </span>
                          <span className="font-medium">{levelLabel(value)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[
                        { key: 'useComment', label: '댓글', value: board.useComment },
                        { key: 'useSecret', label: '비밀글', value: board.useSecret },
                        { key: 'useAttachment', label: '첨부', value: board.useAttachment },
                        { key: 'useCategory', label: '카테고리', value: board.useCategory },
                      ].map(({ label, value }) => (
                        <span
                          key={label}
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            value ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {value ? '✓' : '✗'} {label}
                        </span>
                      ))}
                      <button
                        onClick={() => handleToggleActive(board)}
                        className={`text-xs px-2 py-0.5 rounded-full cursor-pointer ${
                          board.isActive ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {board.isActive ? '● 활성' : '○ 비활성'} (클릭하여 전환)
                      </button>
                    </div>
                  </div>

                  {/* 스킨 정보 */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                      <Paintbrush className="h-3.5 w-3.5" /> 스킨 설정
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded bg-white border px-3 py-2 text-xs">
                        <span className="text-gray-500">목록 스킨: </span>
                        <span className="font-medium">
                          {board.listSkinId
                            ? listSkins.find((s) => s.id === board.listSkinId)?.name || '알 수 없음'
                            : '기본'}
                        </span>
                      </div>
                      <div className="rounded bg-white border px-3 py-2 text-xs">
                        <span className="text-gray-500">상세 스킨: </span>
                        <span className="font-medium">
                          {board.viewSkinId
                            ? viewSkins.find((s) => s.id === board.viewSkinId)?.name || '알 수 없음'
                            : '기본'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 카테고리 관리 */}
                  {board.useCategory && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                        <Tag className="h-3.5 w-3.5" /> 카테고리 관리
                      </h4>
                      <div className="space-y-1.5 mb-2">
                        {board.categories.length === 0 ? (
                          <p className="text-xs text-gray-400">등록된 카테고리가 없습니다.</p>
                        ) : (
                          board.categories.map((cat) => (
                            <div key={cat.id} className="flex items-center justify-between rounded bg-white border px-3 py-1.5">
                              <span className="text-sm">{cat.name}</span>
                              <button
                                onClick={() => handleDeleteCategory(cat.id)}
                                className="text-red-400 hover:text-red-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder="카테고리명"
                          className="h-8 text-sm"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(board.id); }
                          }}
                        />
                        <Button
                          size="sm"
                          onClick={() => handleAddCategory(board.id)}
                          disabled={addingCategory || !newCategoryName.trim()}
                        >
                          추가
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
