import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import {
  Search,
  Plus,
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Settings2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getSystemSetting } from '@/lib/permissions';
import { useAuth } from '@/hooks/useAuth';
import {
  extractCustomValue,
  formatSignupFieldValue,
  getSortableValue,
  type SignupFieldDef,
} from '@/lib/signup-field-format';

interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  level: string;
  points: number;
  createdAt: string;
  isBlocked: boolean;
  // storage=users 인 커스텀 필드의 원시값 저장소
  userCols: Record<string, unknown>;
  // storage=custom 인 필드의 원시값 저장소 (field_key → value)
  customVals: Record<string, unknown>;
}

const PAGE_SIZE_OPTIONS = [20, 50, 100, 300] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

const LS_KEY_COLUMNS = 'freecart.admin.users.visibleColumns';
const LS_KEY_PAGE_SIZE = 'freecart.admin.users.pageSize';

// 회원가입 필드 중 기본 고정 헤더(이름/이메일/전화번호)와 중복되는 건 제외
const EXCLUDED_FIELD_KEYS = new Set(['email', 'password', 'name', 'phone']);

// 정렬 키: 기본(서버 정렬) 키는 고정 매핑
const CORE_SORT_MAP: Record<string, string> = {
  name: 'name',
  email: 'email',
  phone: 'phone',
  created_at: 'created_at',
  is_blocked: 'is_blocked',
  points: 'points',
};

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [myInfo, setMyInfo] = useState<UserRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [useLevels, setUseLevels] = useState(true);
  const [usePoints, setUsePoints] = useState(true);
  const [pointLabel, setPointLabel] = useState('포인트');

  // 정렬
  const [sortKey, setSortKey] = useState<string>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // 페이지네이션
  const [pageSize, setPageSize] = useState<PageSize>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY_PAGE_SIZE);
      const n = raw ? Number(raw) : 100;
      return (PAGE_SIZE_OPTIONS as readonly number[]).includes(n) ? (n as PageSize) : 100;
    } catch {
      return 100;
    }
  });
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // 커스텀 컬럼 정의/표시 설정
  const [availableFields, setAvailableFields] = useState<SignupFieldDef[]>([]);
  const [visibleFieldKeys, setVisibleFieldKeys] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY_COLUMNS);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);

  // 회원 추가 모달
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState('');

  // 커스텀 컬럼 정의 로드 + 시스템 설정
  useEffect(() => {
    (async () => {
      const [ul, up, pl] = await Promise.all([
        getSystemSetting<boolean>('use_user_levels'),
        getSystemSetting<boolean>('use_points'),
        getSystemSetting<string>('point_label'),
      ]);
      setUseLevels(ul !== false);
      setUsePoints(up !== false);
      if (typeof pl === 'string' && pl) setPointLabel(pl);

      const supabase = createClient();
      const { data } = await supabase
        .from('signup_field_definitions')
        .select('id, field_key, label, field_type, sort_order, storage_target, storage_column, is_active, options')
        .eq('is_active', true)
        .order('sort_order');
      const defs = ((data as SignupFieldDef[]) ?? []).filter(
        (d) => !EXCLUDED_FIELD_KEYS.has(d.field_key) && d.storage_target !== 'auth',
      );
      setAvailableFields(defs);
    })();
  }, []);

  // 컬럼 설정 / 페이지 크기 localStorage 저장
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY_COLUMNS, JSON.stringify(visibleFieldKeys));
    } catch {}
  }, [visibleFieldKeys]);
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY_PAGE_SIZE, String(pageSize));
    } catch {}
  }, [pageSize]);

  // 바깥 클릭 시 컬럼 메뉴 닫기
  useEffect(() => {
    if (!showColumnMenu) return;
    function onClickOutside(e: MouseEvent) {
      if (!columnMenuRef.current?.contains(e.target as Node)) setShowColumnMenu(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [showColumnMenu]);

  // 선택된 커스텀 필드 정의들
  const selectedFields = useMemo(
    () => availableFields.filter((f) => visibleFieldKeys.includes(f.field_key)),
    [availableFields, visibleFieldKeys],
  );

  // 서버에서 정렬 가능한지 판단
  function isServerSortable(key: string): boolean {
    if (key in CORE_SORT_MAP) return true;
    const def = availableFields.find((f) => f.field_key === key);
    if (def && def.storage_target === 'users' && def.storage_column) return true;
    return false;
  }

  // 로드 트리거
  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id, search, sortKey, sortDir, page, pageSize, visibleFieldKeys.join('|')]);

  // 검색/정렬/pageSize 변경 시 1페이지로
  useEffect(() => {
    setPage(1);
  }, [search, sortKey, sortDir, pageSize]);

  async function loadUsers() {
    try {
      setLoading(true);
      setError('');
      const supabase = createClient();
      const myId = authUser?.id;

      // 1) select 컬럼 동적 구성 (storage=users 인 선택 필드만 추가)
      const extraCols = selectedFields
        .filter((f) => f.storage_target === 'users' && f.storage_column)
        .map((f) => f.storage_column as string);
      const baseCols =
        'id, name, email, phone, points, is_blocked, created_at, level_id, user_levels(name)';
      const selectExpr = extraCols.length > 0 ? `${baseCols}, ${extraCols.join(', ')}` : baseCols;

      let query = supabase
        .from('users')
        .select(selectExpr, { count: 'exact' });

      if (myId) query = query.neq('id', myId);
      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
      }

      // 2) 정렬
      if (isServerSortable(sortKey)) {
        let col: string;
        if (sortKey in CORE_SORT_MAP) {
          col = CORE_SORT_MAP[sortKey];
        } else {
          // 커스텀 필드는 storage_column 으로 변환
          const def = availableFields.find((f) => f.field_key === sortKey);
          col = def?.storage_column ?? 'created_at';
        }
        query = query.order(col, { ascending: sortDir === 'asc' });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      // 3) range
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error: fetchError, count } = await query;
      if (fetchError) throw fetchError;

      setTotalCount(count ?? 0);

      // 4) custom 필드 값 일괄 조회
      const customDefs = selectedFields.filter((f) => f.storage_target === 'custom');
      const ids = (data ?? []).map((u: any) => u.id);
      const customByUser: Record<string, Record<string, unknown>> = {};
      if (customDefs.length > 0 && ids.length > 0) {
        const { data: valRows } = await supabase
          .from('user_field_values')
          .select(
            'user_id, field_definition_id, value_text, value_number, value_date, value_json, value_file_url',
          )
          .in('user_id', ids)
          .in(
            'field_definition_id',
            customDefs.map((d) => d.id),
          );
        for (const row of (valRows as any[]) ?? []) {
          const def = customDefs.find((d) => d.id === row.field_definition_id);
          if (!def) continue;
          if (!customByUser[row.user_id]) customByUser[row.user_id] = {};
          customByUser[row.user_id][def.field_key] = extractCustomValue(def, row);
        }
      }

      // 5) row 매핑
      let rows: UserRow[] = (data ?? []).map((u: any) => {
        const userCols: Record<string, unknown> = {};
        for (const col of extraCols) userCols[col] = u[col];
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone || '',
          level: (u.user_levels as any)?.name || '',
          points: u.points || 0,
          createdAt: u.created_at,
          isBlocked: u.is_blocked,
          userCols,
          customVals: customByUser[u.id] ?? {},
        };
      });

      // 6) custom 필드 정렬인 경우 현재 페이지 내에서만 클라이언트 정렬
      if (!isServerSortable(sortKey)) {
        const def = availableFields.find((f) => f.field_key === sortKey);
        if (def) {
          const mul = sortDir === 'asc' ? 1 : -1;
          rows = [...rows].sort((a, b) => {
            const av = getSortableValue(def, a.customVals[sortKey]);
            const bv = getSortableValue(def, b.customVals[sortKey]);
            if (av == null && bv == null) return 0;
            if (av == null) return 1;
            if (bv == null) return -1;
            if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mul;
            return String(av).localeCompare(String(bv), 'ko') * mul;
          });
        }
      }

      setUsers(rows);

      // 7) 본인 정보 별도 조회 (목록과 무관하게 항상 표시)
      if (myId && !myInfo) {
        const { data: me } = await supabase
          .from('users')
          .select('id, name, email, phone, points, is_blocked, created_at, level_id, user_levels(name)')
          .eq('id', myId)
          .maybeSingle();
        if (me) {
          setMyInfo({
            id: (me as any).id,
            name: (me as any).name,
            email: (me as any).email,
            phone: (me as any).phone || '',
            level: ((me as any).user_levels as any)?.name || '',
            points: (me as any).points || 0,
            createdAt: (me as any).created_at,
            isBlocked: (me as any).is_blocked,
            userCols: {},
            customVals: {},
          });
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '회원 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleBlock(userId: string, currentlyBlocked: boolean) {
    const action = currentlyBlocked ? '차단 해제' : '차단';
    if (!confirm(`해당 회원을 ${action}하시겠습니까?`)) return;
    try {
      const supabase = createClient();
      await supabase.from('users').update({ is_blocked: !currentlyBlocked }).eq('id', userId);
      await loadUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.');
    }
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    if (addForm.password.length < 8) {
      setAddError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    setAddSubmitting(true);
    setAddError('');
    try {
      const adminSupabase = createClient();
      const { error } = await adminSupabase.rpc('admin_create_user', {
        p_email: addForm.email,
        p_password: addForm.password,
        p_name: addForm.name,
        p_phone: addForm.phone || null,
      });
      if (error) throw error;
      alert(`${addForm.name}(${addForm.email}) 회원이 생성되었습니다.`);
      setAddForm({ name: '', email: '', password: '', phone: '' });
      setShowAddModal(false);
      await loadUsers();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : '회원 생성 중 오류가 발생했습니다.');
    } finally {
      setAddSubmitting(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
  }

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // created_at 만 기본 desc, 나머지는 asc 로 시작
      setSortDir(key === 'created_at' ? 'desc' : 'asc');
    }
  }

  function toggleFieldVisible(key: string) {
    setVisibleFieldKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  // 정렬 아이콘
  function SortIcon({ columnKey }: { columnKey: string }) {
    if (sortKey !== columnKey) return <ArrowUpDown className="ml-1 inline h-3 w-3 text-gray-300" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="ml-1 inline h-3 w-3 text-blue-600" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3 text-blue-600" />
    );
  }

  function sortableHeader(label: string, key: string) {
    return (
      <th
        className="px-4 py-3 font-medium text-gray-600 text-center cursor-pointer select-none hover:bg-gray-100 whitespace-nowrap"
        onClick={() => toggleSort(key)}
      >
        {label}
        <SortIcon columnKey={key} />
      </th>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">회원 관리</h1>
          <p className="text-sm text-gray-500 mt-1">총 {totalCount.toLocaleString()}명</p>
        </div>
        <div className="flex gap-2">
          {/* 컬럼 설정 */}
          <div className="relative" ref={columnMenuRef}>
            <Button variant="outline" onClick={() => setShowColumnMenu((v) => !v)}>
              <Settings2 className="mr-2 h-4 w-4" />
              컬럼 설정
            </Button>
            {showColumnMenu && (
              <div className="absolute right-0 z-30 mt-2 w-72 rounded-md border bg-white p-3 shadow-lg">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold">표시할 회원가입 필드</p>
                  <button
                    type="button"
                    onClick={() => setVisibleFieldKeys([])}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    전체 해제
                  </button>
                </div>
                {availableFields.length === 0 ? (
                  <p className="text-xs text-gray-400">선택 가능한 필드가 없습니다.</p>
                ) : (
                  <div className="max-h-72 space-y-1 overflow-y-auto">
                    {availableFields.map((f) => (
                      <label
                        key={f.field_key}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={visibleFieldKeys.includes(f.field_key)}
                          onChange={() => toggleFieldVisible(f.field_key)}
                        />
                        <span>{f.label}</span>
                        <span className="ml-auto text-xs text-gray-400">{f.field_type}</span>
                      </label>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-[11px] text-gray-400">
                  기본 컬럼(이름·이메일·전화번호·가입일·상태·관리)은 항상 표시됩니다.
                </p>
              </div>
            )}
          </div>
          <Button onClick={() => { setShowAddModal(true); setAddError(''); }}>
            <Plus className="mr-2 h-4 w-4" />
            회원 추가
          </Button>
        </div>
      </div>

      {/* 본인 정보 카드 */}
      {myInfo && (
        <Card
          className="mb-4 cursor-pointer p-5 transition-colors hover:bg-blue-50 border-blue-200"
          onClick={() => navigate(`/admin/users/${myInfo.id}`)}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-600">
                {myInfo.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold">{myInfo.name}</span>
                  <Badge className="bg-blue-100 text-blue-700 border-blue-200">내 계정</Badge>
                  <Badge variant={myInfo.isBlocked ? 'destructive' : 'default'}>
                    {myInfo.isBlocked ? '차단됨' : '정상'}
                  </Badge>
                </div>
                <div className="mt-1 text-sm text-gray-500">
                  {myInfo.email}
                  {myInfo.phone && <span className="ml-2">· {myInfo.phone}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-600">
              {useLevels && (
                <div className="text-right">
                  <div className="text-xs text-gray-400">등급</div>
                  <div className="font-medium">{myInfo.level || '-'}</div>
                </div>
              )}
              {usePoints && (
                <div className="text-right">
                  <div className="text-xs text-gray-400">{pointLabel}</div>
                  <div className="font-medium">{(myInfo.points || 0).toLocaleString()}P</div>
                </div>
              )}
              <div className="text-right">
                <div className="text-xs text-gray-400">가입일</div>
                <div className="font-medium">
                  {myInfo.createdAt ? format(new Date(myInfo.createdAt), 'yyyy.MM.dd') : '-'}
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* 검색/필터 */}
      <Card className="mb-6 p-4">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="이름, 이메일, 전화번호 검색"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full rounded-md border px-4 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Button type="submit">검색</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSearchInput('');
              setSearch('');
            }}
            disabled={!searchInput && !search}
          >
            초기화
          </Button>
        </form>
      </Card>

      {error && <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 bg-gray-200 animate-pulse rounded" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500 mb-3">회원이 없습니다.</p>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="mr-2 h-4 w-4" />첫 회원 추가
          </Button>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="w-[60px] px-2 py-3 font-medium text-gray-600 text-center whitespace-nowrap">
                    No.
                  </th>
                  {sortableHeader('이름', 'name')}
                  {sortableHeader('이메일', 'email')}
                  {sortableHeader('전화번호', 'phone')}
                  {useLevels && (
                    <th className="px-4 py-3 font-medium text-gray-600 text-center whitespace-nowrap">
                      등급
                    </th>
                  )}
                  {usePoints && sortableHeader(pointLabel, 'points')}
                  {selectedFields.map((f) => (
                    <th
                      key={f.field_key}
                      className="px-4 py-3 font-medium text-gray-600 text-center cursor-pointer select-none hover:bg-gray-100 whitespace-nowrap"
                      onClick={() => toggleSort(f.field_key)}
                      title={
                        isServerSortable(f.field_key)
                          ? ''
                          : '현재 페이지 내에서 정렬됩니다'
                      }
                    >
                      {f.label}
                      <SortIcon columnKey={f.field_key} />
                    </th>
                  ))}
                  {sortableHeader('가입일', 'created_at')}
                  <th
                    className="w-20 px-2 py-3 font-medium text-gray-600 text-center cursor-pointer select-none hover:bg-gray-100 whitespace-nowrap"
                    onClick={() => toggleSort('is_blocked')}
                  >
                    상태
                    <SortIcon columnKey="is_blocked" />
                  </th>
                  <th className="w-24 px-2 py-3 font-medium text-gray-600 text-center whitespace-nowrap">
                    관리
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u, idx) => (
                  <tr
                    key={u.id}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => navigate(`/admin/users/${u.id}`)}
                  >
                    <td className="w-[60px] px-2 py-3 text-center text-gray-500">
                      {(page - 1) * pageSize + idx + 1}
                    </td>
                    <td className="px-4 py-3 font-medium text-center truncate" title={u.name}>
                      {u.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-center truncate" title={u.email}>
                      {u.email}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-center truncate" title={u.phone || ''}>
                      {u.phone || '-'}
                    </td>
                    {useLevels && (
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline">{u.level || '-'}</Badge>
                      </td>
                    )}
                    {usePoints && (
                      <td className="px-4 py-3 text-center truncate">
                        {(u.points || 0).toLocaleString()}P
                      </td>
                    )}
                    {selectedFields.map((f) => {
                      const raw =
                        f.storage_target === 'users' && f.storage_column
                          ? u.userCols[f.storage_column]
                          : u.customVals[f.field_key];
                      const text = formatSignupFieldValue(f, raw);
                      return (
                        <td
                          key={f.field_key}
                          className="px-4 py-3 text-gray-600 text-center truncate"
                          title={text}
                        >
                          {text}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-gray-600 text-center truncate">
                      {u.createdAt ? format(new Date(u.createdAt), 'yyyy.MM.dd') : '-'}
                    </td>
                    <td className="w-20 px-2 py-3 text-center">
                      <Badge variant={u.isBlocked ? 'destructive' : 'default'}>
                        {u.isBlocked ? '차단됨' : '정상'}
                      </Badge>
                    </td>
                    <td className="w-24 px-2 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant={u.isBlocked ? 'outline' : 'destructive'}
                        onClick={() => handleToggleBlock(u.id, u.isBlocked)}
                      >
                        {u.isBlocked ? '차단 해제' : '차단'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 바 */}
          <div className="flex items-center justify-between gap-4 border-t px-4 py-3 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <span>페이지당</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value) as PageSize)}
                className="rounded-md border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span className="ml-3 text-gray-500">총 {totalCount.toLocaleString()}명</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded border p-1 disabled:opacity-40"
                disabled={page <= 1}
                onClick={() => setPage(1)}
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded border p-1 disabled:opacity-40"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-gray-600">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                className="rounded border p-1 disabled:opacity-40"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded border p-1 disabled:opacity-40"
                disabled={page >= totalPages}
                onClick={() => setPage(totalPages)}
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* 회원 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">회원 추가</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <Label htmlFor="add-name">이름 *</Label>
                <Input
                  id="add-name"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder="홍길동"
                  required
                />
              </div>
              <div>
                <Label htmlFor="add-email">이메일 *</Label>
                <Input
                  id="add-email"
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div>
                <Label htmlFor="add-password">초기 비밀번호 * (8자 이상)</Label>
                <Input
                  id="add-password"
                  type="password"
                  value={addForm.password}
                  onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                  placeholder="8자 이상"
                  minLength={8}
                  required
                />
              </div>
              <div>
                <Label htmlFor="add-phone">전화번호</Label>
                <Input
                  id="add-phone"
                  value={addForm.phone}
                  onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                  placeholder="01012345678"
                />
              </div>

              {addError && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{addError}</p>
              )}

              <p className="text-xs text-gray-400">
                * 회원이 즉시 생성되며 별도 이메일 인증 없이 바로 로그인 가능합니다.
              </p>

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={addSubmitting} className="flex-1">
                  {addSubmitting ? '생성 중...' : '회원 생성'}
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
