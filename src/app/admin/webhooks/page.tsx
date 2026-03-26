import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import {
  Plus,
  Edit,
  Trash2,
  Webhook,
  ChevronDown,
  ChevronUp,
  X,
  Copy,
  Eye,
  EyeOff,
} from 'lucide-react';

// --- Types ---

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface WebhookLog {
  id: string;
  webhook_id: string;
  event: string;
  payload: Record<string, unknown>;
  status: string;
  response_code: number | null;
  response_body: string | null;
  sent_at: string | null;
  created_at: string;
}

interface WebhookForm {
  name: string;
  url: string;
  secret: string;
  events: string[];
}

// --- Constants ---

const EVENTS = [
  { value: 'order.created', label: '주문 생성' },
  { value: 'order.paid', label: '주문 결제 완료' },
  { value: 'order.shipped', label: '주문 배송 시작' },
  { value: 'order.delivered', label: '주문 배송 완료' },
  { value: 'order.cancelled', label: '주문 취소' },
  { value: 'product.created', label: '상품 생성' },
  { value: 'product.updated', label: '상품 수정' },
  { value: 'product.stock_changed', label: '재고 변경' },
  { value: 'user.created', label: '회원 가입' },
  { value: 'review.created', label: '리뷰 작성' },
] as const;

const EVENT_GROUPS: { label: string; prefix: string }[] = [
  { label: '주문', prefix: 'order.' },
  { label: '상품', prefix: 'product.' },
  { label: '회원', prefix: 'user.' },
  { label: '리뷰', prefix: 'review.' },
];

const emptyForm: WebhookForm = {
  name: '',
  url: '',
  secret: '',
  events: [],
};

// --- Helpers ---

