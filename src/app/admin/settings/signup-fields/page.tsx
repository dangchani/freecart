// joy: 회원가입 필드 빌더 — signup_field_definitions CRUD + @dnd-kit 드래그 정렬 + 미리보기
import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { RequirePermission } from '@/components/permission-gate';
import { DynamicSignupForm } from '@/components/signup-fields/DynamicSignupForm';
import type { FieldDefinition, FieldType } from '@/components/signup-fields/types';
import { isCoreField } from '@/components/signup-fields/types';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Eye, EyeOff } from 'lucide-react';

const FIELD_TYPES: FieldType[] = [
  'text', 'textarea', 'email', 'url', 'phone', 'number',
  'select', 'radio', 'checkbox', 'date', 'time', 'datetime', 'address', 'file', 'terms',
];

interface EditDraft {
  id: string | null; // null이면 신규
  field_key: string;
  label: string;
  field_type: FieldType;
  is_required: boolean;
  is_active: boolean;
  placeholder: string;
  help_text: string;
  options: Array<{ label: string; value: string }>;
  is_system: boolean;
  terms_id: string | null;
}

function emptyDraft(): EditDraft {
  return {
    id: null,
    field_key: '',
    label: '',
    field_type: 'text',
    is_required: false,
    is_active: true,
    placeholder: '',
    help_text: '',
    options: [],
    is_system: false,
    terms_id: null,
  };
}

