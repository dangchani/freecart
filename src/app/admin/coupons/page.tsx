import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { Plus, Edit, Trash2, X, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Coupon {
  id: string;
  name: string;
  code: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  usedCount: number;
  totalQuantity: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
}

function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const emptyForm = {
  name: '', code: '', description: '', discountType: 'percent' as 'percent' | 'fixed',
  discountValue: '', minOrderAmount: '', maxDiscountAmount: '', totalQuantity: '',
  startsAt: '', expiresAt: '', isActive: true,
};

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => { loadCoupons(); }, []);

  async function loadCoupons() {
    try {
      setLoading(true);
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from('coupons')
        .select('id, name, code, discount_type, discount_value, min_order_amount, max_discount_amount, used_count, total_quantity, starts_at, ends_at, is_active')
        .order('created_at', { ascending: false });
      if (fetchError) throw fetchError;
      setCoupons((data || []).map((c: any) => ({
        id: c.id, name: c.name, code: c.code || '',
        discountType: c.discount_type as 'percent' | 'fixed',
        discountValue: c.discount_value,
        minOrderAmount: c.min_order_amount || 0,
        maxDiscountAmount: c.max_discount_amount,
        usedCount: c.used_count || 0,
        totalQuantity: c.total_quantity,
        startsAt: c.starts_at,
        expiresAt: c.ends_at,
        isActive: c.is_active,
      })));
    } catch {
      setError('쿠폰 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, code: generateCode() });
    setFormError('');
    setShowModal(true);
  }

  function openEdit(coupon: Coupon) {
    setEditingId(coupon.id);
    setForm({
      name: coupon.name, code: coupon.code, description: '',
      discountType: coupon.discountType,
      discountValue: String(coupon.discountValue),
      minOrderAmount: String(coupon.minOrderAmount),
      maxDiscountAmount: coupon.maxDiscountAmount != null ? String(coupon.maxDiscountAmount) : '',
      totalQuantity: coupon.totalQuantity != null ? String(coupon.totalQuantity) : '',
      startsAt: coupon.startsAt ? coupon.startsAt.slice(0, 16) : '',
      expiresAt: coupon.expiresAt ? coupon.expiresAt.slice(0, 16) : '',
      isActive: coupon.isActive,
    });
    setFormError('');
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.discountValue || parseFloat(form.discountValue) <= 0) {
      setFormError('할인값을 입력해주세요.'); return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const supabase = createClient();
      const payload = {
        name: form.name,
        code: form.code,
        discount_type: form.discountType,
        discount_value: parseInt(form.discountValue),
        min_order_amount: parseInt(form.minOrderAmount) || 0,
        max_discount_amount: form.maxDiscountAmount ? parseInt(form.maxDiscountAmount) : null,
        total_quantity: form.totalQuantity ? parseInt(form.totalQuantity) : null,
        starts_at: form.startsAt || null,
        ends_at: form.expiresAt || null,
        is_active: form.isActive,
      };
      if (editingId) {
        const { error } = await supabase.from('coupons').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('coupons').insert(payload);
        if (error) throw error;
      }
      setShowModal(false);
      await loadCoupons();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" 쿠폰을 삭제하시겠습니까?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from('coupons').delete().eq('id', id);
    if (error) alert(error.message);
    else await loadCoupons();
  }

  async function handleToggleActive(id: string, current: boolean) {
    const supabase = createClient();
    await supabase.from('coupons').update({ is_active: !current }).eq('id', id);
    await loadCoupons();
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">쿠폰 관리</h1>
          <p className="text-sm text-gray-500 mt-1">할인 쿠폰을 생성하고 관리합니다.</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />쿠폰 생성</Button>
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>}

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-200 animate-pulse rounded" />)}</div>
      ) : coupons.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="mb-4 text-gray-500">등록된 쿠폰이 없습니다.</p>
          <Button onClick={openCreate}>첫 쿠폰 생성하기</Button>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">이름</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">코드</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">할인</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">최소주문</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">사용/총량</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">유효기간</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">상태</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {coupons.map((coupon) => (
                  <tr key={coupon.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{coupon.name}</td>
                    <td className="px-4 py-3">
                      <code className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs">{coupon.code}</code>
                    </td>
                    <td className="px-4 py-3">
                      {coupon.discountType === 'percent' ? `${coupon.discountValue}%` : formatCurrency(coupon.discountValue)}
                      {coupon.maxDiscountAmount && (
                        <span className="text-xs text-gray-400 ml-1">(최대 {formatCurrency(coupon.maxDiscountAmount)})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {coupon.minOrderAmount > 0 ? formatCurrency(coupon.minOrderAmount) : '-'}
                    </td>
                    <td className="px-4 py-3">{coupon.usedCount} / {coupon.totalQuantity ?? '∞'}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {coupon.expiresAt ? format(new Date(coupon.expiresAt), 'yyyy.MM.dd') : '무기한'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={coupon.isActive ? 'default' : 'secondary'}>
                        {coupon.isActive ? '활성' : '비활성'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-1">
                        <Button size="sm" variant="outline" onClick={() => handleToggleActive(coupon.id, coupon.isActive)}>
                          {coupon.isActive ? '비활성화' : '활성화'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEdit(coupon)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(coupon.id, coupon.name)}>
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 쿠폰 생성/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">{editingId ? '쿠폰 수정' : '쿠폰 생성'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">쿠폰명 *</label>
                <input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required
                  placeholder="봄 할인 쿠폰"
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">쿠폰 코드 *</label>
                <div className="flex gap-2">
                  <input value={form.code} onChange={(e) => setForm({...form, code: e.target.value.toUpperCase()})} required
                    className="flex-1 rounded-md border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <Button type="button" variant="outline" size="sm" onClick={() => setForm({...form, code: generateCode()})}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">할인 유형 *</label>
                  <select value={form.discountType} onChange={(e) => setForm({...form, discountType: e.target.value as 'percent' | 'fixed'})}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="percent">퍼센트 (%)</option>
                    <option value="fixed">금액 (원)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    할인값 * {form.discountType === 'percent' ? '(%)' : '(원)'}
                  </label>
                  <input type="number" value={form.discountValue} onChange={(e) => setForm({...form, discountValue: e.target.value})} required
                    min="1" max={form.discountType === 'percent' ? '100' : undefined}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">최소 주문금액 (원)</label>
                  <input type="number" value={form.minOrderAmount} onChange={(e) => setForm({...form, minOrderAmount: e.target.value})}
                    placeholder="0 (제한없음)"
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">최대 할인금액 (원)</label>
                  <input type="number" value={form.maxDiscountAmount} onChange={(e) => setForm({...form, maxDiscountAmount: e.target.value})}
                    placeholder="비워두면 제한없음"
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">발급 수량</label>
                <input type="number" value={form.totalQuantity} onChange={(e) => setForm({...form, totalQuantity: e.target.value})}
                  placeholder="비워두면 무제한"
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">시작일</label>
                  <input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({...form, startsAt: e.target.value})}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <p className="mt-0.5 text-xs text-gray-400">비워두면 즉시 적용</p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">만료일</label>
                  <input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({...form, expiresAt: e.target.value})}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <p className="mt-0.5 text-xs text-gray-400">비워두면 무기한</p>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({...form, isActive: e.target.checked})} className="rounded" />
                <span className="text-sm font-medium">즉시 활성화</span>
              </label>

              {formError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</p>}

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? '저장 중...' : editingId ? '수정' : '생성'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>취소</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
