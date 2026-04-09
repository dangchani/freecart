import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { DynamicField } from '@/components/signup-fields/DynamicField';
import type { FieldDefinition, FieldValue } from '@/components/signup-fields/types';

// 마이페이지에서 노출할 필드 (password는 별도 섹션)
const SKIP_KEYS = ['password'];

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [userData, setUserData] = useState<Record<string, unknown>>({});
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // 비밀번호 변경
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (!user) { navigate('/auth/login'); return; }
      load();
    }
  }, [user, authLoading]);

  async function load() {
    if (!user) return;
    const supabase = createClient();

    const [fieldsRes, userRes] = await Promise.all([
      supabase
        .from('signup_field_definitions')
        .select('*, terms(id, title, content)')
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single(),
    ]);

    const defs = (fieldsRes.data as FieldDefinition[] ?? []).filter(
      (f) => !SKIP_KEYS.includes(f.field_key)
    );
    setFields(defs);

    const ud = userRes.data ?? {};
    setUserData(ud);

    // 현재 값 초기화
    const initial: Record<string, FieldValue> = {};
    for (const f of defs) {
      if (f.field_key === 'email') {
        initial['email'] = user.email ?? '';
      } else if (f.storage_target === 'users' && f.storage_column) {
        initial[f.field_key] = (ud[f.storage_column] as FieldValue) ?? '';
      } else if (f.storage_target === 'users' && !f.storage_column) {
        initial[f.field_key] = (ud[f.field_key] as FieldValue) ?? '';
      }
    }
    setValues(initial);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaveError('');
    setSaving(true);

    try {
      const supabase = createClient();
      const usersUpdate: Record<string, unknown> = {};
      let emailChanged = false;
      let newEmail = '';

      for (const f of fields) {
        if (!f.is_editable) continue;
        const v = values[f.field_key];

        if (f.field_key === 'email') {
          const email = String(v ?? '').trim();
          if (email && email !== user.email) {
            emailChanged = true;
            newEmail = email;
          }
        } else if (f.storage_target === 'users') {
          const col = f.storage_column ?? f.field_key;
          usersUpdate[col] = v ?? null;
        }
      }

      // public.users 업데이트
      if (Object.keys(usersUpdate).length > 0) {
        const { error } = await supabase.from('users').update(usersUpdate).eq('id', user.id);
        if (error) throw error;
      }

      // 이메일 변경
      if (emailChanged) {
        const { error } = await supabase.auth.updateUser({ email: newEmail });
        if (error) throw error;
        await supabase.from('users').update({ email: newEmail }).eq('id', user.id);
      }

      // 저장 완료 → 강제 로그아웃
      await supabase.auth.signOut();
      alert('회원정보가 변경되어 재로그인이 필요합니다.');
      navigate('/auth/login');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    if (!newPw || newPw.length < 6) { setPwError('새 비밀번호는 6자 이상이어야 합니다.'); return; }
    if (newPw !== confirmPw) { setPwError('새 비밀번호가 일치하지 않습니다.'); return; }

    setPwLoading(true);
    try {
      const supabase = createClient();
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user!.email!,
        password: currentPw,
      });
      if (signInErr) { setPwError('현재 비밀번호가 올바르지 않습니다.'); return; }

      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;

      // 비밀번호 변경도 재로그인 필요
      await supabase.auth.signOut();
      alert('회원정보가 변경되어 재로그인이 필요합니다.');
      navigate('/auth/login');
    } catch (err) {
      setPwError(err instanceof Error ? err.message : '비밀번호 변경에 실패했습니다.');
    } finally {
      setPwLoading(false);
    }
  }

  if (authLoading) return <div className="container py-8">로딩 중...</div>;

  const editableFields = fields.filter((f) => f.is_editable);
  const readonlyFields = fields.filter((f) => !f.is_editable);

  return (
    <div className="container py-8">
      <Link to="/mypage" className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="mr-1 h-4 w-4" />
        마이페이지로 돌아가기
      </Link>

      <h1 className="mb-8 text-3xl font-bold">회원정보</h1>

      <div className="max-w-2xl space-y-6">

        {/* 변경 불가 필드 */}
        {readonlyFields.length > 0 && (
          <Card className="p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold">변경 불가 정보</h2>
              <p className="text-sm text-gray-500 mt-0.5">아래 정보는 고객센터를 통해 변경하실 수 있습니다.</p>
            </div>
            {readonlyFields.map((f) => (
              <div key={f.id}>
                <Label className="text-gray-500">{f.label}</Label>
                <div className="mt-1 rounded-md border bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  {String(values[f.field_key] ?? (userData[f.storage_column ?? f.field_key] as string) ?? '-')}
                </div>
              </div>
            ))}
          </Card>
        )}

        {/* 수정 가능 필드 */}
        {editableFields.length > 0 && (
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold">정보 수정</h2>
            <form onSubmit={handleSave} className="space-y-4">
              {editableFields.map((f) => (
                <DynamicField
                  key={f.id}
                  definition={f}
                  value={values[f.field_key] ?? null}
                  onChange={(v) => setValues((prev) => ({ ...prev, [f.field_key]: v }))}
                />
              ))}
              {saveError && <p className="text-sm text-red-600">{saveError}</p>}
              <Button type="submit" disabled={saving}>
                {saving ? '저장 중...' : '저장'}
              </Button>
            </form>
          </Card>
        )}

        {/* 비밀번호 변경 */}
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">비밀번호 변경</h2>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <Label htmlFor="currentPw">현재 비밀번호</Label>
              <Input id="currentPw" type="password" value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="newPw">새 비밀번호</Label>
              <Input id="newPw" type="password" value={newPw}
                onChange={(e) => setNewPw(e.target.value)} required placeholder="6자 이상" />
            </div>
            <div>
              <Label htmlFor="confirmPw">새 비밀번호 확인</Label>
              <Input id="confirmPw" type="password" value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)} required />
              {confirmPw.length > 0 && (
                newPw === confirmPw
                  ? <p className="mt-1 text-xs text-green-600">비밀번호가 일치합니다.</p>
                  : <p className="mt-1 text-xs text-red-500">비밀번호가 일치하지 않습니다.</p>
              )}
            </div>
            {pwError && <p className="text-sm text-red-600">{pwError}</p>}
            {pwSuccess && <p className="text-sm text-green-600">{pwSuccess}</p>}
            <Button type="submit" disabled={pwLoading}>
              {pwLoading ? '변경 중...' : '비밀번호 변경'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
