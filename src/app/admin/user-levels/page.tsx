import { useState, useEffect } from 'react';
import { Users, Edit2, Save, X } from 'lucide-react';

interface UserLevel {
  id: string;
  levelNumber: number;
  name: string;
  discountRate: number;
  pointRate: number;
  memberCount: number;
  minPurchase?: number;
  color?: string;
}

export default function AdminUserLevelsPage() {
  const [levels, setLevels] = useState<UserLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<UserLevel>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  useEffect(() => {
    fetch('/api/admin/user-levels')
      .then((r) => r.json())
      .then((data) => setLevels(data.levels || data || []))
      .catch(() => setLevels([]))
      .finally(() => setLoading(false));
  }, []);

  function startEdit(level: UserLevel) {
    setEditingId(level.id);
    setEditData({ name: level.name, discountRate: level.discountRate, pointRate: level.pointRate });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditData({});
  }

  async function saveLevel(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/user-levels/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      });
      const data = await res.json();
      if (data.success || res.ok) {
        setLevels((prev) =>
          prev.map((l) => (l.id === id ? { ...l, ...editData } : l))
        );
        cancelEdit();
        showToast('등급이 저장되었습니다.');
      } else showToast('저장에 실패했습니다.');
    } catch { showToast('오류가 발생했습니다.'); }
    finally { setSaving(false); }
  }

  const levelColors = [
    'bg-gray-200 text-gray-700',
    'bg-green-200 text-green-700',
    'bg-blue-200 text-blue-700',
    'bg-purple-200 text-purple-700',
    'bg-yellow-200 text-yellow-800',
    'bg-red-200 text-red-700',
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="h-7 w-7 text-orange-600" />
          회원 등급 관리
        </h1>
        <p className="text-gray-500 text-sm mt-1">회원 등급별 혜택을 설정합니다.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent" />
        </div>
      ) : levels.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>등록된 등급이 없습니다.</p>
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">등급번호</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">등급명</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">할인율</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">적립률</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">회원수</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {levels.map((level, idx) => (
                <tr key={level.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                        levelColors[idx % levelColors.length]
                      }`}
                    >
                      {level.levelNumber}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {editingId === level.id ? (
                      <input
                        type="text"
                        value={editData.name ?? ''}
                        onChange={(e) => setEditData((d) => ({ ...d, name: e.target.value }))}
                        className="border rounded-lg px-2 py-1 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    ) : (
                      <span className="font-medium text-gray-900">{level.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === level.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          value={editData.discountRate ?? 0}
                          onChange={(e) =>
                            setEditData((d) => ({ ...d, discountRate: parseFloat(e.target.value) }))
                          }
                          className="border rounded-lg px-2 py-1 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                        <span className="text-gray-500">%</span>
                      </div>
                    ) : (
                      <span>{level.discountRate}%</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === level.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          value={editData.pointRate ?? 0}
                          onChange={(e) =>
                            setEditData((d) => ({ ...d, pointRate: parseFloat(e.target.value) }))
                          }
                          className="border rounded-lg px-2 py-1 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                        <span className="text-gray-500">%</span>
                      </div>
                    ) : (
                      <span>{level.pointRate}%</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {level.memberCount.toLocaleString()}명
                  </td>
                  <td className="px-4 py-3">
                    {editingId === level.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => saveLevel(level.id)}
                          disabled={saving}
                          className="flex items-center gap-1 text-xs bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
                        >
                          <Save className="h-3 w-3" />
                          저장
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="flex items-center gap-1 text-xs border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-lg"
                        >
                          <X className="h-3 w-3" />
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(level)}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        <Edit2 className="h-3 w-3" />
                        수정
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-700">
        <strong>등급 혜택 안내:</strong> 할인율은 상품 구매 시 자동 적용되며, 적립률은 결제 금액의 비율로 포인트가 지급됩니다.
      </div>
    </div>
  );
}