function statusBadge(status: string) {
  switch (status) {
    case 'success':
      return <Badge className="bg-green-100 text-green-700 border-green-200">성공</Badge>;
    case 'failed':
      return <Badge variant="destructive">실패</Badge>;
    default:
      return <Badge variant="secondary">대기</Badge>;
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('ko-KR');
}

// --- Component ---

export default function AdminWebhooksPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<WebhookForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [toast, setToast] = useState('');

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      loadWebhooks();
    }
  }, [user, authLoading, navigate]);

  async function loadWebhooks() {
    try {
      setLoading(true);
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from('webhook_configs')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setWebhooks(data || []);
    } catch {
      setError('웹훅 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function loadLogs(webhookId: string) {
    setLogsLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('webhook_logs')
        .select('*')
        .eq('webhook_id', webhookId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setLogs(data || []);
    } catch {
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }

  function toggleExpand(webhookId: string) {
    if (expandedId === webhookId) {
      setExpandedId(null);
      setLogs([]);
    } else {
      setExpandedId(webhookId);
      loadLogs(webhookId);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowSecret(false);
    setShowModal(true);
  }

  function openEdit(webhook: WebhookConfig) {
    setEditingId(webhook.id);
    setForm({
      name: webhook.name,
      url: webhook.url,
      secret: webhook.secret || '',
      events: webhook.events || [],
    });
    setShowSecret(false);
    setShowModal(true);
  }

  function toggleEvent(eventValue: string) {
    setForm((prev) => ({
      ...prev,
      events: prev.events.includes(eventValue)
        ? prev.events.filter((e) => e !== eventValue)
        : [...prev.events, eventValue],
    }));
  }

  function toggleEventGroup(prefix: string) {
    const groupEvents = EVENTS.filter((e) => e.value.startsWith(prefix)).map((e) => e.value);
    const allSelected = groupEvents.every((e) => form.events.includes(e));
    setForm((prev) => ({
      ...prev,
      events: allSelected
        ? prev.events.filter((e) => !e.startsWith(prefix))
        : [...new Set([...prev.events, ...groupEvents])],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.events.length === 0) {
      showToast('이벤트를 하나 이상 선택해주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createClient();
      const payload = {
        name: form.name,
        url: form.url,
        secret: form.secret || null,
        events: form.events,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase
          .from('webhook_configs')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
        showToast('웹훅이 수정되었습니다.');
      } else {
        const { error } = await supabase
          .from('webhook_configs')
          .insert({ ...payload, is_active: true });
        if (error) throw error;
        showToast('웹훅이 추가되었습니다.');
      }

      setShowModal(false);
      await loadWebhooks();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(webhookId: string, current: boolean) {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('webhook_configs')
        .update({ is_active: !current, updated_at: new Date().toISOString() })
        .eq('id', webhookId);
      if (error) throw error;
      await loadWebhooks();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.');
    }
  }

  async function handleDelete(webhookId: string) {
    if (!confirm('이 웹훅을 삭제하시겠습니까? 관련 로그도 모두 삭제됩니다.')) return;
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('webhook_configs')
        .delete()
        .eq('id', webhookId);
      if (error) throw error;
      if (expandedId === webhookId) {
        setExpandedId(null);
        setLogs([]);
      }
      showToast('웹훅이 삭제되었습니다.');
      await loadWebhooks();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.');
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    showToast('클립보드에 복사되었습니다.');
  }

  if (authLoading) return <div className="container py-8">로딩 중...</div>;

  return (
    <div className="container py-8">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Webhook className="h-8 w-8 text-indigo-600" />
            웹훅 관리
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            외부 서비스에 이벤트 알림을 전송하는 웹훅을 관리합니다.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          웹훅 추가
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>
      )}

      {/* Content */}
      {loading ? (
        <div className="py-8 text-center text-gray-500">로딩 중...</div>
      ) : webhooks.length === 0 ? (
        <Card className="p-12 text-center">
          <Webhook className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="mb-4 text-gray-500">등록된 웹훅이 없습니다.</p>
          <Button onClick={openCreate}>웹훅 추가하기</Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {webhooks.map((webhook) => (
            <Card key={webhook.id} className="overflow-hidden">
              {/* Webhook row */}
              <div className="p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900 truncate">
                      {webhook.name}
                    </span>
                    <Badge variant={webhook.is_active ? 'default' : 'secondary'}>
                      {webhook.is_active ? '활성' : '비활성'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span className="truncate max-w-md">{webhook.url}</span>
                    <button
                      onClick={() => copyToClipboard(webhook.url)}
                      className="shrink-0 text-gray-400 hover:text-gray-600"
                      title="URL 복사"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(webhook.events || []).map((event) => (
                      <span
                        key={event}
                        className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded"
                      >
                        {EVENTS.find((e) => e.value === event)?.label || event}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleActive(webhook.id, webhook.is_active)}
                  >
                    {webhook.is_active ? '비활성화' : '활성화'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(webhook)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(webhook.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleExpand(webhook.id)}
                  >
                    {expandedId === webhook.id ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                    <span className="ml-1 text-xs">로그</span>
                  </Button>
                </div>
              </div>

              {/* Expanded logs */}
              {expandedId === webhook.id && (
                <div className="border-t bg-gray-50 p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">
                    최근 전송 로그
                  </h4>
                  {logsLoading ? (
                    <div className="text-sm text-gray-500 py-4 text-center">
                      로그 불러오는 중...
                    </div>
                  ) : logs.length === 0 ? (
                    <div className="text-sm text-gray-400 py-4 text-center">
                      전송 로그가 없습니다.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">
                              이벤트
                            </th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">
                              상태
                            </th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">
                              응답 코드
                            </th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">
                              전송 시간
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {logs.map((log) => (
                            <tr key={log.id} className="hover:bg-gray-100">
                              <td className="px-3 py-2">
                                <span className="inline-block bg-white border text-gray-700 text-xs px-2 py-0.5 rounded">
                                  {EVENTS.find((e) => e.value === log.event)?.label ||
                                    log.event}
                                </span>
                              </td>
                              <td className="px-3 py-2">{statusBadge(log.status)}</td>
                              <td className="px-3 py-2 text-gray-600 font-mono text-xs">
                                {log.response_code ?? '-'}
                              </td>
                              <td className="px-3 py-2 text-gray-500 text-xs">
                                {formatDate(log.sent_at)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">
                {editingId ? '웹훅 수정' : '웹훅 추가'}
              </h2>
              <button onClick={() => setShowModal(false)}>
                <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="webhook-name">웹훅 이름</Label>
                <Input
                  id="webhook-name"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="예: 주문 알림 웹훅"
                  required
                />
              </div>

              {/* URL */}
              <div className="space-y-2">
                <Label htmlFor="webhook-url">URL</Label>
                <Input
                  id="webhook-url"
                  type="url"
                  value={form.url}
                  onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
                  placeholder="https://example.com/webhook"
                  required
                />
              </div>

              {/* Secret */}
              <div className="space-y-2">
                <Label htmlFor="webhook-secret">시크릿 키 (선택)</Label>
                <div className="relative">
                  <Input
                    id="webhook-secret"
                    type={showSecret ? 'text' : 'password'}
                    value={form.secret}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, secret: e.target.value }))
                    }
                    placeholder="웹훅 검증용 시크릿 키"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showSecret ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  설정 시 X-Webhook-Secret 헤더로 전송됩니다.
                </p>
              </div>

              {/* Events multi-select */}
              <div className="space-y-2">
                <Label>이벤트 선택</Label>
                <div className="border rounded-md p-3 space-y-3 max-h-60 overflow-y-auto">
                  {EVENT_GROUPS.map((group) => {
                    const groupEvents = EVENTS.filter((e) =>
                      e.value.startsWith(group.prefix)
                    );
                    const allSelected = groupEvents.every((e) =>
                      form.events.includes(e.value)
                    );
                    const someSelected =
                      !allSelected &&
                      groupEvents.some((e) => form.events.includes(e.value));

                    return (
                      <div key={group.prefix}>
                        <div className="flex items-center gap-2 mb-1">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = someSelected;
                            }}
                            onChange={() => toggleEventGroup(group.prefix)}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <span className="text-sm font-medium text-gray-700">
                            {group.label}
                          </span>
                        </div>
                        <div className="ml-6 grid grid-cols-2 gap-1">
                          {groupEvents.map((event) => (
                            <label
                              key={event.value}
                              className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer hover:text-gray-900"
                            >
                              <input
                                type="checkbox"
                                checked={form.events.includes(event.value)}
                                onChange={() => toggleEvent(event.value)}
                                className="h-3.5 w-3.5 rounded border-gray-300"
                              />
                              {event.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {form.events.length > 0 && (
                  <p className="text-xs text-gray-500">
                    {form.events.length}개 이벤트 선택됨
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? '처리 중...' : editingId ? '수정' : '추가'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowModal(false)}
                >
                  취소
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
