import { useState, useEffect } from 'react';
import { Layers, CheckCircle, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

interface Skin {
  id: string;
  name: string;
  type: string;
  version: string;
  isActive: boolean;
  installedAt?: string;
}

const TYPE_LABELS: Record<string, string> = {
  board_list: '게시판 목록',
  board_view: '게시판 상세',
  product_list: '상품 목록',
  product_view: '상품 상세',
  cart: '장바구니',
  checkout: '주문/결제',
  mypage: '마이페이지',
};

export default function AdminSkinsPage() {
  const [skins, setSkins] = useState<Skin[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  useEffect(() => {
    fetch('/api/admin/skins')
      .then((r) => r.json())
      .then((data) => setSkins(data.skins || data || []))
      .catch(() => setSkins([]))
      .finally(() => setLoading(false));
  }, []);

  async function toggleActive(id: string, current: boolean) {
    setActionLoading(id + '-toggle');
    try {
      const res = await fetch(`/api/admin/skins/${id}/activate`, { method: 'POST' });
      const data = await res.json();
      if (data.success || res.ok) {
        setSkins((prev) =>
          prev.map((s) => (s.id === id ? { ...s, isActive: !current } : s))
        );
        showToast(current ? '스킨이 비활성화되었습니다.' : '스킨이 활성화되었습니다.');
      } else showToast('변경에 실패했습니다.');
    } catch { showToast('오류가 발생했습니다.'); }
    finally { setActionLoading(null); }
  }

  async function deleteSkin(id: string) {
    if (!confirm('이 스킨을 삭제하시겠습니까?')) return;
    setActionLoading(id + '-delete');
    try {
      const res = await fetch(`/api/admin/skins/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSkins((prev) => prev.filter((s) => s.id !== id));
        showToast('스킨이 삭제되었습니다.');
      } else showToast('삭제에 실패했습니다.');
    } catch { showToast('오류가 발생했습니다.'); }
    finally { setActionLoading(null); }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Layers className="h-7 w-7 text-purple-600" />
          스킨 관리
        </h1>
        <p className="text-gray-500 text-sm mt-1">설치된 스킨을 관리합니다.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-purple-600 border-t-transparent" />
        </div>
      ) : skins.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Layers className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>설치된 스킨이 없습니다.</p>
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">스킨명</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">타입</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">버전</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">활성화 여부</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {skins.map((skin) => (
                <tr key={skin.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{skin.name}</td>
                  <td className="px-4 py-3">
                    <span className="bg-purple-100 text-purple-700 text-xs font-medium px-2 py-1 rounded-full">
                      {TYPE_LABELS[skin.type] || skin.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">v{skin.version}</td>
                  <td className="px-4 py-3">
                    {skin.isActive ? (
                      <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-medium px-2 py-1 rounded-full">
                        <CheckCircle className="h-3 w-3" /> 활성
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 text-xs font-medium px-2 py-1 rounded-full">
                        비활성
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleActive(skin.id, skin.isActive)}
                        disabled={actionLoading === skin.id + '-toggle'}
                        title={skin.isActive ? '비활성화' : '활성화'}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                      >
                        {skin.isActive ? (
                          <ToggleRight className="h-5 w-5 text-green-600" />
                        ) : (
                          <ToggleLeft className="h-5 w-5 text-gray-400" />
                        )}
                      </button>
                      <button
                        onClick={() => deleteSkin(skin.id)}
                        disabled={actionLoading === skin.id + '-delete' || skin.isActive}
                        title={skin.isActive ? '활성 스킨은 삭제할 수 없습니다' : '삭제'}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors disabled:opacity-30"
                      >
                        <Trash2 className="h-4 w-4" />
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
