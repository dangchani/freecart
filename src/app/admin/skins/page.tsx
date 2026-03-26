import { useState, useEffect } from 'react';
import { Layers, CheckCircle, Trash2, ToggleLeft, ToggleRight, Download, ShoppingCart, Star, Key, X, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getStoreSkins, type Skin as StoreSkin } from '@/services/store';

interface Skin {
  id: string;
  name: string;
  slug: string;
  type: string;
  version: string;
  isActive: boolean;
  isSystem: boolean;
  description?: string;
  installedAt?: string;
}

interface AvailableSkin {
  id: string;
  name: string;
  slug: string;
  type: string;
  version: string;
  description?: string;
  thumbnail?: string;
  price: number;
  reviewAvg?: number;
  reviewCount?: number;
  isFeatured?: boolean;
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

const defaultSkinForm = {
  name: '',
  slug: '',
  type: 'board_list',
  version: '1.0.0',
  description: '',
};

export default function AdminSkinsPage() {
  const [activeTab, setActiveTab] = useState<'installed' | 'available'>('installed');
  const [skins, setSkins] = useState<Skin[]>([]);
  const [available, setAvailable] = useState<AvailableSkin[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableLoading, setAvailableLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [licenseModal, setLicenseModal] = useState<{ skinId: string; skinName: string; skinType: string } | null>(null);
  const [licenseKey, setLicenseKey] = useState('');
  const [installLoading, setInstallLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [skinForm, setSkinForm] = useState(defaultSkinForm);
  const [registerLoading, setRegisterLoading] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function registerSkin() {
    if (!skinForm.name.trim() || !skinForm.slug.trim()) {
      showToast('스킨명과 슬러그는 필수입니다.');
      return;
    }
    setRegisterLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('skins').insert({
        name: skinForm.name.trim(),
        slug: skinForm.slug.trim(),
        type: skinForm.type,
        version: skinForm.version || '1.0.0',
        description: skinForm.description || null,
        is_system: false,
        is_active: true,
      });

      if (error) throw error;
      showToast('스킨이 등록되었습니다.');
      setShowRegisterModal(false);
      setSkinForm(defaultSkinForm);
      await loadSkins();
    } catch (err) {
      console.error('스킨 등록 실패:', err);
      showToast('등록에 실패했습니다.');
    } finally {
      setRegisterLoading(false);
    }
  }

  useEffect(() => {
    loadSkins();
  }, []);

  useEffect(() => {
    if (activeTab === 'available' && available.length === 0) {
      loadAvailableSkins();
    }
  }, [activeTab]);

  async function loadAvailableSkins() {
    setAvailableLoading(true);
    try {
      const params: { type?: string; limit: number } = { limit: 50 };
      if (typeFilter !== 'all') {
        params.type = typeFilter;
      }
      const result = await getStoreSkins(params);
      if (result.success && result.data) {
        setAvailable(
          result.data.map((s) => ({
            id: s.id,
            name: s.name,
            slug: s.slug,
            type: s.type,
            version: s.version || '1.0.0',
            description: s.description,
            thumbnail: s.thumbnail_url,
            price: s.price,
            reviewAvg: s.review_avg,
            reviewCount: s.review_count,
            isFeatured: s.is_featured,
          }))
        );
      }
    } catch (err) {
      console.error('스킨 스토어 로딩 실패:', err);
    } finally {
      setAvailableLoading(false);
    }
  }

  async function installSkin() {
    if (!licenseModal) return;
    setInstallLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('skins').insert({
        slug: licenseModal.skinId,
        name: licenseModal.skinName,
        type: licenseModal.skinType,
        version: '1.0.0',
        source: 'store',
        license_key: licenseKey || null,
        is_active: false,
      });

      if (error) throw error;
      showToast('스킨이 설치되었습니다.');
      setLicenseModal(null);
      setLicenseKey('');
      await loadSkins();
    } catch {
      showToast('설치에 실패했습니다.');
    } finally {
      setInstallLoading(false);
    }
  }

  async function loadSkins() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('skins')
        .select('id, name, slug, type, version, description, is_active, is_system, installed_at')
        .order('type', { ascending: true });

      if (error) throw error;
      setSkins(
        (data || []).map((s) => ({
          id: s.id,
          name: s.name,
          slug: s.slug,
          type: s.type,
          version: s.version,
          description: s.description,
          isActive: s.is_active,
          isSystem: s.is_system || false,
          installedAt: s.installed_at,
        }))
      );
    } catch {
      setSkins([]);
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(id: string, current: boolean) {
    setActionLoading(id + '-toggle');
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('skins')
        .update({ is_active: !current })
        .eq('id', id);

      if (error) throw error;
      setSkins((prev) =>
        prev.map((s) => (s.id === id ? { ...s, isActive: !current } : s))
      );
      showToast(current ? '스킨이 비활성화되었습니다.' : '스킨이 활성화되었습니다.');
    } catch {
      showToast('변경에 실패했습니다.');
    } finally {
      setActionLoading(null);
    }
  }

