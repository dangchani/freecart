import { useState, useEffect } from 'react';
import { Link2, RefreshCw, FileText, Plus, X, CheckCircle, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface ExternalConnection {
  id: string;
  platform: string;
  name: string;
  lastSyncedAt?: string;
  isActive: boolean;
  status?: 'syncing' | 'success' | 'error' | 'idle';
  apiConfig?: Record<string, string>;
}

const PLATFORMS = [
  { value: 'naver', label: '네이버 스마트스토어' },
  { value: 'kakao', label: '카카오쇼핑' },
  { value: 'coupang', label: '쿠팡' },
  { value: 'gmarket', label: 'G마켓' },
  { value: '11st', label: '11번가' },
  { value: 'wemakeprice', label: '위메프' },
  { value: 'tmon', label: '티몬' },
  { value: 'instagram', label: '인스타그램 쇼핑' },
  { value: 'custom', label: '직접 입력' },
];

export default function AdminExternalConnectionsPage() {
  const [connections, setConnections] = useState<ExternalConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [logsModal, setLogsModal] = useState<{ id: string; name: string } | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [toast, setToast] = useState('');

  const [newPlatform, setNewPlatform] = useState('');
  const [newName, setNewName] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [newApiSecret, setNewApiSecret] = useState('');
  const [adding, setAdding] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  useEffect(() => {
    loadConnections();
  }, []);

  async function loadConnections() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('external_connections')
        .select('id, platform, name, is_active, last_sync_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConnections(
        (data || []).map((c) => ({
          id: c.id,
          platform: c.platform,
          name: c.name,
          isActive: c.is_active,
          lastSyncedAt: c.last_sync_at || undefined,
          status: 'idle',
        }))
      );
    } catch {
      setConnections([]);
    } finally {
      setLoading(false);
    }
  }

  async function syncNow(id: string) {
    setSyncLoading(id);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('external_connections')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      setConnections((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, lastSyncedAt: new Date().toISOString(), status: 'success' as const } : c
        )
      );
      showToast('동기화가 완료되었습니다.');
    } catch {
      showToast('동기화에 실패했습니다.');
    } finally {
      setSyncLoading(null);
    }
  }

  async function viewLogs(conn: ExternalConnection) {
    setLogsModal({ id: conn.id, name: conn.name });
    setLogsLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('sync_logs')
        .select('type, status, total_count, success_count, fail_count, error_message, started_at')
        .eq('connection_id', conn.id)
        .order('started_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setLogs(
        (data || []).map(
          (l) =>
            `[${l.started_at ? new Date(l.started_at).toLocaleString('ko-KR') : ''}] ${l.type} - ${l.status} (${l.success_count}/${l.total_count})${l.error_message ? ' - ' + l.error_message : ''}`
        )
      );
    } catch {
      setLogs(['로그를 불러오는데 실패했습니다.']);
    } finally {
      setLogsLoading(false);
    }
  }

  async function addConnection() {
    if (!newPlatform || !newName) return;
    setAdding(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('external_connections')
        .insert({
          platform: newPlatform,
          name: newName,
          config: {},
          credentials: { apiKey: newApiKey, apiSecret: newApiSecret },
          is_active: true,
        })
        .select('id')
        .single();

      if (error) throw error;
      const created: ExternalConnection = {
        id: data.id,
        platform: newPlatform,
        name: newName,
        isActive: true,
        status: 'idle',
      };
      setConnections((prev) => [created, ...prev]);
      setShowAdd(false);
      setNewPlatform('');
      setNewName('');
      setNewApiKey('');
      setNewApiSecret('');
      showToast('연동이 추가되었습니다.');
    } catch {
      showToast('추가에 실패했습니다.');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm">{toast}</div>
      )}

      {logsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h3 className="font-bold text-lg">{logsModal.name} - 동기화 로그</h3>
              <button onClick={() => setLogsModal(null)}><X className="h-5 w-5 text-gray-400 hover:text-gray-600" /></button>
            </div>
            <div className="flex-1 overflow-y-auto bg-gray-900 rounded-lg p-4 font-mono text-xs text-green-400">
              {logsLoading ? (
                <p className="text-gray-400">로그 불러오는 중...</p>
              ) : logs.length === 0 ? (
                <p className="text-gray-400">로그가 없습니다.</p>
              ) : (
                logs.map((log, i) => <p key={i}>{log}</p>)
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Link2 className="h-7 w-7 text-indigo-600" />
            외부 연동 관리
          </h1>
          <p className="text-gray-500 text-sm mt-1">외부 플랫폼과의 데이터 동기화를 관리합니다.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus className="h-4 w-4" />연동 추가
        </button>
      </div>

      {showAdd && (
        <div className="mb-6 border rounded-xl p-6 bg-indigo-50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">새 외부 연동 추가</h3>
            <button onClick={() => setShowAdd(false)}><X className="h-5 w-5 text-gray-400 hover:text-gray-600" /></button>
          </div>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">플랫폼</label>
              <select value={newPlatform} onChange={(e) => setNewPlatform(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">플랫폼 선택</option>
                {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">연동명</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="예: 메인 스토어" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
              <input type="text" value={newApiKey} onChange={(e) => setNewApiKey(e.target.value)} placeholder="API 키 입력" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Secret</label>
              <input type="password" value={newApiSecret} onChange={(e) => setNewApiSecret(e.target.value)} placeholder="API 시크릿 입력" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowAdd(false)} className="border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50">취소</button>
            <button onClick={addConnection} disabled={adding || !newPlatform || !newName} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 flex items-center gap-2">
              <Plus className="h-4 w-4" />{adding ? '추가 중...' : '추가'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      ) : connections.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Link2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>등록된 외부 연동이 없습니다.</p>
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">플랫폼</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">연동명</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">마지막 동기화</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">상태</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {connections.map((conn) => (
                <tr key={conn.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{PLATFORMS.find((p) => p.value === conn.platform)?.label || conn.platform}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{conn.name}</td>
                  <td className="px-4 py-3 text-gray-500">{conn.lastSyncedAt ? new Date(conn.lastSyncedAt).toLocaleString('ko-KR') : '미동기화'}</td>
                  <td className="px-4 py-3">
                    {conn.isActive ? (
                      <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-medium px-2 py-1 rounded-full"><CheckCircle className="h-3 w-3" /> 활성</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 text-xs font-medium px-2 py-1 rounded-full"><AlertCircle className="h-3 w-3" /> 비활성</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => syncNow(conn.id)} disabled={syncLoading === conn.id} className="flex items-center gap-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors">
                        <RefreshCw className={`h-3 w-3 ${syncLoading === conn.id ? 'animate-spin' : ''}`} />
                        {syncLoading === conn.id ? '동기화 중...' : '동기화'}
                      </button>
                      <button onClick={() => viewLogs(conn)} className="flex items-center gap-1 text-xs border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors">
                        <FileText className="h-3 w-3" />로그
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
