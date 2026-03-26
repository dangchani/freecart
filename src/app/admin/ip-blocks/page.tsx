import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { Plus, Trash2, X, ShieldBan } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface IpBlock {
  id: string;
  ipAddress: string;
  reason: string | null;
  blockedBy: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export default function AdminIpBlocksPage() {
  const { user } = useAuth();
  const [blocks, setBlocks] = useState<IpBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 추가 모달
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ ipAddress: '', reason: '', expiresAt: '' });
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState('');

  useEffect(() => {
    loadBlocks();
  }, []);

  async function loadBlocks() {
    try {
      setLoading(true);
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from('ip_blocks')
        .select('id, ip_address, reason, blocked_by, expires_at, created_at')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setBlocks(
        (data || []).map((row: any) => ({
          id: row.id,
          ipAddress: row.ip_address,
          reason: row.reason,
          blockedBy: row.blocked_by,
          expiresAt: row.expires_at,
          createdAt: row.created_at,
        }))
      );
    } catch {
      setError('IP 차단 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  function isExpired(expiresAt: string | null): boolean {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipPattern.test(addForm.ipAddress)) {
      setAddError('올바른 IP 주소 형식을 입력해주세요. (예: 192.168.1.1)');
      return;
    }
    setAddSubmitting(true);
    setAddError('');
    try {
      const supabase = createClient();
      const { error } = await supabase.from('ip_blocks').insert({
        ip_address: addForm.ipAddress,
        reason: addForm.reason || null,
        blocked_by: user?.id || null,
        expires_at: addForm.expiresAt || null,
      });
      if (error) {
        if (error.code === '23505') {
          throw new Error('이미 차단된 IP 주소입니다.');
        }
        throw error;
      }
      setAddForm({ ipAddress: '', reason: '', expiresAt: '' });
      setShowAddModal(false);
      await loadBlocks();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'IP 차단 등록 중 오류가 발생했습니다.');
    } finally {
      setAddSubmitting(false);
    }
  }

  async function handleDelete(id: string, ip: string) {
    if (!confirm(`${ip} 차단을 해제하시겠습니까?`)) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from('ip_blocks').delete().eq('id', id);
      if (error) throw error;
      await loadBlocks();
    } catch (err) {
      alert(err instanceof Error ? err.message : '차단 해제 중 오류가 발생했습니다.');
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">IP 차단 관리</h1>
          <p className="text-sm text-gray-500 mt-1">총 {blocks.length}건의 IP 차단</p>
        </div>
        <Button onClick={() => { setShowAddModal(true); setAddError(''); }}>
          <Plus className="mr-2 h-4 w-4" />
          IP 차단 추가
        </Button>
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-gray-200 animate-pulse rounded" />
          ))}
        </div>
      ) : blocks.length === 0 ? (
        <Card className="p-12 text-center">
          <ShieldBan className="mx-auto mb-3 h-12 w-12 text-gray-300" />
          <p className="text-gray-500 mb-3">차단된 IP가 없습니다.</p>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            첫 IP 차단 추가
          </Button>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">IP 주소</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">사유</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">만료일</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">등록일</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">상태</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {blocks.map((block) => {
                  const expired = isExpired(block.expiresAt);
                  return (
                    <tr
                      key={block.id}
                      className={`hover:bg-gray-50 ${expired ? 'bg-red-50/50' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <code className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs font-medium">
                          {block.ipAddress}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                        {block.reason || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {block.expiresAt
                          ? format(new Date(block.expiresAt), 'yyyy.MM.dd HH:mm')
                          : '영구'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {format(new Date(block.createdAt), 'yyyy.MM.dd HH:mm')}
                      </td>
                      <td className="px-4 py-3">
                        {expired ? (
                          <Badge variant="destructive">만료됨</Badge>
                        ) : (
                          <Badge variant="default">차단 중</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(block.id, block.ipAddress)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* IP 차단 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">IP 차단 추가</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <Label htmlFor="block-ip">IP 주소 *</Label>
                <Input
                  id="block-ip"
                  value={addForm.ipAddress}
                  onChange={(e) => setAddForm({ ...addForm, ipAddress: e.target.value })}
                  placeholder="192.168.1.1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="block-reason">차단 사유</Label>
                <textarea
                  id="block-reason"
                  value={addForm.reason}
                  onChange={(e) => setAddForm({ ...addForm, reason: e.target.value })}
                  placeholder="차단 사유를 입력하세요"
                  rows={3}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div>
                <Label htmlFor="block-expires">만료일시 (선택)</Label>
                <Input
                  id="block-expires"
                  type="datetime-local"
                  value={addForm.expiresAt}
                  onChange={(e) => setAddForm({ ...addForm, expiresAt: e.target.value })}
                />
                <p className="mt-1 text-xs text-gray-400">비워두면 영구 차단됩니다.</p>
              </div>

              {addError && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{addError}</p>
              )}

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={addSubmitting} className="flex-1">
                  {addSubmitting ? '등록 중...' : 'IP 차단'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
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
