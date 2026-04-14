import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Edit2, Trash2, Eye, EyeOff, X, GripVertical } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  isVisible: boolean;
  sortOrder: number;
}

const categoryOptions = [
  { value: 'order', label: '주문' },
  { value: 'shipping', label: '배송' },
  { value: 'payment', label: '결제' },
  { value: 'refund', label: '환불/교환' },
  { value: 'account', label: '계정' },
  { value: 'product', label: '상품' },
  { value: 'other', label: '기타' },
];

const categoryLabels: Record<string, string> = Object.fromEntries(
  categoryOptions.map((c) => [c.value, c.label])
);

// ── SortableRow ──────────────────────────────────────────────────────────────

function SortableRow({
  faq,
  isGhost,
  onEdit,
  onToggle,
  onDelete,
}: {
  faq: FAQ;
  isGhost?: boolean;
  onEdit: (faq: FAQ) => void;
  onToggle: (faq: FAQ) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isSorting } =
    useSortable({ id: faq.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition: isSorting ? transition : undefined }}
      className={isGhost ? 'opacity-40' : ''}
    >
      <div className="flex items-start gap-3 p-4 hover:bg-gray-50 transition-colors">
        {/* 드래그 핸들 */}
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab touch-none text-gray-300 hover:text-gray-500 active:cursor-grabbing shrink-0"
        >
          <GripVertical className="h-5 w-5" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="mb-1 flex items-center gap-2 flex-wrap">
            <h3 className="font-medium truncate">{faq.question}</h3>
            <Badge variant="outline" className="shrink-0">{categoryLabels[faq.category] || faq.category}</Badge>
            {!faq.isVisible && <Badge variant="secondary" className="shrink-0">비공개</Badge>}
          </div>
          <p className="line-clamp-2 text-sm text-gray-500">{faq.answer}</p>
        </div>

        <div className="flex gap-1 shrink-0">
          <Button size="sm" variant="ghost" onClick={() => onToggle(faq)} title={faq.isVisible ? '숨기기' : '공개'}>
            {faq.isVisible
              ? <Eye className="h-4 w-4 text-green-600" />
              : <EyeOff className="h-4 w-4 text-gray-400" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onEdit(faq)}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDelete(faq.id)}>
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── 메인 페이지 ──────────────────────────────────────────────────────────────

