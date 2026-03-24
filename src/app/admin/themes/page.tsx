import { useState, useEffect } from 'react';
import { Package, CheckCircle, Trash2, Download, Key, X } from 'lucide-react';

interface Theme {
  id: string;
  name: string;
  version: string;
  isActive: boolean;
  installedAt: string;
  thumbnail?: string;
}

interface AvailableTheme {
  id: string;
  name: string;
  version: string;
  description?: string;
  thumbnail?: string;
  requiresLicense?: boolean;
}

export default function AdminThemesPage() {
  const [activeTab, setActiveTab] = useState<'installed' | 'available'>('installed');
  const [themes, setThemes] = useState<Theme[]>([]);
  const [available, setAvailable] = useState<AvailableTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableLoading, setAvailableLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [licenseModal, setLicenseModal] = useState<{ themeId: string; themeName: string } | null>(null);
  const [licenseKey, setLicenseKey] = useState('');
  const [installLoading, setInstallLoading] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  useEffect(() => {
    fetch('/api/admin/themes')
      .then((r) => r.json())
      .then((data) => setThemes(data.themes || data || []))
      .catch(() => setThemes([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === 'available' && available.length === 0) {
      setAvailableLoading(true);
      fetch('/api/admin/themes/available')
        .then((r) => r.json())
        .then((data) => setAvailable(data.themes || data || []))
        .catch(() => setAvailable([]))
        .finally(() => setAvailableLoading(false));
    }
  }, [activeTab]);

  async function activateTheme(id: string) {
    setActionLoading(id + '-activate');
    try {
      const res = await fetch(`/api/admin/themes/${id}/activate`, { method: 'POST' });
      const data = await res.json();
      if (data.success || res.ok) {
        setThemes((prev) => prev.map((t) => ({ ...t, isActive: t.id === id })));
        showToast('테마가 활성화되었습니다.');
      } else showToast('활성화에 실패했습니다.');
    } catch { showToast('오류가 발생했습니다.'); }
    finally { setActionLoading(null); }
  }

  async function deleteTheme(id: string) {
    if (!confirm('이 테마를 삭제하시겠습니까?')) return;
    setActionLoading(id + '-delete');
    try {
      const res = await fetch(`/api/admin/themes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setThemes((prev) => prev.filter((t) => t.id !== id));
        showToast('테마가 삭제되었습니다.');
      } else showToast('삭제에 실패했습니다.');
    } catch { showToast('오류가 발생했습니다.'); }
    finally { setActionLoading(null); }
  }

  async function installTheme() {
    if (!licenseModal) return;
    setInstallLoading(true);
    try {
      const res = await fetch(`/api/admin/themes/${licenseModal.themeId}/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey }),
      });
      const data = await res.json();
      if (data.success || res.ok) {
        showToast('테마가 설치되었습니다.');
        setLicenseModal(null);
        setLicenseKey('');
        const refreshed = await fetch('/api/admin/themes').then((r) => r.json());
        setThemes(refreshed.themes || refreshed || []);
      } else showToast(data.message || '설치에 실패했습니다.');
    } catch { showToast('오류가 발생했습니다.'); }
    finally { setInstallLoading(false); }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}

      {/* 라이선스 키 모달 */}
      {licenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">테마 설치 - {licenseModal.themeName}</h3>
              <button onClick={() => setLicenseModal(null)}>
                <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Key className="h-4 w-4 inline mr-1" />
                라이선스 키
              </label>
              <input
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="라이선스 키를 입력하세요 (없으면 공란)"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setLicenseModal(null)}
                className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={installTheme}
                disabled={installLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
              >
                {installLoading ? '설치 중...' : '설치'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Package className="h-7 w-7 text-blue-600" />
          테마 관리
        </h1>
        <p className="text-gray-500 text-sm mt-1">쇼핑몰 테마를 설치하고 관리합니다.</p>
      </div>

      {/* 탭 */}
      <div className="flex border-b mb-6">
        {(['installed', 'available'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'installed' ? '설치된 테마' : '테마 스토어'}
          </button>
        ))}
      </div>

      {/* 설치된 테마 */}
      {activeTab === 'installed' && (
        <div>
          {loading ? (
            <div className="flex justify-center py-12">
              <span className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            </div>
          ) : themes.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>설치된 테마가 없습니다.</p>
            </div>
          ) : (
            <div className="bg-white border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">테마명</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">버전</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">활성화</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">설치일</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {themes.map((theme) => (
                    <tr key={theme.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{theme.name}</td>
                      <td className="px-4 py-3 text-gray-500">v{theme.version}</td>
                      <td className="px-4 py-3">
                        {theme.isActive ? (
                          <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-medium px-2 py-1 rounded-full">
                            <CheckCircle className="h-3 w-3" /> 활성
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 text-xs font-medium px-2 py-1 rounded-full">
                            비활성
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(theme.installedAt).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {!theme.isActive && (
                            <button
                              onClick={() => activateTheme(theme.id)}
                              disabled={actionLoading === theme.id + '-activate'}
                              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
                            >
                              {actionLoading === theme.id + '-activate' ? '처리 중...' : '활성화'}
                            </button>
                          )}
                          {!theme.isActive && (
                            <button
                              onClick={() => deleteTheme(theme.id)}
                              disabled={actionLoading === theme.id + '-delete'}
                              className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors flex items-center gap-1"
                            >
                              <Trash2 className="h-3 w-3" />
                              삭제
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 테마 스토어 */}
      {activeTab === 'available' && (
        <div>
          {availableLoading ? (
            <div className="flex justify-center py-12">
              <span className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            </div>
          ) : available.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>설치 가능한 테마가 없습니다.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {available.map((theme) => (
                <div key={theme.id} className="border rounded-xl overflow-hidden bg-white hover:shadow-md transition-shadow">
                  <div className="aspect-video bg-gray-100 relative">
                    {theme.thumbnail ? (
                      <img src={theme.thumbnail} alt={theme.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-300">
                        <Package className="h-12 w-12" />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900">{theme.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">v{theme.version}</p>
                    {theme.description && (
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">{theme.description}</p>
                    )}
                    <button
                      onClick={() =>
                        setLicenseModal({ themeId: theme.id, themeName: theme.name })
                      }
                      className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      설치
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