  async function deleteSkin(id: string) {
    if (!confirm('이 스킨을 삭제하시겠습니까?')) return;
    setActionLoading(id + '-delete');
    try {
      const supabase = createClient();
      const { error } = await supabase.from('skins').delete().eq('id', id);
      if (error) throw error;
      setSkins((prev) => prev.filter((s) => s.id !== id));
      showToast('스킨이 삭제되었습니다.');
    } catch {
      showToast('삭제에 실패했습니다.');
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}

      {licenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">스킨 설치 - {licenseModal.skinName}</h3>
              <button onClick={() => setLicenseModal(null)}>
                <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <div className="mb-2 text-sm text-gray-500">
              타입: <span className="font-medium text-gray-700">{TYPE_LABELS[licenseModal.skinType] || licenseModal.skinType}</span>
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
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setLicenseModal(null)} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50">취소</button>
              <button onClick={installSkin} disabled={installLoading} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
                {installLoading ? '설치 중...' : '설치'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 스킨 등록 모달 */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">새 스킨 등록</h3>
              <button onClick={() => setShowRegisterModal(false)}>
                <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">스킨명 *</label>
                <input
                  type="text"
                  value={skinForm.name}
                  onChange={(e) => setSkinForm({ ...skinForm, name: e.target.value })}
                  placeholder="기본 게시판 스킨"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">슬러그 *</label>
                <input
                  type="text"
                  value={skinForm.slug}
                  onChange={(e) => setSkinForm({ ...skinForm, slug: e.target.value })}
                  placeholder="default-board"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-gray-400 mt-1">영문, 숫자, 하이픈만 사용</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">타입 *</label>
                <select
                  value={skinForm.type}
                  onChange={(e) => setSkinForm({ ...skinForm, type: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {Object.entries(TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">버전</label>
                <input
                  type="text"
                  value={skinForm.version}
                  onChange={(e) => setSkinForm({ ...skinForm, version: e.target.value })}
                  placeholder="1.0.0"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                <textarea
                  value={skinForm.description}
                  onChange={(e) => setSkinForm({ ...skinForm, description: e.target.value })}
                  placeholder="스킨에 대한 설명"
                  rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowRegisterModal(false)} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50">취소</button>
              <button onClick={registerSkin} disabled={registerLoading} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
                {registerLoading ? '등록 중...' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="h-7 w-7 text-purple-600" />
            스킨 관리
          </h1>
          <p className="text-gray-500 text-sm mt-1">쇼핑몰 스킨을 설치하고 관리합니다.</p>
        </div>
        <button
          onClick={() => setShowRegisterModal(true)}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" /> 스킨 등록
        </button>
      </div>

      <div className="flex border-b mb-6">
        {(['installed', 'available'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'installed' ? '설치된 스킨' : '스킨 스토어'}
          </button>
        ))}
      </div>

      {activeTab === 'installed' && (
        <>
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
                <th className="text-left px-4 py-3 font-medium text-gray-600">상태</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {skins.map((skin) => (
                <tr key={skin.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <span className="font-medium text-gray-900">{skin.name}</span>
                      {skin.isSystem && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">시스템</span>
                      )}
                      <div className="text-xs text-gray-400 mt-0.5">{skin.slug}</div>
                    </div>
                  </td>
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
                      <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 text-xs font-medium px-2 py-1 rounded-full">비활성</span>
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
                        {skin.isActive ? <ToggleRight className="h-5 w-5 text-green-600" /> : <ToggleLeft className="h-5 w-5 text-gray-400" />}
                      </button>
                      <button
                        onClick={() => deleteSkin(skin.id)}
                        disabled={actionLoading === skin.id + '-delete' || skin.isActive || skin.isSystem}
                        title={skin.isSystem ? '시스템 스킨은 삭제할 수 없습니다' : skin.isActive ? '활성 스킨은 삭제할 수 없습니다' : '삭제'}
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
        </>
      )}

      {activeTab === 'available' && (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <label className="text-sm text-gray-600">타입 필터:</label>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setAvailable([]);
              }}
              className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">전체</option>
              {Object.entries(TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <button
              onClick={() => { setAvailable([]); loadAvailableSkins(); }}
              className="text-sm text-purple-600 hover:text-purple-700"
            >
              새로고침
            </button>
          </div>

          {availableLoading ? (
            <div className="flex justify-center py-12">
              <span className="h-8 w-8 animate-spin rounded-full border-4 border-purple-600 border-t-transparent" />
            </div>
          ) : available.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Layers className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="mb-2">스킨 스토어에 연결할 수 없거나 등록된 스킨이 없습니다.</p>
              <p className="text-xs">
                freecart-web 서버가 실행 중인지 확인하세요.
                <br />
                환경변수 <code className="bg-gray-100 px-1 rounded">VITE_STORE_API_URL</code>을 설정할 수 있습니다.
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {available.map((skin) => (
                <div key={skin.id} className="border rounded-xl overflow-hidden bg-white hover:shadow-md transition-shadow">
                  <div className="aspect-video bg-gray-100 relative">
                    {skin.thumbnail ? (
                      <img src={skin.thumbnail} alt={skin.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-300"><Layers className="h-12 w-12" /></div>
                    )}
                    {skin.isFeatured && (
                      <span className="absolute top-2 left-2 bg-purple-500 text-white text-xs font-bold px-2 py-1 rounded">
                        추천
                      </span>
                    )}
                    <span className="absolute top-2 right-2 bg-gray-800/70 text-white text-xs px-2 py-1 rounded">
                      {TYPE_LABELS[skin.type] || skin.type}
                    </span>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">{skin.name}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">v{skin.version}</p>
                      </div>
                      <div className="text-right">
                        {skin.price === 0 ? (
                          <span className="text-green-600 font-bold text-sm">무료</span>
                        ) : (
                          <span className="text-purple-600 font-bold text-sm">{skin.price.toLocaleString()}원</span>
                        )}
                      </div>
                    </div>
                    {skin.description && <p className="text-sm text-gray-600 mt-2 line-clamp-2">{skin.description}</p>}
                    {(skin.reviewAvg !== undefined && skin.reviewCount !== undefined && skin.reviewCount > 0) && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span>{skin.reviewAvg.toFixed(1)}</span>
                        <span>({skin.reviewCount})</span>
                      </div>
                    )}
                    <button
                      onClick={() => setLicenseModal({ skinId: skin.id, skinName: skin.name, skinType: skin.type })}
                      className="mt-4 w-full bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
                    >
                      {skin.price === 0 ? (
                        <><Download className="h-4 w-4" />무료 설치</>
                      ) : (
                        <><ShoppingCart className="h-4 w-4" />구매 후 설치</>
                      )}
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
