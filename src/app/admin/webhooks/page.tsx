import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import {
  Plus, Edit, Trash2, Webhook, ChevronDown, ChevronUp, X,
  Copy, Eye, EyeOff, RefreshCw, ArrowDownToLine, Loader2,
} from 'lucide-react';
import {
  getWebhookConfigs, createWebhookConfig, updateWebhookConfig,
  deleteWebhookConfig, getWebhookLogs,
  getInboundWebhooks, upsertInboundWebhook, regenerateInboundSecret,
  getInboundWebhookLogs,
  type WebhookConfig, type WebhookLog, type InboundWebhook, type InboundWebhookLog,
} from '@/services/webhooks';
import {
  WEBHOOK_EVENTS, WEBHOOK_EVENT_GROUPS, WEBHOOK_EVENT_LABEL,
} from '@/constants/webhookEvents';

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

interface WebhookForm {
  name: string;
  url: string;
  secret: string;
  events: string[];
}

const EMPTY_FORM: WebhookForm = { name: '', url: '', secret: '', events: [] };

// ---------------------------------------------------------------------------
// 헬퍼
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  if (status === 'success')
    return <Badge className="bg-green-100 text-green-700 border-green-200 border">성공</Badge>;
  if (status === 'failed')
    return <Badge variant="destructive">실패</Badge>;
  return <Badge variant="secondary">대기</Badge>;
}

function fmt(dateStr: string | null) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('ko-KR');
}

function eventLabel(key: string) {
  return WEBHOOK_EVENT_LABEL[key] ?? key;
}

// ---------------------------------------------------------------------------
// 컴포넌트
// ---------------------------------------------------------------------------

