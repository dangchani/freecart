import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown, ChevronRight, CheckCircle, Circle,
  Loader2, Eye, EyeOff, Plus, Trash2, X, GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import {
  getIntegrationProviders,
  getIntegrationInstances,
  saveIntegrationCredentials,
  disableIntegration,
  addIntegrationProvider,
  deleteIntegrationProvider,
  type IntegrationProvider,
  type IntegrationInstance,
  type IntegrationField,
} from '@/services/integrations';

// 기본 제공 서비스 (삭제 불가)
const BUILT_IN_KEYS = new Set(['goodsflow', 'ecount', 'ppurio', 'popbill']);

// 카테고리 표시 순서 (기타는 맨 뒤)
const CATEGORY_ORDER = ['물류/배송', 'ERP', '문자/알림'];

type TestStatus = 'idle' | 'testing' | 'success' | 'fail';

interface FieldState {
  value: string;
  show: boolean;
}

// 새 서비스 추가 폼 타입
interface NewProviderForm {
  key: string;
  name: string;
  category: string;
  customCategory: string; // category === '__custom__' 일 때 사용
  description: string;
  fields: { label: string; key: string; type: 'text' | 'password'; required: boolean }[];
  hasTest: boolean;
}

const EMPTY_FORM: NewProviderForm = {
  key: '', name: '', category: '', customCategory: '',
  description: '', fields: [], hasTest: false,
};

