import { useState, useEffect } from 'react';
import { Users, Edit2, Save, X, Plus, Trash2, Award } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface UserLevel {
  id: string;
  levelNumber: number;
  name: string;
  discountRate: number;
  pointRate: number;
  minPurchaseAmount: number;
  minPurchaseCount: number;
  description: string;
  isDefault: boolean;
  memberCount: number;
}

const emptyNew = () => ({
  name: '',
  discountRate: 0,
  pointRate: 0,
  minPurchaseAmount: 0,
  minPurchaseCount: 0,
  description: '',
});

const levelColors = [
  'bg-gray-200 text-gray-700',
  'bg-green-200 text-green-700',
  'bg-blue-200 text-blue-700',
  'bg-purple-200 text-purple-700',
  'bg-yellow-200 text-yellow-800',
  'bg-red-200 text-red-700',
  'bg-pink-200 text-pink-700',
  'bg-indigo-200 text-indigo-700',
];

export default function AdminUserLevelsPage() {
  const [levels, setLevels] = useState<UserLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<UserLevel>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  // 신규 추가 폼
  const [showAddForm, setShowAddForm] = useState(false);
  const [newForm, setNewForm] = useState(emptyNew());
  const [addSaving, setAddSaving] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  useEffect(() => {
    loadLevels();
  }, []);

  async function loadLevels() {
    try {
      setLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from('user_levels')
        .select('id, level, name, discount_rate, point_rate, min_purchase_amount, min_purchase_count, description, is_default')
        .order('level', { ascending: true });

      if (error) throw error;

      const levelsWithCounts: UserLevel[] = [];
      for (const l of data || []) {
        const { count } = await supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('level_id', l.id);

        levelsWithCounts.push({
          id: l.id,
          levelNumber: l.level,
          name: l.name,
          discountRate: Number(l.discount_rate),
          pointRate: Number(l.point_rate),
          minPurchaseAmount: Number(l.min_purchase_amount ?? 0),
          minPurchaseCount: Number(l.min_purchase_count ?? 0),
          description: l.description ?? '',
          isDefault: l.is_default ?? false,
          memberCount: count || 0,
        });
      }
      setLevels(levelsWithCounts);
    } catch {
      setLevels([]);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(level: UserLevel) {
    setEditingId(level.id);
    setEditData({
      name: level.name,
      discountRate: level.discountRate,
      pointRate: level.pointRate,
      minPurchaseAmount: level.minPurchaseAmount,
      minPurchaseCount: level.minPurchaseCount,
      description: level.description,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditData({});
  }

  async function saveLevel(id: string) {
    if (!editData.name?.trim()) return showToast('등급명을 입력해주세요.');
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('user_levels')
        .update({
          name: editData.name,
          discount_rate: editData.discountRate ?? 0,
          point_rate: editData.pointRate ?? 0,
          min_purchase_amount: editData.minPurchaseAmount ?? 0,
          min_purchase_count: editData.minPurchaseCount ?? 0,
          description: editData.description ?? '',
        })
        .eq('id', id);

      if (error) throw error;
      cancelEdit();
      await loadLevels();
      showToast('등급이 저장되었습니다.');
    } catch {
      showToast('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function addLevel() {
    if (!newForm.name.trim()) return showToast('등급명을 입력해주세요.');
    setAddSaving(true);
    try {
      const supabase = createClient();
      const nextLevel = levels.length > 0 ? Math.max(...levels.map((l) => l.levelNumber)) + 1 : 1;
      const { error } = await supabase.from('user_levels').insert({
        level: nextLevel,
        name: newForm.name.trim(),
        discount_rate: newForm.discountRate,
        point_rate: newForm.pointRate,
        min_purchase_amount: newForm.minPurchaseAmount,
        min_purchase_count: newForm.minPurchaseCount,
        description: newForm.description,
        is_default: false,
      });
      if (error) throw error;
      setShowAddForm(false);
      setNewForm(emptyNew());
      await loadLevels();
      showToast('새 등급이 추가되었습니다.');
    } catch {
      showToast('등급 추가에 실패했습니다.');
    } finally {
      setAddSaving(false);
    }
  }

  async function deleteLevel(level: UserLevel) {
    if (level.isDefault) return showToast('기본 등급은 삭제할 수 없습니다.');
    if (level.memberCount > 0) return showToast(`이 등급에 회원 ${level.memberCount}명이 있어 삭제할 수 없습니다.`);
    if (!confirm(`"${level.name}" 등급을 삭제하시겠습니까?`)) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from('user_levels').delete().eq('id', level.id);
      if (error) throw error;
      await loadLevels();
      showToast('등급이 삭제되었습니다.');
    } catch {
      showToast('삭제에 실패했습니다.');
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm">{toast}</div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Award className="h-7 w-7 text-orange-600" />
            회원 등급 관리
          </h1>
          <p className="text-gray-500 text-sm mt-1">회원 등급을 추가·수정·삭제하고 혜택을 설정합니다.</p>
        </div>
        <button
          onClick={() => { setShowAddForm(true); setEditingId(null); }}
          className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" /> 등급 추가
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent" />
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">등급</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">등급명</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">할인율</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">적립률</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">승급 조건</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">회원수</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {levels.map((level, idx) => (
                <tr key={level.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${levelColors[idx % levelColors.length]}`}>
                      {level.levelNumber}
                    </span>
                    {level.isDefault && (
                      <span className="ml-1.5 text-xs text-gray-400">기본</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === level.id ? (
                      <input type="text" value={editData.name ?? ''} onChange={(e) => setEditData((d) => ({ ...d, name: e.target.value }))} className="border rounded-lg px-2 py-1 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                    ) : (
                      <div>
                        <span className="font-medium text-gray-900">{level.name}</span>
                        {level.description && <p className="text-xs text-gray-400 mt-0.5">{level.description}</p>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === level.id ? (
                      <div className="flex items-center gap-1">
                        <input type="number" min={0} max={100} step={0.1} value={editData.discountRate ?? 0} onChange={(e) => setEditData((d) => ({ ...d, discountRate: parseFloat(e.target.value) || 0 }))} className="border rounded-lg px-2 py-1 text-sm w-16 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                        <span className="text-gray-500">%</span>
                      </div>
                    ) : (
                      <span>{level.discountRate}%</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === level.id ? (
                      <div className="flex items-center gap-1">
                        <input type="number" min={0} max={100} step={0.1} value={editData.pointRate ?? 0} onChange={(e) => setEditData((d) => ({ ...d, pointRate: parseFloat(e.target.value) || 0 }))} className="border rounded-lg px-2 py-1 text-sm w-16 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                        <span className="text-gray-500">%</span>
                      </div>
                    ) : (
                      <span>{level.pointRate}%</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {editingId === level.id ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <input type="number" min={0} value={editData.minPurchaseAmount ?? 0} onChange={(e) => setEditData((d) => ({ ...d, minPurchaseAmount: parseInt(e.target.value) || 0 }))} className="border rounded-lg px-2 py-1 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                          <span className="text-xs text-gray-500">원 이상</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <input type="number" min={0} value={editData.minPurchaseCount ?? 0} onChange={(e) => setEditData((d) => ({ ...d, minPurchaseCount: parseInt(e.target.value) || 0 }))} className="border rounded-lg px-2 py-1 text-sm w-16 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                          <span className="text-xs text-gray-500">회 이상</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs space-y-0.5">
                        {level.minPurchaseAmount > 0 && <div>{level.minPurchaseAmount.toLocaleString()}원 이상</div>}
                        {level.minPurchaseCount > 0 && <div>{level.minPurchaseCount}회 이상</div>}
                        {level.minPurchaseAmount === 0 && level.minPurchaseCount === 0 && <span className="text-gray-400">-</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{level.memberCount.toLocaleString()}명</td>
                  <td className="px-4 py-3">
                    {editingId === level.id ? (
                      <div className="flex items-center gap-2">
                        <button onClick={() => saveLevel(level.id)} disabled={saving} className="flex items-center gap-1 text-xs bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-50">
                          <Save className="h-3 w-3" /> 저장
                        </button>
                        <button onClick={cancelEdit} className="flex items-center gap-1 text-xs border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-lg">
                          <X className="h-3 w-3" /> 취소
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button onClick={() => startEdit(level)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
                          <Edit2 className="h-3 w-3" /> 수정
                        </button>
                        {!level.isDefault && (
                          <button onClick={() => deleteLevel(level)} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
                            <Trash2 className="h-3 w-3" /> 삭제
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}

              {/* 신규 등급 추가 행 */}
              {showAddForm && (
                <tr className="bg-orange-50">
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${levelColors[levels.length % levelColors.length]}`}>
                      {levels.length > 0 ? Math.max(...levels.map((l) => l.levelNumber)) + 1 : 1}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <input type="text" placeholder="등급명" value={newForm.name} onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))} className="border rounded-lg px-2 py-1 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                      <input type="text" placeholder="설명 (선택)" value={newForm.description} onChange={(e) => setNewForm((f) => ({ ...f, description: e.target.value }))} className="border rounded-lg px-2 py-1 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <input type="number" min={0} max={100} step={0.1} value={newForm.discountRate} onChange={(e) => setNewForm((f) => ({ ...f, discountRate: parseFloat(e.target.value) || 0 }))} className="border rounded-lg px-2 py-1 text-sm w-16 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                      <span className="text-gray-500">%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <input type="number" min={0} max={100} step={0.1} value={newForm.pointRate} onChange={(e) => setNewForm((f) => ({ ...f, pointRate: parseFloat(e.target.value) || 0 }))} className="border rounded-lg px-2 py-1 text-sm w-16 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                      <span className="text-gray-500">%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <input type="number" min={0} value={newForm.minPurchaseAmount} onChange={(e) => setNewForm((f) => ({ ...f, minPurchaseAmount: parseInt(e.target.value) || 0 }))} className="border rounded-lg px-2 py-1 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                        <span className="text-xs text-gray-500">원 이상</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <input type="number" min={0} value={newForm.minPurchaseCount} onChange={(e) => setNewForm((f) => ({ ...f, minPurchaseCount: parseInt(e.target.value) || 0 }))} className="border rounded-lg px-2 py-1 text-sm w-16 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                        <span className="text-xs text-gray-500">회 이상</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">-</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={addLevel} disabled={addSaving} className="flex items-center gap-1 text-xs bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-50">
                        <Save className="h-3 w-3" /> {addSaving ? '추가 중...' : '추가'}
                      </button>
                      <button onClick={() => { setShowAddForm(false); setNewForm(emptyNew()); }} className="flex items-center gap-1 text-xs border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-lg">
                        <X className="h-3 w-3" /> 취소
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {levels.length === 0 && !showAddForm && (
            <div className="text-center py-16 text-gray-400">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>등록된 등급이 없습니다.</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-700">
        <strong>안내:</strong> 할인율은 상품 구매 시 자동 적용, 적립률은 결제 금액 기준 포인트 지급입니다. 회원이 있는 등급은 삭제할 수 없습니다.
      </div>
    </div>
  );
}
