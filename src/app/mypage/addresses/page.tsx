import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Plus, Pencil, Trash2, X } from 'lucide-react';

interface Address {
  id: string;
  name: string;
  recipientName: string;
  recipientPhone: string;
  postalCode: string;
  address1: string;
  address2: string;
  isDefault: boolean;
}

interface AddressForm {
  name: string;
  recipientName: string;
  recipientPhone: string;
  postalCode: string;
  address1: string;
  address2: string;
  isDefault: boolean;
}

const emptyForm: AddressForm = {
  name: '',
  recipientName: '',
  recipientPhone: '',
  postalCode: '',
  address1: '',
  address2: '',
  isDefault: false,
};

export default function AddressesPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      fetchAddresses();
    }
  }, [user, authLoading, navigate]);

  async function fetchAddresses() {
    try {
      const res = await fetch('/api/users/me/addresses');
      const json = await res.json();
      if (json.success) setAddresses(json.data || []);
    } catch (err) {
      console.error('배송지 로딩 실패:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(address: Address) {
    setEditingId(address.id);
    setForm({
      name: address.name,
      recipientName: address.recipientName,
      recipientPhone: address.recipientPhone,
      postalCode: address.postalCode,
      address1: address.address1,
      address2: address.address2,
      isDefault: address.isDefault,
    });
    setShowForm(true);
  }

  function handleAddNew() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingId ? `/api/users/me/addresses/${editingId}` : '/api/users/me/addresses';
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        setShowForm(false);
        setEditingId(null);
        setForm(emptyForm);
        await fetchAddresses();
      } else {
        alert(json.error || '저장에 실패했습니다.');
      }
    } catch (err) {
      console.error('배송지 저장 실패:', err);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('배송지를 삭제하시겠습니까?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/users/me/addresses/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setAddresses((prev) => prev.filter((a) => a.id !== id));
      } else {
        alert(json.error || '삭제에 실패했습니다.');
      }
    } catch (err) {
      console.error('배송지 삭제 실패:', err);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setDeletingId(null);
    }
  }

  if (authLoading || loading) {
    return <div className="p-8 text-center text-gray-500">로딩 중...</div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">배송지 관리</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{addresses.length}/5 등록됨</span>
          {addresses.length < 5 && (
            <Button size="sm" onClick={handleAddNew}>
              <Plus className="mr-1.5 h-4 w-4" />
              배송지 추가
            </Button>
          )}
        </div>
      </div>

      {addresses.length >= 5 && (
        <div className="mb-4 rounded-md bg-yellow-50 px-4 py-2 text-sm text-yellow-700">
          배송지는 최대 5개까지 등록할 수 있습니다.
        </div>
      )}

      {/* 배송지 추가/수정 폼 */}
      {showForm && (
        <Card className="mb-6 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">{editingId ? '배송지 수정' : '새 배송지 추가'}</h2>
            <button onClick={() => setShowForm(false)}>
              <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">배송지명</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="예) 집, 회사"
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">수령인</label>
                <input
                  type="text"
                  required
                  value={form.recipientName}
                  onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
                  placeholder="수령인 이름"
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">연락처</label>
                <input
                  type="tel"
                  required
                  value={form.recipientPhone}
                  onChange={(e) => setForm({ ...form, recipientPhone: e.target.value })}
                  placeholder="010-0000-0000"
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">우편번호</label>
                <input
                  type="text"
                  required
                  value={form.postalCode}
                  onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                  placeholder="12345"
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">주소</label>
              <input
                type="text"
                required
                value={form.address1}
                onChange={(e) => setForm({ ...form, address1: e.target.value })}
                placeholder="기본 주소"
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">상세 주소</label>
              <input
                type="text"
                value={form.address2}
                onChange={(e) => setForm({ ...form, address2: e.target.value })}
                placeholder="상세 주소 (선택)"
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">기본 배송지로 설정</span>
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                취소
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? '저장 중...' : '저장하기'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* 배송지 목록 */}
      {addresses.length === 0 ? (
        <Card className="p-12 text-center">
          <MapPin className="mx-auto mb-4 h-12 w-12 text-gray-300" />
          <p className="mb-4 text-gray-500">등록된 배송지가 없습니다.</p>
          <Button onClick={handleAddNew}>
            <Plus className="mr-1.5 h-4 w-4" />
            배송지 추가
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {addresses.map((address) => (
            <Card key={address.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-semibold">{address.name}</span>
                    {address.isDefault && (
                      <Badge variant="default" className="text-xs">기본배송지</Badge>
                    )}
                  </div>
                  <p className="text-sm">{address.recipientName} · {address.recipientPhone}</p>
                  <p className="text-sm text-gray-600">
                    [{address.postalCode}] {address.address1}
                    {address.address2 && `, ${address.address2}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(address)}
                    className="text-gray-500 hover:text-blue-600"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(address.id)}
                    disabled={deletingId === address.id}
                    className="text-gray-500 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