export default function AdminExternalConnectionsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  const [instances, setInstances] = useState<Map<string, IntegrationInstance>>(new Map());
  const [loading, setLoading] = useState(true);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, Record<string, FieldState>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [disabling, setDisabling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<Record<string, TestStatus>>({});
  const [testMessage, setTestMessage] = useState<Record<string, string>>({});

  // 새 서비스 추가 모달
  const [showAddModal, setShowAddModal] = useState(false);
  const [newForm, setNewForm] = useState<NewProviderForm>(EMPTY_FORM);
  const [addError, setAddError] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!user) { navigate('/auth/login'); return; }
      load();
    }
  }, [user, authLoading, navigate]);

  async function load() {
    try {
      const [provs, insts] = await Promise.all([
        getIntegrationProviders(),
        getIntegrationInstances(),
      ]);
      setProviders(provs);
      const map = new Map<string, IntegrationInstance>();
      insts.forEach((i) => map.set(i.platform, i));
      setInstances(map);
    } finally {
      setLoading(false);
    }
  }

  // 카드 펼치기
  function toggleExpand(providerKey: string, fields: IntegrationField[]) {
    if (expanded === providerKey) { setExpanded(null); return; }
    setExpanded(providerKey);
    const savedCreds = instances.get(providerKey)?.credentials ?? {};
    const initial: Record<string, FieldState> = {};
    fields.forEach((f) => { initial[f.key] = { value: savedCreds[f.key] ?? '', show: false }; });
    setFormValues((prev) => ({ ...prev, [providerKey]: initial }));
    setTestStatus((prev) => ({ ...prev, [providerKey]: 'idle' }));
    setTestMessage((prev) => ({ ...prev, [providerKey]: '' }));
  }

  function setField(providerKey: string, fieldKey: string, value: string) {
    setFormValues((prev) => ({
      ...prev,
      [providerKey]: { ...prev[providerKey], [fieldKey]: { ...prev[providerKey]?.[fieldKey], value } },
    }));
  }

  function toggleShow(providerKey: string, fieldKey: string) {
    setFormValues((prev) => ({
      ...prev,
      [providerKey]: {
        ...prev[providerKey],
        [fieldKey]: { ...prev[providerKey]?.[fieldKey], show: !prev[providerKey]?.[fieldKey]?.show },
      },
    }));
  }

  async function handleTest(provider: IntegrationProvider) {
    const fields = formValues[provider.key] ?? {};
    const credentials: Record<string, string> = {};
    provider.fields.forEach((f) => { credentials[f.key] = fields[f.key]?.value ?? ''; });

    setTestStatus((prev) => ({ ...prev, [provider.key]: 'testing' }));
    setTestMessage((prev) => ({ ...prev, [provider.key]: '' }));
    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke('test-integration', {
        body: { provider_key: provider.key, credentials },
      });
      if (error) throw new Error(error.message);
      setTestStatus((prev) => ({ ...prev, [provider.key]: data.ok ? 'success' : 'fail' }));
      setTestMessage((prev) => ({ ...prev, [provider.key]: data.message }));
    } catch (e) {
      setTestStatus((prev) => ({ ...prev, [provider.key]: 'fail' }));
      setTestMessage((prev) => ({ ...prev, [provider.key]: String(e) }));
    }
  }

  async function handleSave(provider: IntegrationProvider) {
    const fields = formValues[provider.key] ?? {};
    const credentials: Record<string, string> = {};
    provider.fields.forEach((f) => { credentials[f.key] = fields[f.key]?.value ?? ''; });

    const missing = provider.fields.filter((f) => f.required && !credentials[f.key]?.trim());
    if (missing.length > 0) {
      alert(`필수 항목을 입력해주세요: ${missing.map((f) => f.label).join(', ')}`);
      return;
    }
    setSaving(provider.key);
    try {
      await saveIntegrationCredentials(provider.key, credentials);
      await load();
      setExpanded(null);
    } catch (e) {
      alert(`저장 실패: ${String(e)}`);
    } finally {
      setSaving(null);
    }
  }

  async function handleDisable(providerKey: string) {
    if (!confirm('연동을 해제하시겠습니까? 저장된 인증 정보가 삭제됩니다.')) return;
    setDisabling(providerKey);
    try {
      await disableIntegration(providerKey);
      await load();
      setExpanded(null);
    } catch (e) {
      alert(`해제 실패: ${String(e)}`);
    } finally {
      setDisabling(null);
    }
  }

  async function handleDeleteProvider(providerKey: string, name: string) {
    if (!confirm(`'${name}' 서비스를 목록에서 삭제하시겠습니까?\n저장된 인증 정보도 함께 삭제됩니다.`)) return;
    setDeleting(providerKey);
    try {
      await disableIntegration(providerKey); // credentials 정리
      await deleteIntegrationProvider(providerKey);
      await load();
      if (expanded === providerKey) setExpanded(null);
    } catch (e) {
      alert(`삭제 실패: ${String(e)}`);
    } finally {
      setDeleting(null);
    }
  }

  // -------------------------------------------------------------------------
  // 새 서비스 추가 모달 핸들러
  // -------------------------------------------------------------------------

  function openAddModal() {
    setNewForm(EMPTY_FORM);
    setAddError('');
    setShowAddModal(true);
  }

  function addField() {
    setNewForm((prev) => ({
      ...prev,
      fields: [...prev.fields, { label: '', key: '', type: 'text', required: true }],
    }));
  }

  function removeField(idx: number) {
    setNewForm((prev) => ({ ...prev, fields: prev.fields.filter((_, i) => i !== idx) }));
  }

  function updateField(idx: number, patch: Partial<NewProviderForm['fields'][0]>) {
    setNewForm((prev) => ({
      ...prev,
      fields: prev.fields.map((f, i) => i === idx ? { ...f, ...patch } : f),
    }));
  }

  // 서비스 이름 → key 자동 생성 (영소문자+숫자+언더스코어)
  function nameToKey(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  }

  // 필드 라벨 → key 자동 생성
  function labelToKey(label: string) {
    return label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  }

  async function handleAddProvider() {
    setAddError('');
    const category = newForm.category === '__custom__' ? newForm.customCategory.trim() : newForm.category;

    if (!newForm.key.trim())   { setAddError('서비스 키를 입력해주세요.'); return; }
    if (!newForm.name.trim())  { setAddError('서비스 이름을 입력해주세요.'); return; }
    if (!category)             { setAddError('카테고리를 선택하거나 입력해주세요.'); return; }
    if (newForm.fields.length === 0) { setAddError('인증 필드를 1개 이상 추가해주세요.'); return; }

    const emptyField = newForm.fields.find((f) => !f.label.trim() || !f.key.trim());
    if (emptyField) { setAddError('모든 필드의 이름과 키를 입력해주세요.'); return; }

    if (providers.some((p) => p.key === newForm.key.trim())) {
      setAddError('이미 존재하는 서비스 키입니다.');
      return;
    }

    setAddSaving(true);
    try {
      await addIntegrationProvider({
        key:         newForm.key.trim(),
        name:        newForm.name.trim(),
        category,
        description: newForm.description.trim() || null,
        fields:      newForm.fields.map((f) => ({
          key:         f.key.trim(),
          label:       f.label.trim(),
          type:        f.type,
          required:    f.required,
        })),
        hasTest: newForm.hasTest,
      });
      await load();
      setShowAddModal(false);
    } catch (e) {
      setAddError(`추가 실패: ${String(e)}`);
    } finally {
      setAddSaving(false);
    }
  }

  // -------------------------------------------------------------------------
  // 렌더링
  // -------------------------------------------------------------------------

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // 카테고리별 그룹핑 (정의된 순서 + 추가 카테고리는 뒤에)
  const allCategories = [
    ...CATEGORY_ORDER,
    ...Array.from(new Set(providers.map((p) => p.category))).filter((c) => !CATEGORY_ORDER.includes(c)),
  ];
  const grouped = allCategories
    .map((cat) => ({ category: cat, providers: providers.filter((p) => p.category === cat) }))
    .filter((g) => g.providers.length > 0);

  // 새 서비스 추가 모달의 카테고리 목록 (기존 카테고리 + 직접입력)
  const existingCategories = Array.from(new Set(providers.map((p) => p.category)));

  return (
    <div className="container py-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">외부 연동 관리</h1>
          <p className="mt-1 text-sm text-gray-500">외부 서비스 API 인증 정보를 등록하고 관리합니다.</p>
        </div>
        <Button onClick={openAddModal}>
          <Plus className="mr-2 h-4 w-4" />
          서비스 추가
        </Button>
      </div>

      <div className="space-y-8">
        {grouped.map(({ category, providers: catProviders }) => (
          <div key={category}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              {category}
            </h2>
            <div className="space-y-2">
              {catProviders.map((provider) => {
                const inst     = instances.get(provider.key);
                const isActive = inst?.isActive === true;
                const isOpen   = expanded === provider.key;
                const tStatus  = testStatus[provider.key] ?? 'idle';
                const tMessage = testMessage[provider.key] ?? '';
                const fields   = formValues[provider.key] ?? {};
                const isBuiltIn = BUILT_IN_KEYS.has(provider.key);

                return (
                  <div key={provider.key} className="rounded-xl border bg-white overflow-hidden">
                    <div className="flex items-center">
                      <button
                        type="button"
                        className="flex-1 flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                        onClick={() => toggleExpand(provider.key, provider.fields)}
                      >
                        {isActive
                          ? <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-500" />
                          : <Circle className="h-5 w-5 flex-shrink-0 text-gray-300" />
                        }
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{provider.name}</span>
                            {isActive
                              ? <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5">연동됨</span>
                              : <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">미연동</span>
                            }
                            {!isBuiltIn && (
                              <span className="text-xs bg-blue-50 text-blue-500 rounded-full px-2 py-0.5">커스텀</span>
                            )}
                          </div>
                          {provider.description && (
                            <p className="mt-0.5 text-xs text-gray-400 truncate">{provider.description}</p>
                          )}
                        </div>
                        {isOpen
                          ? <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-400" />
                          : <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-400" />
                        }
                      </button>

                      {/* 커스텀 서비스만 삭제 버튼 표시 */}
                      {!isBuiltIn && (
                        <button
                          type="button"
                          disabled={deleting === provider.key}
                          onClick={() => handleDeleteProvider(provider.key, provider.name)}
                          className="px-4 py-4 text-gray-300 hover:text-red-500 transition-colors"
                          title="서비스 삭제"
                        >
                          {deleting === provider.key
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Trash2 className="h-4 w-4" />
                          }
                        </button>
                      )}
                    </div>

                    {isOpen && (
                      <div className="border-t px-5 py-5 space-y-4">
                        <div className="space-y-3">
                          {provider.fields.map((field) => (
                            <div key={field.key}>
                              <label className="mb-1 block text-sm font-medium text-gray-700">
                                {field.label}
                                {field.required && <span className="ml-0.5 text-red-500">*</span>}
                              </label>
                              <div className="relative">
                                <input
                                  type={field.type === 'password' && !fields[field.key]?.show ? 'password' : 'text'}
                                  value={fields[field.key]?.value ?? ''}
                                  onChange={(e) => setField(provider.key, field.key, e.target.value)}
                                  placeholder={field.placeholder ?? ''}
                                  className="w-full rounded-md border px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                {field.type === 'password' && (
                                  <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    onClick={() => toggleShow(provider.key, field.key)}
                                  >
                                    {fields[field.key]?.show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {tStatus !== 'idle' && tMessage && (
                          <p className={`text-sm rounded-md px-3 py-2 ${
                            tStatus === 'success' ? 'bg-green-50 text-green-700' :
                            tStatus === 'fail'    ? 'bg-red-50 text-red-600' :
                            'bg-gray-50 text-gray-500'
                          }`}>
                            {tStatus === 'success' && '✅ '}
                            {tStatus === 'fail'    && '❌ '}
                            {tMessage}
                          </p>
                        )}

                        <div className="flex items-center gap-2 pt-1">
                          {provider.hasTest && (
                            <Button type="button" variant="outline" size="sm"
                              disabled={tStatus === 'testing'} onClick={() => handleTest(provider)}>
                              {tStatus === 'testing'
                                ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />테스트 중...</>
                                : '연결 테스트'}
                            </Button>
                          )}
                          <Button type="button" size="sm" disabled={saving === provider.key}
                            onClick={() => handleSave(provider)}>
                            {saving === provider.key ? '저장 중...' : '저장'}
                          </Button>
                          {isActive && (
                            <Button type="button" variant="outline" size="sm"
                              disabled={disabling === provider.key}
                              className="ml-auto text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => handleDisable(provider.key)}>
                              {disabling === provider.key ? '해제 중...' : '연동 해제'}
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 새 서비스 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between border-b px-6 py-4 flex-shrink-0">
              <h2 className="text-base font-semibold">새 연동 서비스 추가</h2>
              <button type="button" onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 모달 바디 */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              {/* 서비스 이름 */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  서비스 이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newForm.name}
                  onChange={(e) => setNewForm((prev) => ({
                    ...prev,
                    name: e.target.value,
                    key: nameToKey(e.target.value),
                  }))}
                  placeholder="예: 쿨에스엠에스"
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 서비스 키 */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  서비스 키 <span className="text-red-500">*</span>
                  <span className="ml-1 text-xs font-normal text-gray-400">(영소문자·숫자·언더스코어, 자동 생성)</span>
                </label>
                <input
                  type="text"
                  value={newForm.key}
                  onChange={(e) => setNewForm((prev) => ({ ...prev, key: e.target.value }))}
                  placeholder="예: coolsms"
                  className="w-full rounded-md border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 카테고리 */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  카테고리 <span className="text-red-500">*</span>
                </label>
                <select
                  value={newForm.category}
                  onChange={(e) => setNewForm((prev) => ({ ...prev, category: e.target.value }))}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">카테고리 선택</option>
                  {existingCategories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  <option value="__custom__">+ 직접 입력</option>
                </select>
                {newForm.category === '__custom__' && (
                  <input
                    type="text"
                    value={newForm.customCategory}
                    onChange={(e) => setNewForm((prev) => ({ ...prev, customCategory: e.target.value }))}
                    placeholder="카테고리 이름 입력"
                    className="mt-2 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>

              {/* 설명 */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">설명</label>
                <input
                  type="text"
                  value={newForm.description}
                  onChange={(e) => setNewForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="서비스에 대한 간단한 설명"
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 인증 필드 */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">
                    인증 필드 <span className="text-red-500">*</span>
                  </label>
                  <button type="button" onClick={addField}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                    <Plus className="h-3.5 w-3.5" /> 필드 추가
                  </button>
                </div>

                {newForm.fields.length === 0 ? (
                  <p className="rounded-md border border-dashed px-4 py-3 text-center text-sm text-gray-400">
                    필드 추가 버튼을 눌러 인증 필드를 추가하세요.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {newForm.fields.map((f, idx) => (
                      <div key={idx} className="flex items-center gap-2 rounded-md border px-3 py-2">
                        <GripVertical className="h-4 w-4 flex-shrink-0 text-gray-300" />
                        <input
                          type="text"
                          value={f.label}
                          onChange={(e) => updateField(idx, { label: e.target.value, key: labelToKey(e.target.value) })}
                          placeholder="필드 이름 (예: API Key)"
                          className="flex-1 min-w-0 text-sm border-0 outline-none bg-transparent"
                        />
                        <select
                          value={f.type}
                          onChange={(e) => updateField(idx, { type: e.target.value as 'text' | 'password' })}
                          className="text-xs border rounded px-1.5 py-1 focus:outline-none bg-white"
                        >
                          <option value="text">텍스트</option>
                          <option value="password">비밀번호</option>
                        </select>
                        <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={f.required}
                            onChange={(e) => updateField(idx, { required: e.target.checked })}
                            className="rounded"
                          />
                          필수
                        </label>
                        <button type="button" onClick={() => removeField(idx)}
                          className="text-gray-300 hover:text-red-500">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 연결 테스트 지원 여부 */}
              <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                <div>
                  <p className="text-sm font-medium">연결 테스트</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    켜면 테스트 버튼이 표시됩니다. Edge Function에 별도 구현 필요.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setNewForm((prev) => ({ ...prev, hasTest: !prev.hasTest }))}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                    newForm.hasTest ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    newForm.hasTest ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {addError && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{addError}</p>
              )}
            </div>

            {/* 모달 푸터 */}
            <div className="flex gap-2 border-t px-6 py-4 flex-shrink-0">
              <Button variant="outline" className="flex-1" onClick={() => setShowAddModal(false)}
                disabled={addSaving}>
                취소
              </Button>
              <Button className="flex-1" onClick={handleAddProvider} disabled={addSaving}>
                {addSaving ? '추가 중...' : '서비스 추가'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
