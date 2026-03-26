import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/utils';
import { Truck, Plus, Pencil, Trash2, Save, X, MapPin, Building } from 'lucide-react';

interface ShippingSetting {
  id: string;
  name: string;
  type: 'fixed' | 'free' | 'weight';
  baseFee: number;
  freeThreshold: number | null;
  weightRates: { maxWeight: number; fee: number }[] | null;
  isDefault: boolean;
}

interface ShippingZone {
  id: string;
  name: string;
  postalCodes: string[];
  additionalFee: number;
  isActive: boolean;
}

interface ShippingCompany {
  id: string;
  name: string;
  code: string;
  trackingUrl: string | null;
  isActive: boolean;
  sortOrder: number;
}

export default function AdminShippingSettingsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);

  // 배송비 설정
  const [settings, setSettings] = useState<ShippingSetting[]>([]);
  const [editingSetting, setEditingSetting] = useState<Partial<ShippingSetting> | null>(null);
  const [savingSetting, setSavingSetting] = useState(false);

  // 지역별 추가배송비
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [editingZone, setEditingZone] = useState<Partial<ShippingZone> | null>(null);
  const [savingZone, setSavingZone] = useState(false);

  // 배송사 목록
  const [companies, setCompanies] = useState<ShippingCompany[]>([]);
  const [editingCompany, setEditingCompany] = useState<Partial<ShippingCompany> | null>(null);
  const [savingCompany, setSavingCompany] = useState(false);

  const [activeTab, setActiveTab] = useState<'settings' | 'zones' | 'companies'>('settings');

  useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== 'admin') {
        navigate('/');
        return;
      }
      loadData();
    }
  }, [user, authLoading, navigate]);

  async function loadData() {
    const supabase = createClient();

    try {
      const [settingsRes, zonesRes, companiesRes] = await Promise.all([
        supabase.from('shipping_settings').select('*').order('created_at'),
        supabase.from('shipping_zones').select('*').order('created_at'),
        supabase.from('shipping_companies').select('*').order('sort_order'),
      ]);

      setSettings(
        (settingsRes.data || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          type: s.type,
          baseFee: s.base_fee,
          freeThreshold: s.free_threshold,
          weightRates: s.weight_rates,
          isDefault: s.is_default,
        }))
      );

      setZones(
        (zonesRes.data || []).map((z: any) => ({
          id: z.id,
          name: z.name,
          postalCodes: z.postal_codes || [],
          additionalFee: z.additional_fee,
          isActive: z.is_active,
        }))
      );

      setCompanies(
        (companiesRes.data || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          code: c.code,
          trackingUrl: c.tracking_url,
          isActive: c.is_active,
          sortOrder: c.sort_order,
        }))
      );
    } catch (error) {
      console.error('Failed to load shipping data:', error);
    } finally {
      setLoading(false);
    }
  }

  // 배송비 설정 저장
  async function saveSetting() {
    if (!editingSetting || !editingSetting.name) return;
    setSavingSetting(true);

    const supabase = createClient();

    try {
      const payload = {
        name: editingSetting.name,
        type: editingSetting.type || 'fixed',
        base_fee: editingSetting.baseFee || 0,
        free_threshold: editingSetting.freeThreshold || null,
        weight_rates: editingSetting.weightRates || null,
        is_default: editingSetting.isDefault || false,
      };

      if (editingSetting.isDefault) {
        await supabase.from('shipping_settings').update({ is_default: false }).eq('is_default', true);
      }

      if (editingSetting.id) {
        await supabase.from('shipping_settings').update(payload).eq('id', editingSetting.id);
      } else {
        await supabase.from('shipping_settings').insert(payload);
      }

      setEditingSetting(null);
      await loadData();
    } catch (error) {
      console.error('Failed to save setting:', error);
      alert('저장에 실패했습니다.');
    } finally {
      setSavingSetting(false);
    }
  }

  async function deleteSetting(id: string) {
    if (!confirm('이 배송비 설정을 삭제하시겠습니까?')) return;

    const supabase = createClient();
    await supabase.from('shipping_settings').delete().eq('id', id);
    await loadData();
  }

  // 지역별 추가배송비 저장
  async function saveZone() {
    if (!editingZone || !editingZone.name) return;
    setSavingZone(true);

    const supabase = createClient();

    try {
      const payload = {
        name: editingZone.name,
        postal_codes: editingZone.postalCodes || [],
        additional_fee: editingZone.additionalFee || 0,
        is_active: editingZone.isActive !== false,
      };

      if (editingZone.id) {
        await supabase.from('shipping_zones').update(payload).eq('id', editingZone.id);
      } else {
        await supabase.from('shipping_zones').insert(payload);
      }

      setEditingZone(null);
      await loadData();
    } catch (error) {
      console.error('Failed to save zone:', error);
      alert('저장에 실패했습니다.');
    } finally {
      setSavingZone(false);
    }
  }

  async function deleteZone(id: string) {
    if (!confirm('이 지역 설정을 삭제하시겠습니까?')) return;

    const supabase = createClient();
    await supabase.from('shipping_zones').delete().eq('id', id);
    await loadData();
  }

  // 배송사 저장
  async function saveCompany() {
    if (!editingCompany || !editingCompany.name || !editingCompany.code) return;
    setSavingCompany(true);

    const supabase = createClient();

    try {
      const payload = {
        name: editingCompany.name,
        code: editingCompany.code,
        tracking_url: editingCompany.trackingUrl || null,
        is_active: editingCompany.isActive !== false,
        sort_order: editingCompany.sortOrder || 0,
      };

      if (editingCompany.id) {
        await supabase.from('shipping_companies').update(payload).eq('id', editingCompany.id);
      } else {
        await supabase.from('shipping_companies').insert(payload);
      }

      setEditingCompany(null);
      await loadData();
    } catch (error) {
      console.error('Failed to save company:', error);
      alert('저장에 실패했습니다.');
    } finally {
      setSavingCompany(false);
    }
  }

  async function deleteCompany(id: string) {
    if (!confirm('이 배송사를 삭제하시겠습니까?')) return;

    const supabase = createClient();
    await supabase.from('shipping_companies').delete().eq('id', id);
    await loadData();
  }

  if (authLoading || loading) {
    return <div className="p-8 text-center text-gray-500">로딩 중...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Truck className="h-6 w-6" />
          배송 설정
        </h1>
      </div>

      {/* 탭 네비게이션 */}
      <div className="border-b">
        <nav className="flex gap-4">
          {[
            { key: 'settings', label: '배송비 설정', icon: Truck },
            { key: 'zones', label: '지역별 추가배송비', icon: MapPin },
            { key: 'companies', label: '배송사 관리', icon: Building },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* 배송비 설정 탭 */}
      {activeTab === 'settings' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setEditingSetting({ type: 'fixed', baseFee: 3000, isDefault: false })}>
              <Plus className="mr-1.5 h-4 w-4" />
              배송비 설정 추가
            </Button>
          </div>

          {editingSetting && (
            <Card className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold">{editingSetting.id ? '배송비 설정 수정' : '새 배송비 설정'}</h3>
                <button onClick={() => setEditingSetting(null)}>
                  <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>설정 이름</Label>
                  <Input
                    value={editingSetting.name || ''}
                    onChange={(e) => setEditingSetting({ ...editingSetting, name: e.target.value })}
                    placeholder="예: 기본 배송비"
                  />
                </div>
                <div>
                  <Label>배송비 유형</Label>
                  <select
                    value={editingSetting.type || 'fixed'}
                    onChange={(e) => setEditingSetting({ ...editingSetting, type: e.target.value as 'fixed' | 'free' | 'weight' })}
                    className="w-full rounded-md border px-3 py-2"
                  >
                    <option value="fixed">고정 배송비</option>
                    <option value="free">무료 배송</option>
                    <option value="weight">무게별 배송비</option>
                  </select>
                </div>
                {editingSetting.type !== 'free' && (
                  <div>
                    <Label>기본 배송비</Label>
                    <Input
                      type="number"
                      value={editingSetting.baseFee || 0}
                      onChange={(e) => setEditingSetting({ ...editingSetting, baseFee: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                )}
                <div>
                  <Label>무료배송 기준금액 (선택)</Label>
                  <Input
                    type="number"
                    value={editingSetting.freeThreshold || ''}
                    onChange={(e) => setEditingSetting({ ...editingSetting, freeThreshold: parseInt(e.target.value) || null })}
                    placeholder="예: 50000"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingSetting.isDefault || false}
                      onChange={(e) => setEditingSetting({ ...editingSetting, isDefault: e.target.checked })}
                      className="h-4 w-4 rounded"
                    />
                    <span className="text-sm">기본 배송비 설정으로 지정</span>
                  </label>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingSetting(null)}>취소</Button>
                <Button onClick={saveSetting} disabled={savingSetting}>
                  {savingSetting ? '저장 중...' : '저장'}
                </Button>
              </div>
            </Card>
          )}

          {settings.length === 0 ? (
            <Card className="p-12 text-center">
              <Truck className="mx-auto mb-4 h-12 w-12 text-gray-300" />
              <p className="text-gray-500">등록된 배송비 설정이 없습니다.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {settings.map((setting) => (
                <Card key={setting.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{setting.name}</span>
                        {setting.isDefault && (
                          <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">기본</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {setting.type === 'free' && '무료 배송'}
                        {setting.type === 'fixed' && `기본 ${formatCurrency(setting.baseFee)}`}
                        {setting.type === 'weight' && `무게별 배송비 (기본 ${formatCurrency(setting.baseFee)})`}
                        {setting.freeThreshold && ` · ${formatCurrency(setting.freeThreshold)} 이상 무료`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditingSetting(setting)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteSetting(setting.id)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 지역별 추가배송비 탭 */}
      {activeTab === 'zones' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setEditingZone({ postalCodes: [], additionalFee: 3000, isActive: true })}>
              <Plus className="mr-1.5 h-4 w-4" />
              지역 추가
            </Button>
          </div>

          {editingZone && (
            <Card className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold">{editingZone.id ? '지역 설정 수정' : '새 지역 추가'}</h3>
                <button onClick={() => setEditingZone(null)}>
                  <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <Label>지역명</Label>
                  <Input
                    value={editingZone.name || ''}
                    onChange={(e) => setEditingZone({ ...editingZone, name: e.target.value })}
                    placeholder="예: 제주도, 도서산간"
                  />
                </div>
                <div>
                  <Label>우편번호 (쉼표로 구분)</Label>
                  <Input
                    value={editingZone.postalCodes?.join(', ') || ''}
                    onChange={(e) => setEditingZone({
                      ...editingZone,
                      postalCodes: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    })}
                    placeholder="예: 63000, 63001, 63002 또는 630*"
                  />
                  <p className="mt-1 text-xs text-gray-500">* 를 사용하면 해당 접두사로 시작하는 모든 우편번호 포함</p>
                </div>
                <div>
                  <Label>추가 배송비</Label>
                  <Input
                    type="number"
                    value={editingZone.additionalFee || 0}
                    onChange={(e) => setEditingZone({ ...editingZone, additionalFee: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingZone.isActive !== false}
                    onChange={(e) => setEditingZone({ ...editingZone, isActive: e.target.checked })}
                    className="h-4 w-4 rounded"
                  />
                  <span className="text-sm">활성화</span>
                </label>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingZone(null)}>취소</Button>
                <Button onClick={saveZone} disabled={savingZone}>
                  {savingZone ? '저장 중...' : '저장'}
                </Button>
              </div>
            </Card>
          )}

          {zones.length === 0 ? (
            <Card className="p-12 text-center">
              <MapPin className="mx-auto mb-4 h-12 w-12 text-gray-300" />
              <p className="text-gray-500">등록된 지역 설정이 없습니다.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {zones.map((zone) => (
                <Card key={zone.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{zone.name}</span>
                        {!zone.isActive && (
                          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">비활성</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        추가 배송비: {formatCurrency(zone.additionalFee)}
                      </p>
                      <p className="text-xs text-gray-400">
                        우편번호: {zone.postalCodes.slice(0, 5).join(', ')}{zone.postalCodes.length > 5 ? ` 외 ${zone.postalCodes.length - 5}개` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditingZone(zone)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteZone(zone.id)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 배송사 관리 탭 */}
      {activeTab === 'companies' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setEditingCompany({ isActive: true, sortOrder: 0 })}>
              <Plus className="mr-1.5 h-4 w-4" />
              배송사 추가
            </Button>
          </div>

          {editingCompany && (
            <Card className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold">{editingCompany.id ? '배송사 수정' : '새 배송사'}</h3>
                <button onClick={() => setEditingCompany(null)}>
                  <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>배송사명</Label>
                  <Input
                    value={editingCompany.name || ''}
                    onChange={(e) => setEditingCompany({ ...editingCompany, name: e.target.value })}
                    placeholder="예: CJ대한통운"
                  />
                </div>
                <div>
                  <Label>코드</Label>
                  <Input
                    value={editingCompany.code || ''}
                    onChange={(e) => setEditingCompany({ ...editingCompany, code: e.target.value })}
                    placeholder="예: cj"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>배송 추적 URL (선택)</Label>
                  <Input
                    value={editingCompany.trackingUrl || ''}
                    onChange={(e) => setEditingCompany({ ...editingCompany, trackingUrl: e.target.value })}
                    placeholder="예: https://trace.cjlogistics.com/next/tracking.html?wblNo={tracking_number}"
                  />
                  <p className="mt-1 text-xs text-gray-500">{'{tracking_number}'} 부분이 운송장 번호로 치환됩니다.</p>
                </div>
                <div>
                  <Label>정렬 순서</Label>
                  <Input
                    type="number"
                    value={editingCompany.sortOrder || 0}
                    onChange={(e) => setEditingCompany({ ...editingCompany, sortOrder: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingCompany.isActive !== false}
                      onChange={(e) => setEditingCompany({ ...editingCompany, isActive: e.target.checked })}
                      className="h-4 w-4 rounded"
                    />
                    <span className="text-sm">활성화</span>
                  </label>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingCompany(null)}>취소</Button>
                <Button onClick={saveCompany} disabled={savingCompany}>
                  {savingCompany ? '저장 중...' : '저장'}
                </Button>
              </div>
            </Card>
          )}

          {companies.length === 0 ? (
            <Card className="p-12 text-center">
              <Building className="mx-auto mb-4 h-12 w-12 text-gray-300" />
              <p className="text-gray-500">등록된 배송사가 없습니다.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {companies.map((company) => (
                <Card key={company.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{company.name}</span>
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{company.code}</span>
                        {!company.isActive && (
                          <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-600">비활성</span>
                        )}
                      </div>
                      {company.trackingUrl && (
                        <p className="text-xs text-gray-400 truncate max-w-md">{company.trackingUrl}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditingCompany(company)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteCompany(company.id)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