export default function AdminWebhooksPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  // 탭
  const [tab, setTab] = useState<'outbound' | 'inbound'>('outbound');

  // 발신 웹훅
  const [webhooks, setWebhooks]           = useState<WebhookConfig[]>([]);
  const [loading, setLoading]             = useState(true);
  const [showModal, setShowModal]         = useState(false);
  const [editingId, setEditingId]         = useState<string | null>(null);
  const [form, setForm]                   = useState<WebhookForm>(EMPTY_FORM);
  const [submitting, setSubmitting]       = useState(false);
  const [expandedId, setExpandedId]       = useState<string | null>(null);
  const [logs, setLogs]                   = useState<WebhookLog[]>([]);
  const [logsLoading, setLogsLoading]     = useState(false);
  const [showSecret, setShowSecret]       = useState(false);

  // 수신 웹훅
  const [inbounds, setInbounds]                   = useState<InboundWebhook[]>([]);
  const [inboundLoading, setInboundLoading]       = useState(true);
  const [inboundExpanded, setInboundExpanded]     = useState<string | null>(null);
  const [inboundLogs, setInboundLogs]             = useState<InboundWebhookLog[]>([]);
  const [inboundLogsLoading, setInboundLogsLoading] = useState(false);
  const [secretVisible, setSecretVisible]         = useState<Record<string, boolean>>({});
  const [regenLoading, setRegenLoading]           = useState<string | null>(null);
  const [showAddInbound, setShowAddInbound]       = useState(false);
  const [newInboundSource, setNewInboundSource]   = useState('');
  const [newInboundLabel, setNewInboundLabel]     = useState('');
  const [addInboundLoading, setAddInboundLoading] = useState(false);

  // 공통 토스트
  const [toast, setToast] = useState('');
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  useEffect(() => {
    if (!authLoading) {
      if (!user) { navigate('/auth/login'); return; }
      loadWebhooks();
      loadInbounds();
    }
  }, [user, authLoading, navigate]);

  // -------------------------------------------------------------------------
  // 발신 웹훅
  // -------------------------------------------------------------------------

  async function loadWebhooks() {
    try {
      setLoading(true);
      setWebhooks(await getWebhookConfigs());
    } catch {
      showToast('웹훅 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function loadLogs(webhookId: string) {
    setLogsLoading(true);
    try { setLogs(await getWebhookLogs(webhookId)); }
    catch { setLogs([]); }
    finally { setLogsLoading(false); }
  }

  function toggleExpand(webhookId: string) {
    if (expandedId === webhookId) { setExpandedId(null); setLogs([]); }
    else { setExpandedId(webhookId); loadLogs(webhookId); }
  }

  function openCreate() {
    setEditingId(null); setForm(EMPTY_FORM); setShowSecret(false); setShowModal(true);
  }

  function openEdit(wh: WebhookConfig) {
    setEditingId(wh.id);
    setForm({ name: wh.name, url: wh.url, secret: wh.secret ?? '', events: wh.events ?? [] });
    setShowSecret(false); setShowModal(true);
  }

  function toggleEvent(v: string) {
    setForm((p) => ({
      ...p,
      events: p.events.includes(v) ? p.events.filter((e) => e !== v) : [...p.events, v],
    }));
  }

  function toggleEventGroup(group: string) {
    const groupKeys = WEBHOOK_EVENTS.filter((e) => e.group === group).map((e) => e.key);
    const allSel    = groupKeys.every((k) => form.events.includes(k));
    setForm((p) => ({
      ...p,
      events: allSel
        ? p.events.filter((e) => !groupKeys.includes(e))
        : [...new Set([...p.events, ...groupKeys])],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.events.length === 0) { showToast('이벤트를 하나 이상 선택해주세요.'); return; }
    setSubmitting(true);
    try {
      if (editingId) {
        await updateWebhookConfig(editingId, {
          name: form.name, url: form.url, secret: form.secret || null, events: form.events,
        });
        showToast('웹훅이 수정되었습니다.');
      } else {
        await createWebhookConfig({
          name: form.name, url: form.url, secret: form.secret || null, events: form.events,
        });
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
      await updateWebhookConfig(webhookId, { is_active: !current });
      await loadWebhooks();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.');
    }
  }

  async function handleDelete(webhookId: string) {
    if (!confirm('이 웹훅을 삭제하시겠습니까? 관련 로그도 모두 삭제됩니다.')) return;
    try {
      await deleteWebhookConfig(webhookId);
      if (expandedId === webhookId) { setExpandedId(null); setLogs([]); }
      showToast('웹훅이 삭제되었습니다.');
      await loadWebhooks();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.');
    }
  }

  // -------------------------------------------------------------------------
  // 수신 웹훅
  // -------------------------------------------------------------------------

  async function loadInbounds() {
    try {
      setInboundLoading(true);
      setInbounds(await getInboundWebhooks());
    } catch {
      showToast('수신 웹훅 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setInboundLoading(false);
    }
  }

  async function loadInboundLogs(source: string) {
    setInboundLogsLoading(true);
    try { setInboundLogs(await getInboundWebhookLogs(source)); }
    catch { setInboundLogs([]); }
    finally { setInboundLogsLoading(false); }
  }

  function toggleInboundExpand(source: string) {
    if (inboundExpanded === source) { setInboundExpanded(null); setInboundLogs([]); }
    else { setInboundExpanded(source); loadInboundLogs(source); }
  }

  async function handleRegenSecret(source: string) {
    if (!confirm('시크릿 키를 재발급하시겠습니까? 기존 키는 더 이상 유효하지 않습니다.')) return;
    setRegenLoading(source);
    try {
      const newKey = await regenerateInboundSecret(source);
      showToast(`새 시크릿 키: ${newKey}`);
      await loadInbounds();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '재발급 실패');
    } finally {
      setRegenLoading(null);
    }
  }

  async function handleToggleInboundActive(source: string, current: boolean) {
    try {
      await upsertInboundWebhook(source, { is_active: !current });
      await loadInbounds();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.');
    }
  }

  async function handleAddInbound() {
    if (!newInboundSource.trim() || !newInboundLabel.trim()) {
      showToast('소스 키와 이름을 모두 입력해주세요.');
      return;
    }
    setAddInboundLoading(true);
    try {
      await upsertInboundWebhook(newInboundSource.trim(), { label: newInboundLabel.trim(), is_active: true });
      showToast('수신 웹훅이 추가되었습니다.');
      setShowAddInbound(false);
      setNewInboundSource('');
      setNewInboundLabel('');
      await loadInbounds();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '추가 실패');
    } finally {
      setAddInboundLoading(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    showToast('클립보드에 복사되었습니다.');
  }

  // -------------------------------------------------------------------------
  // 렌더링
  // -------------------------------------------------------------------------

  if (authLoading) return <div className="container py-8">로딩 중...</div>;

  // 수신 웹훅 엔드포인트 URL 베이스 (Edge Function URL)
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
  const inboundBaseUrl = supabaseUrl ? `${supabaseUrl}/functions/v1/webhook-receiver` : '/functions/v1/webhook-receiver';

  return (
    <div className="container py-8">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm">
          {toast}
        </div>
      )}

      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Webhook className="h-6 w-6 text-indigo-600" />
          웹훅 관리
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          외부 서비스와 이벤트를 주고받는 웹훅을 관리합니다.
        </p>
      </div>

      {/* 탭 */}
      <div className="mb-6 flex gap-1 border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'outbound'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setTab('outbound')}
        >
          발신 웹훅
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'inbound'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setTab('inbound')}
        >
          수신 웹훅
        </button>
      </div>

      {/* ===== 발신 웹훅 탭 ===== */}
      {tab === 'outbound' && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">이벤트 발생 시 등록된 URL로 POST 요청을 보냅니다.</p>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              웹훅 추가
            </Button>
          </div>

          {loading ? (
            <div className="py-12 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : webhooks.length === 0 ? (
            <Card className="p-12 text-center">
              <Webhook className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="mb-4 text-gray-500">등록된 웹훅이 없습니다.</p>
              <Button onClick={openCreate}>웹훅 추가하기</Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {webhooks.map((wh) => (
                <Card key={wh.id} className="overflow-hidden">
                  <div className="p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">{wh.name}</span>
                        <Badge variant={wh.is_active ? 'default' : 'secondary'}>
                          {wh.is_active ? '활성' : '비활성'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                        <span className="truncate max-w-md font-mono text-xs">{wh.url}</span>
                        <button onClick={() => copyToClipboard(wh.url)} className="shrink-0 text-gray-400 hover:text-gray-600" title="URL 복사">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(wh.events ?? []).map((ev) => (
                          <span key={ev} className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded">
                            {eventLabel(ev)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => handleToggleActive(wh.id, wh.is_active)}>
                        {wh.is_active ? '비활성화' : '활성화'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(wh)}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(wh.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toggleExpand(wh.id)}>
                        {expandedId === wh.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        <span className="ml-1 text-xs">로그</span>
                      </Button>
                    </div>
                  </div>

                  {expandedId === wh.id && (
                    <div className="border-t bg-gray-50 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-gray-700">최근 전송 로그</h4>
                        <Button size="sm" variant="ghost" onClick={() => loadLogs(wh.id)}>
                          <RefreshCw className="h-3.5 w-3.5 mr-1" />새로고침
                        </Button>
                      </div>
                      {logsLoading ? (
                        <div className="py-4 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
                      ) : logs.length === 0 ? (
                        <p className="text-sm text-gray-400 py-4 text-center">전송 로그가 없습니다.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="border-b">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">이벤트</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">상태</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">응답코드</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">소요시간</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">전송 시간</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {logs.map((log) => (
                                <tr key={log.id} className="hover:bg-gray-100">
                                  <td className="px-3 py-2">
                                    <span className="bg-white border text-gray-700 text-xs px-2 py-0.5 rounded">
                                      {eventLabel(log.event)}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2"><StatusBadge status={log.status} /></td>
                                  <td className="px-3 py-2 font-mono text-xs text-gray-600">{log.response_code ?? '-'}</td>
                                  <td className="px-3 py-2 text-xs text-gray-500">
                                    {log.duration_ms != null ? `${log.duration_ms}ms` : '-'}
                                  </td>
                                  <td className="px-3 py-2 text-xs text-gray-500">{fmt(log.sent_at)}</td>
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
        </>
      )}

      {/* ===== 수신 웹훅 탭 ===== */}
      {tab === 'inbound' && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              PG사 등 외부 서비스에서 Freecart로 보내는 이벤트를 수신합니다.
            </p>
            <Button onClick={() => setShowAddInbound(true)}>
              <Plus className="mr-2 h-4 w-4" />
              소스 추가
            </Button>
          </div>

          {inboundLoading ? (
            <div className="py-12 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : inbounds.length === 0 ? (
            <Card className="p-12 text-center">
              <ArrowDownToLine className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="mb-4 text-gray-500">등록된 수신 웹훅이 없습니다.</p>
              <Button onClick={() => setShowAddInbound(true)}>소스 추가하기</Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {inbounds.map((ib) => {
                const endpointUrl = `${inboundBaseUrl}?source=${ib.source}`;
                const isSecretVisible = secretVisible[ib.source] ?? false;

                return (
                  <Card key={ib.source} className="overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold text-gray-900">{ib.label}</span>
                            <span className="font-mono text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{ib.source}</span>
                            <Badge variant={ib.is_active ? 'default' : 'secondary'}>
                              {ib.is_active ? '활성' : '비활성'}
                            </Badge>
                          </div>

                          {/* 엔드포인트 URL */}
                          <div className="mb-2">
                            <p className="text-xs text-gray-400 mb-1">수신 엔드포인트 URL</p>
                            <div className="flex items-center gap-2 bg-gray-50 border rounded px-3 py-1.5">
                              <span className="font-mono text-xs text-gray-700 truncate flex-1">{endpointUrl}</span>
                              <button onClick={() => copyToClipboard(endpointUrl)} className="shrink-0 text-gray-400 hover:text-gray-600" title="복사">
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* 시크릿 키 */}
                          <div>
                            <p className="text-xs text-gray-400 mb-1">시크릿 키 (X-Webhook-Secret 검증용)</p>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-2 bg-gray-50 border rounded px-3 py-1.5 flex-1 min-w-0">
                                <span className="font-mono text-xs text-gray-700 truncate flex-1">
                                  {ib.secret_key
                                    ? (isSecretVisible ? ib.secret_key : '•'.repeat(32))
                                    : '(미설정)'}
                                </span>
                                {ib.secret_key && (
                                  <button
                                    onClick={() => setSecretVisible((p) => ({ ...p, [ib.source]: !isSecretVisible }))}
                                    className="shrink-0 text-gray-400 hover:text-gray-600"
                                  >
                                    {isSecretVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                  </button>
                                )}
                              </div>
                              <Button
                                size="sm" variant="outline"
                                disabled={regenLoading === ib.source}
                                onClick={() => handleRegenSecret(ib.source)}
                                title="시크릿 키 재발급"
                              >
                                {regenLoading === ib.source
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <RefreshCw className="h-3.5 w-3.5" />}
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button size="sm" variant="outline" onClick={() => handleToggleInboundActive(ib.source, ib.is_active)}>
                            {ib.is_active ? '비활성화' : '활성화'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => toggleInboundExpand(ib.source)}>
                            {inboundExpanded === ib.source ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            <span className="ml-1 text-xs">로그</span>
                          </Button>
                        </div>
                      </div>
                    </div>

                    {inboundExpanded === ib.source && (
                      <div className="border-t bg-gray-50 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-semibold text-gray-700">최근 수신 로그</h4>
                          <Button size="sm" variant="ghost" onClick={() => loadInboundLogs(ib.source)}>
                            <RefreshCw className="h-3.5 w-3.5 mr-1" />새로고침
                          </Button>
                        </div>
                        {inboundLogsLoading ? (
                          <div className="py-4 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
                        ) : inboundLogs.length === 0 ? (
                          <p className="text-sm text-gray-400 py-4 text-center">수신 로그가 없습니다.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="border-b">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">이벤트 타입</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">서명 검증</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">수신 시간</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {inboundLogs.map((log) => (
                                  <tr key={log.id} className="hover:bg-gray-100">
                                    <td className="px-3 py-2 text-xs font-mono text-gray-600">{log.event_type ?? '-'}</td>
                                    <td className="px-3 py-2">
                                      {log.is_verified
                                        ? <Badge className="bg-green-100 text-green-700 border-green-200 border text-xs">검증됨</Badge>
                                        : <Badge variant="secondary" className="text-xs">미검증</Badge>}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-gray-500">{fmt(log.received_at)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ===== 발신 웹훅 추가/수정 모달 ===== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{editingId ? '웹훅 수정' : '웹훅 추가'}</h2>
              <button onClick={() => setShowModal(false)}>
                <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="wh-name">웹훅 이름</Label>
                <Input
                  id="wh-name"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="예: ERP 주문 알림"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="wh-url">URL</Label>
                <Input
                  id="wh-url"
                  type="url"
                  value={form.url}
                  onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
                  placeholder="https://example.com/webhook"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="wh-secret">시크릿 키 (선택)</Label>
                <div className="relative">
                  <Input
                    id="wh-secret"
                    type={showSecret ? 'text' : 'password'}
                    value={form.secret}
                    onChange={(e) => setForm((p) => ({ ...p, secret: e.target.value }))}
                    placeholder="웹훅 검증용 시크릿 키"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-400">설정 시 X-Webhook-Secret 헤더로 전송됩니다.</p>
              </div>

              <div className="space-y-2">
                <Label>이벤트 선택</Label>
                <div className="border rounded-md p-3 space-y-3 max-h-60 overflow-y-auto">
                  {WEBHOOK_EVENT_GROUPS.map((group) => {
                    const groupEvents = WEBHOOK_EVENTS.filter((e) => e.group === group);
                    const allSel      = groupEvents.every((e) => form.events.includes(e.key));
                    const someSel     = !allSel && groupEvents.some((e) => form.events.includes(e.key));
                    return (
                      <div key={group}>
                        <div className="flex items-center gap-2 mb-1">
                          <input
                            type="checkbox"
                            checked={allSel}
                            ref={(el) => { if (el) el.indeterminate = someSel; }}
                            onChange={() => toggleEventGroup(group)}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <span className="text-sm font-medium text-gray-700">{group}</span>
                        </div>
                        <div className="ml-6 grid grid-cols-2 gap-1">
                          {groupEvents.map((ev) => (
                            <label key={ev.key} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer hover:text-gray-900">
                              <input
                                type="checkbox"
                                checked={form.events.includes(ev.key)}
                                onChange={() => toggleEvent(ev.key)}
                                className="h-3.5 w-3.5 rounded border-gray-300"
                              />
                              {ev.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {form.events.length > 0 && (
                  <p className="text-xs text-gray-500">{form.events.length}개 이벤트 선택됨</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? '처리 중...' : editingId ? '수정' : '추가'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>취소</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* ===== 수신 웹훅 소스 추가 모달 ===== */}
      {showAddInbound && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold">수신 웹훅 소스 추가</h2>
              <button onClick={() => setShowAddInbound(false)}>
                <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>소스 키</Label>
                <Input
                  value={newInboundSource}
                  onChange={(e) => setNewInboundSource(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="예: naver, kakao"
                />
                <p className="text-xs text-gray-400">영소문자·숫자·언더스코어만 사용 가능</p>
              </div>
              <div className="space-y-2">
                <Label>표시 이름</Label>
                <Input
                  value={newInboundLabel}
                  onChange={(e) => setNewInboundLabel(e.target.value)}
                  placeholder="예: 네이버 쇼핑"
                />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" disabled={addInboundLoading} onClick={handleAddInbound}>
                  {addInboundLoading ? '추가 중...' : '추가'}
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setShowAddInbound(false)}>취소</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
