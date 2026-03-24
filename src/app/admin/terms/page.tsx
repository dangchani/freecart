import { useState, useEffect } from 'react';
import { FileText, Edit2, Plus, X, Save } from 'lucide-react';

interface Terms {
  id: string;
  title: string;
  content: string;
  type: string;
  isRequired?: boolean;
  updatedAt: string;
}

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
    fetch('/api/admin/terms')
      .then((r) => r.json())
      .then((data) => setTerms(data.terms || data || []))
      .catch(() => setTerms([]))
      .finally(() => setLoading(false));
  }, []);

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

  async function saveTerm() {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/terms/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle, content: editContent }),
      });
      const data = await res.json();
      if (data.success || res.ok) {
        setTerms((prev) =>
          prev.map((t) =>
            t.id === editingId
              ? { ...t, title: editTitle, content: editContent, updatedAt: new Date().toISOString() }
              : t
          )
        );
        cancelEdit();
        showToast('약관이 저장되었습니다.');
      } else showToast('저장에 실패했습니다.');
    } catch { showToast('오류가 발생했습니다.'); }
    finally { setSaving(false); }
  }

  async function createTerm() {
    if (!newTitle.trim() || !newType.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/admin/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, type: newType, content: newContent }),
      });
      const data = await res.json();
      if (data.success || data.id) {
        const created = data.term || { id: data.id, title: newTitle, type: newType, content: newContent, updatedAt: new Date().toISOString() };
        setTerms((prev) => [...prev, created]);
        setShowCreate(false);
        setNewTitle('');
        setNewType('');
        setNewContent('');
        showToast('약관이 생성되었습니다.');
      } else showToast('생성에 실패했습니다.');
    } catch { showToast('오류가 발생했습니다.'); }
    finally { setCreating(false); }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="h-7 w-7 text-green-600" />
            약관 관리
          </h1>
          <p className="text-gray-500 text-sm mt-1">이용약관, 개인정보처리방침 등을 관리합니다.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          새 약관 추가
        </button>
      </div>

      {/* 새 약관 작성 폼 */}
      {showCreate && (
        <div className="mb-6 border rounded-xl p-6 bg-green-50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">새 약관 작성</h3>
            <button onClick={() => setShowCreate(false)}>
              <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">약관 제목</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="예: 이용약관"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">약관 유형</label>
              <input
                type="text"
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                placeholder="예: terms_of_service"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">약관 내용</label>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={6}
              className="w-full border rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="약관 내용을 입력하세요..."
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowCreate(false)}
              className="border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              취소
            </button>
            <button
              onClick={createTerm}
              disabled={creating || !newTitle.trim() || !newType.trim()}
              className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {creating ? '저장 중...' : '저장'}
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
                    유형: {term.type} · 최종 수정:{' '}
                    {new Date(term.updatedAt).toLocaleDateString('ko-KR')}
                    {term.isRequired && (
                      <span className="ml-2 bg-red-100 text-red-600 text-xs px-1.5 py-0.5 rounded">필수</span>
                    )}
                  </p>
                </div>
                {editingId !== term.id && (
                  <button
                    onClick={() => startEdit(term)}
                    className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <Edit2 className="h-4 w-4" />
                    수정
                  </button>
                )}
              </div>

              {editingId === term.id ? (
                <div className="p-5">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={10}
                      className="w-full border rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={cancelEdit}
                      className="border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50"
                    >
                      취소
                    </button>
                    <button
                      onClick={saveTerm}
                      disabled={saving}
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {saving ? '저장 중...' : '저장'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-5">
                  <pre className="text-sm text-gray-600 whitespace-pre-wrap font-sans leading-relaxed max-h-40 overflow-y-auto">
                    {term.content}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