export default function AdminFAQsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // 모달
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [formData, setFormData] = useState({
    question: '',
    answer: '',
    category: 'other',
    isVisible: true,
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (!authLoading) {
      if (!user) { navigate('/auth/login'); return; }
      loadFAQs();
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!authLoading && user) loadFAQs();
  }, [categoryFilter]);

  async function loadFAQs() {
    try {
      const supabase = createClient();
      let query = supabase
        .from('faqs')
        .select('id, question, answer, category, is_visible, sort_order')
        .order('sort_order', { ascending: true });

      if (categoryFilter && categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      setFaqs(
        (data || []).map((f: any) => ({
          id: f.id,
          question: f.question,
          answer: f.answer,
          category: f.category,
          isVisible: f.is_visible,
          sortOrder: f.sort_order,
        }))
      );
    } catch (err) {
      console.error('Failed to load FAQs:', err);
    } finally {
      setLoading(false);
    }
  }

  // ── 드래그 ────────────────────────────────────────────────────────────────

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over || active.id === over.id) return;

    setFaqs((prev) => {
      const oldIdx = prev.findIndex((f) => f.id === active.id);
      const newIdx = prev.findIndex((f) => f.id === over.id);
      const reordered = arrayMove(prev, oldIdx, newIdx);
      saveSortOrders(reordered);
      return reordered;
    });
  }

  async function saveSortOrders(ordered: FAQ[]) {
    setSaving(true);
    try {
      const supabase = createClient();
      for (const [idx, faq] of ordered.entries()) {
        await supabase.from('faqs').update({ sort_order: idx }).eq('id', faq.id);
      }
    } catch (err) {
      console.error('Failed to update sort order:', err);
      alert('순서 변경 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  // ── 모달 ─────────────────────────────────────────────────────────────────

  function openCreateModal() {
    setEditingFaq(null);
    setFormData({ question: '', answer: '', category: 'other', isVisible: true });
    setModalOpen(true);
  }

  function openEditModal(faq: FAQ) {
    setEditingFaq(faq);
    setFormData({ question: faq.question, answer: faq.answer, category: faq.category, isVisible: faq.isVisible });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!formData.question.trim() || !formData.answer.trim()) {
      alert('질문과 답변을 모두 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      if (editingFaq) {
        const { error } = await supabase
          .from('faqs')
          .update({ question: formData.question, answer: formData.answer, category: formData.category, is_visible: formData.isVisible })
          .eq('id', editingFaq.id);
        if (error) throw error;
      } else {
        const maxOrder = faqs.length > 0 ? Math.max(...faqs.map((f) => f.sortOrder)) : 0;
        const { error } = await supabase.from('faqs').insert({
          question: formData.question,
          answer: formData.answer,
          category: formData.category,
          is_visible: formData.isVisible,
          sort_order: maxOrder + 1,
        });
        if (error) throw error;
      }
      setModalOpen(false);
      await loadFAQs();
    } catch (err) {
      console.error('Failed to save FAQ:', err);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleVisibility(faq: FAQ) {
    const supabase = createClient();
    await supabase.from('faqs').update({ is_visible: !faq.isVisible }).eq('id', faq.id);
    await loadFAQs();
  }

  async function handleDelete(faqId: string) {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    const supabase = createClient();
    await supabase.from('faqs').delete().eq('id', faqId);
    await loadFAQs();
  }

  if (authLoading || loading) return <div className="container py-8">로딩 중...</div>;

  const draggingFaq = activeId ? faqs.find((f) => f.id === activeId) : null;

  return (
    <div className="container py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">FAQ 관리</h1>
          {saving && <p className="text-xs text-gray-400 mt-1 animate-pulse">저장 중...</p>}
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="mr-1.5 h-4 w-4" />
          FAQ 추가
        </Button>
      </div>

      {/* 카테고리 필터 */}
      <div className="mb-6">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="전체 카테고리" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 카테고리</SelectItem>
            {categoryOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {faqs.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500">등록된 FAQ가 없습니다.</p>
        </Card>
      ) : (
        <Card>
          <div className="text-xs text-gray-400 px-4 pt-3 pb-1">
            드래그하여 순서를 변경할 수 있습니다.
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <SortableContext items={faqs.map((f) => f.id)} strategy={verticalListSortingStrategy}>
              <div className="divide-y">
                {faqs.map((faq) => (
                  <SortableRow
                    key={faq.id}
                    faq={faq}
                    isGhost={activeId === faq.id}
                    onEdit={openEditModal}
                    onToggle={handleToggleVisibility}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </SortableContext>

            <DragOverlay dropAnimation={null}>
              {draggingFaq && (
                <div className="flex items-start gap-3 p-4 bg-white border-2 border-blue-400 rounded-lg shadow-xl">
                  <GripVertical className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{draggingFaq.question}</p>
                    <p className="text-sm text-gray-400 truncate">{draggingFaq.answer}</p>
                  </div>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </Card>
      )}

      {/* FAQ 등록/수정 모달 */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-lg p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">{editingFaq ? 'FAQ 수정' : 'FAQ 추가'}</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="category">카테고리</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
                >
                  <SelectTrigger id="category" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="question">질문</Label>
                <Input
                  id="question"
                  value={formData.question}
                  onChange={(e) => setFormData((prev) => ({ ...prev, question: e.target.value }))}
                  placeholder="자주 묻는 질문을 입력하세요"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="answer">답변</Label>
                <Textarea
                  id="answer"
                  value={formData.answer}
                  onChange={(e) => setFormData((prev) => ({ ...prev, answer: e.target.value }))}
                  placeholder="답변을 입력하세요"
                  rows={5}
                  className="mt-1"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isVisible"
                  checked={formData.isVisible}
                  onChange={(e) => setFormData((prev) => ({ ...prev, isVisible: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="isVisible" className="font-normal">공개</Label>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setModalOpen(false)}>취소</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '저장'}</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