function SortableRow({
  field,
  selected,
  onSelect,
  onToggleActive,
  onDelete,
}: {
  field: FieldDefinition;
  selected: boolean;
  onSelect: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const core = isCoreField(field.field_key);
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-md border p-2 ${
        selected ? 'border-blue-400 bg-blue-50' : 'bg-white hover:bg-gray-50'
      } ${!field.is_active ? 'opacity-50' : ''}`}
    >
      <button type="button" className="cursor-grab text-gray-400" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4" />
      </button>
      <button type="button" onClick={onSelect} className="flex-1 text-left text-sm">
        <div className="font-medium">
          {field.label}
          {field.is_system && <Badge variant="secondary" className="ml-2 text-xs">시스템</Badge>}
          {field.is_required && <span className="ml-1 text-red-500">*</span>}
        </div>
        <div className="font-mono text-xs text-gray-500">{field.field_key} · {field.field_type}</div>
      </button>
      <button
        type="button"
        onClick={onToggleActive}
        disabled={core}
        className="p-1 text-gray-500 hover:text-gray-900 disabled:opacity-30"
        title={core ? '기본 필드는 항상 활성화 상태입니다' : field.is_active ? '비활성화' : '활성화'}
      >
        {field.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </button>
      {!field.is_system && (
        <button type="button" onClick={onDelete} className="p-1 text-red-500 hover:text-red-700">
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

interface TermsOption { id: string; title: string; }

function Inner() {
  const supabase = createClient();
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [termsList, setTermsList] = useState<TermsOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<EditDraft>(emptyDraft());
  const [error, setError] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const [fieldsRes, termsRes] = await Promise.all([
      supabase.from('signup_field_definitions').select('*, terms(id, title, content)').order('sort_order'),
      supabase.from('terms').select('id, title').order('title'),
    ]);
    if (fieldsRes.error) setError(fieldsRes.error.message);
    setFields((fieldsRes.data as FieldDefinition[]) ?? []);
    setTermsList((termsRes.data as TermsOption[]) ?? []);
    setLoading(false);
  }

  function selectField(f: FieldDefinition) {
    setDraft({
      id: f.id,
      field_key: f.field_key,
      label: f.label,
      field_type: f.field_type,
      is_required: f.is_required,
      is_active: f.is_active,
      placeholder: f.placeholder ?? '',
      help_text: f.help_text ?? '',
      options: f.options ?? [],
      is_system: f.is_system,
      terms_id: f.terms_id ?? null,
    });
  }

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = fields.findIndex((f) => f.id === active.id);
    const newIdx = fields.findIndex((f) => f.id === over.id);
    const next = arrayMove(fields, oldIdx, newIdx);
    setFields(next);
    // bulk update sort_order
    await Promise.all(
      next.map((f, i) =>
        supabase.from('signup_field_definitions').update({ sort_order: (i + 1) * 10 }).eq('id', f.id)
      )
    );
  }

  async function toggleActive(f: FieldDefinition) {
    if (isCoreField(f.field_key)) return;
    await supabase.from('signup_field_definitions').update({ is_active: !f.is_active }).eq('id', f.id);
    await load();
  }

  async function deleteField(f: FieldDefinition) {
    if (f.is_system) return alert('시스템 기본 필드는 삭제할 수 없습니다.');
    if (!confirm(`"${f.label}" 필드를 삭제하시겠습니까? 이미 저장된 값은 함께 삭제됩니다.`)) return;
    const { error: e } = await supabase.from('signup_field_definitions').delete().eq('id', f.id);
    if (e) return setError(e.message);
    if (draft.id === f.id) setDraft(emptyDraft());
    await load();
  }

  async function saveDraft() {
    setError('');
    if (!draft.label.trim()) return setError('라벨을 입력하세요');
    if (!draft.id && !draft.field_key.trim()) return setError('필드 키를 입력하세요');
    if (draft.field_type === 'terms' && !draft.terms_id) return setError('약관을 선택하세요');

    if (draft.id) {
      // 수정 - 시스템 필드는 label/required/active/placeholder/help만, 그 외 모두 가능
      const update: Record<string, unknown> = {
        label: draft.label,
        placeholder: draft.placeholder || null,
        help_text: draft.help_text || null,
        is_active: isCoreField(draft.field_key) ? true : draft.is_active,
        is_required: isCoreField(draft.field_key) ? true : draft.is_required,
      };
      if (!draft.is_system) {
        update.options = draft.options.length > 0 ? draft.options : null;
        if (draft.field_type === 'terms') update.terms_id = draft.terms_id;
      }
      const { error: e } = await supabase.from('signup_field_definitions').update(update).eq('id', draft.id);
      if (e) return setError(e.message);
      alert('수정되었습니다.');
      setDraft(emptyDraft());
    } else {
      // 신규
      const nextOrder = (fields[fields.length - 1]?.sort_order ?? 0) + 10;
      const { error: e } = await supabase.from('signup_field_definitions').insert({
        field_key: draft.field_key.trim(),
        label: draft.label,
        field_type: draft.field_type,
        is_required: draft.is_required,
        is_active: draft.is_active,
        sort_order: nextOrder,
        placeholder: draft.placeholder || null,
        help_text: draft.help_text || null,
        options: draft.options.length > 0 ? draft.options : null,
        terms_id: draft.field_type === 'terms' ? draft.terms_id : null,
        storage_target: 'custom',
      });
      if (e) return setError(e.message);
      alert('추가되었습니다.');
      setDraft(emptyDraft());
    }
    await load();
  }

  const previewDefs = useMemo(() => fields.filter((f) => f.is_active), [fields]);

  if (loading) return <div className="p-8">로딩 중...</div>;

  const coreDraft = isCoreField(draft.field_key);
  const needsOptions = ['select', 'radio', 'checkbox'].includes(draft.field_type);
  const isTermsType = draft.field_type === 'terms';

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">회원가입 필드</h1>
        <p className="mt-1 text-sm text-gray-500">회원가입 폼의 입력 항목을 자유롭게 추가·정렬하세요.</p>
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 필드 목록 */}
        <Card className="p-4 lg:col-span-1">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">필드 목록</h2>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1">
                {fields.map((f) => (
                  <SortableRow
                    key={f.id}
                    field={f}
                    selected={draft.id === f.id}
                    onSelect={() => selectField(f)}
                    onToggleActive={() => toggleActive(f)}
                    onDelete={() => deleteField(f)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </Card>

        {/* 편집 폼 */}
        <Card className="p-4 lg:col-span-1">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">{draft.id ? '필드 편집' : '새 필드 추가'}</h2>
            {draft.id && (
              <Button size="sm" variant="outline" onClick={() => setDraft(emptyDraft())}>
                + 새 필드 추가
              </Button>
            )}
          </div>
          <div className="space-y-3">
            <div>
              <Label>라벨</Label>
              <Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
            </div>
            <div>
              <Label>필드 키 {draft.id && <span className="text-xs text-gray-500">(변경 불가)</span>}</Label>
              <Input
                value={draft.field_key}
                onChange={(e) => setDraft({ ...draft, field_key: e.target.value })}
                disabled={!!draft.id}
                placeholder="예: company_name"
              />
            </div>
            <div>
              <Label>타입 {draft.id && <span className="text-xs text-gray-500">(변경 불가)</span>}</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={draft.field_type}
                onChange={(e) => setDraft({ ...draft, field_type: e.target.value as FieldType })}
                disabled={!!draft.id}
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Placeholder</Label>
              <Input value={draft.placeholder} onChange={(e) => setDraft({ ...draft, placeholder: e.target.value })} />
            </div>
            <div>
              <Label>도움말</Label>
              <Input value={draft.help_text} onChange={(e) => setDraft({ ...draft, help_text: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.is_required}
                onChange={(e) => setDraft({ ...draft, is_required: e.target.checked })}
                disabled={coreDraft}
              />
              필수 입력
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.is_active}
                onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                disabled={coreDraft}
              />
              활성화
            </label>

            {isTermsType && (
              <div>
                <Label>약관 선택 <span className="text-red-500">*</span></Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={draft.terms_id ?? ''}
                  onChange={(e) => setDraft({ ...draft, terms_id: e.target.value || null })}
                >
                  <option value="">약관을 선택하세요</option>
                  {termsList.map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
                {termsList.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500">설정 → 약관관리에서 약관을 먼저 등록하세요.</p>
                )}
              </div>
            )}

            {needsOptions && !draft.is_system && (
              <div>
                <Label>선택지</Label>
                <div className="space-y-1">
                  {draft.options.map((o, i) => (
                    <div key={i} className="flex gap-1">
                      <Input
                        placeholder="label"
                        value={o.label}
                        onChange={(e) => {
                          const next = [...draft.options];
                          next[i] = { ...next[i], label: e.target.value };
                          setDraft({ ...draft, options: next });
                        }}
                      />
                      <Input
                        placeholder="value"
                        value={o.value}
                        onChange={(e) => {
                          const next = [...draft.options];
                          next[i] = { ...next[i], value: e.target.value };
                          setDraft({ ...draft, options: next });
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setDraft({ ...draft, options: draft.options.filter((_, j) => j !== i) })}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setDraft({ ...draft, options: [...draft.options, { label: '', value: '' }] })}
                  >
                    + 옵션 추가
                  </Button>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={saveDraft} className="flex-1">
                {draft.id ? '수정 저장' : '필드 추가'}
              </Button>
              {draft.id && (
                <Button type="button" variant="outline" onClick={() => setDraft(emptyDraft())}>
                  취소
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* 미리보기 */}
        <Card className="p-4 lg:col-span-1">
          <h2 className="mb-3 text-lg font-bold">미리보기</h2>
          <div className="rounded-md border p-3">
            <DynamicSignupForm previewOnly previewDefinitions={previewDefs} />
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function SignupFieldsPage() {
  return (
    <RequirePermission permission="signup_fields.manage">
      <Inner />
    </RequirePermission>
  );
}
