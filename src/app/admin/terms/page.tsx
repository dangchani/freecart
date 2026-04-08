import { useState, useEffect } from 'react';
import { FileText, Edit2, Plus, X, Save, Trash2, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Terms {
  id: string;
  title: string;
  content: string;
  type: string;
  isRequired?: boolean;
  isActive: boolean;
  updatedAt: string;
}

const TERM_TYPES = [
  { value: 'privacy_policy', label: '개인정보처리방침' },
  { value: 'terms_of_service', label: '이용약관' },
  { value: 'marketing', label: '마케팅 정보 수신 동의' },
  { value: 'location', label: '위치정보 이용 동의' },
  { value: 'age', label: '만 14세 이상 확인' },
  { value: 'refund', label: '환불 정책' },
];

export default function AdminTermsPage() {
  const [terms, setTerms] = useState<Terms[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('');
  const [newContent, setNewContent] = useState('');
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState('');

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  useEffect(() => {
    loadTerms();
  }, []);

  async function loadTerms() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('terms')
        .select('id, title, content, type, is_required, is_active, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTerms(
        (data || []).map((t) => ({
          id: t.id,
          title: t.title,
          content: t.content,
          type: t.type,
          isRequired: t.is_required,
          isActive: t.is_active ?? true,
          updatedAt: t.created_at,
        }))
      );
    } catch {
      setTerms([]);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(term: Terms) {
    setEditingId(term.id);
    setEditTitle(term.title);
    setEditContent(term.content);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditContent('');
    setEditTitle('');
  }

  async function toggleActive(term: Terms) {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('terms')
        .update({ is_active: !term.isActive })
        .eq('id', term.id);
      if (error) throw error;
      setTerms((prev) => prev.map((t) => t.id === term.id ? { ...t, isActive: !term.isActive } : t));
      showToast(term.isActive ? '비활성화되었습니다.' : '활성화되었습니다.');
    } catch {
      showToast('상태 변경에 실패했습니다.');
    }
  }

  async function saveTerm() {
    if (!editingId) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('terms')
        .update({ title: editTitle, content: editContent })
        .eq('id', editingId);

      if (error) throw error;
      setTerms((prev) =>
        prev.map((t) =>
          t.id === editingId
            ? { ...t, title: editTitle, content: editContent, updatedAt: new Date().toISOString() }
            : t
        )
      );
      cancelEdit();
      showToast('약관이 저장되었습니다.');
    } catch {
      showToast('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteTerm(id: string) {
    if (!confirm('이 약관을 삭제하시겠습니까?')) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from('terms').delete().eq('id', id);
      if (error) throw error;
      setTerms((prev) => prev.filter((t) => t.id !== id));
      showToast('약관이 삭제되었습니다.');
    } catch {
      showToast('삭제에 실패했습니다.');
    }
  }

  async function createTerm() {
    if (!newTitle.trim() || !newType.trim()) return;
    setCreating(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('terms')
        .insert({
          title: newTitle,
          type: newType,
          content: newContent,
          version: '1.0',
          is_required: true,
          is_active: true,
        })
        .select('id')
        .single();

      if (error) throw error;
      const created: Terms = {
        id: data.id,
        title: newTitle,
        type: newType,
        content: newContent,
        isActive: true,
        updatedAt: new Date().toISOString(),
      };
      setTerms((prev) => [created, ...prev]);
      setShowCreate(false);
      setNewTitle('');
      setNewType('');
      setNewContent('');
      showToast('약관이 생성되었습니다.');
    } catch {
      showToast('생성에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm">{toast}</div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="h-7 w-7 text-green-600" />
            약관 관리
          </h1>
          <p className="text-gray-500 text-sm mt-1">이용약관, 개인정보처리방침 등을 관리합니다.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus className="h-4 w-4" />새 약관 추가
        </button>
      </div>

      {showCreate && (
        <div className="mb-6 border rounded-xl p-6 bg-green-50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">새 약관 작성</h3>
            <button onClick={() => setShowCreate(false)}><X className="h-5 w-5 text-gray-400 hover:text-gray-600" /></button>
          </div>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">약관 제목</label>
              <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="예: 이용약관" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">약관 유형</label>
              <select value={newType} onChange={(e) => setNewType(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                <option value="">유형 선택...</option>
                {TERM_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">약관 내용</label>
            <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} rows={6} className="w-full border rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="약관 내용을 입력하세요..." />
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowCreate(false)} className="border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50">취소</button>
            <button onClick={createTerm} disabled={creating || !newTitle.trim() || !newType.trim()} className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 flex items-center gap-2">
              <Save className="h-4 w-4" />{creating ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
        </div>
      ) : terms.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>등록된 약관이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {terms.map((term) => (
            <div key={term.id} className="border rounded-xl bg-white overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50">
                <div>
                  <h3 className="font-semibold text-gray-900">{term.title}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    유형: {TERM_TYPES.find((t) => t.value === term.type)?.label || term.type} · 최종 수정: {new Date(term.updatedAt).toLocaleDateString('ko-KR')}
                    {term.isRequired && <span className="ml-2 bg-red-100 text-red-600 text-xs px-1.5 py-0.5 rounded">필수</span>}
                    {!term.isActive && <span className="ml-2 bg-gray-100 text-gray-500 text-xs px-1.5 py-0.5 rounded">비공개</span>}
                  </p>
                </div>
                {editingId !== term.id && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleActive(term)} className={`flex items-center gap-1.5 text-sm font-medium ${term.isActive ? 'text-green-600 hover:text-green-700' : 'text-gray-400 hover:text-gray-600'}`} title={term.isActive ? '비활성화' : '활성화'}>
                      {term.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      {term.isActive ? '공개' : '비공개'}
                    </button>
                    <button onClick={() => startEdit(term)} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
                      <Edit2 className="h-4 w-4" />수정
                    </button>
                    <button onClick={() => deleteTerm(term.id)} className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 font-medium">
                      <Trash2 className="h-4 w-4" />삭제
                    </button>
                  </div>
                )}
              </div>

              {editingId === term.id ? (
                <div className="p-5">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                    <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
                    <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={10} className="w-full border rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="flex gap-3 justify-end">
                    <button onClick={cancelEdit} className="border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50">취소</button>
                    <button onClick={saveTerm} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 flex items-center gap-2">
                      <Save className="h-4 w-4" />{saving ? '저장 중...' : '저장'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-5">
                  <pre className="text-sm text-gray-600 whitespace-pre-wrap font-sans leading-relaxed max-h-40 overflow-y-auto">{term.content}</pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
