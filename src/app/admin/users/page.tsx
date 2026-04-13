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
  Download,
  KeyRound,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getSystemSetting } from '@/lib/permissions';
import { useAuth } from '@/hooks/useAuth';
import { DynamicSignupForm } from '@/components/signup-fields/DynamicSignupForm';
import {
  extractCustomValue,
  formatSignupFieldValue,
  getSortableValue,
  type SignupFieldDef,
} from '@/lib/signup-field-format';

interface UserRow {
  id: string;
  loginId: string;
  name: string;
  email: string;
  phone: string;
  level: string;
  points: number;
  createdAt: string;
  isBlocked: boolean;
  role: string;
  // storage=users 인 커스텀 필드의 원시값 저장소
  userCols: Record<string, unknown>;
  // storage=custom 인 필드의 원시값 저장소 (field_key → value)
  customVals: Record<string, unknown>;
}

interface TagRow {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  created_by: string | null;
  memberCount?: number;
}

const PAGE_SIZE_OPTIONS = [20, 50, 100, 300] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

const LS_KEY_COLUMNS = 'freecart.admin.users.visibleColumns';
const LS_KEY_PAGE_SIZE = 'freecart.admin.users.pageSize';

// 회원가입 필드 중 기본 고정 헤더(아이디/이름/이메일/전화번호)와 중복되는 건 제외
const EXCLUDED_FIELD_KEYS = new Set(['email', 'password', 'name', 'phone', 'login_id']);

// 정렬 키: 기본(서버 정렬) 키는 고정 매핑
const CORE_SORT_MAP: Record<string, string> = {
  login_id: 'login_id',
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
  const [enableUserTags, setEnableUserTags] = useState(false);

  // 태그 관련 상태
  const [activeTab, setActiveTab] = useState<'users' | 'tags'>('users');
  const [tags, setTags] = useState<TagRow[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [userTagsMap, setUserTagsMap] = useState<Record<string, string[]>>({}); // userId → tagId[]
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  // 태그 관리 패널
  const [showTagPanel, setShowTagPanel] = useState(false);
  const [tagForm, setTagForm] = useState({ name: '', color: '#6366f1' });
  const [tagSubmitting, setTagSubmitting] = useState(false);
  const [tagError, setTagError] = useState('');
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editTagForm, setEditTagForm] = useState({ name: '', color: '#6366f1' });

  // 일괄 태그
  const [bulkTagId, setBulkTagId] = useState<string>('');
  const [bulkAction, setBulkAction] = useState<'add' | 'remove'>('add');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // 행 태그 팝오버
  const [popoverUserId, setPopoverUserId] = useState<string | null>(null);
  const [popoverTagLoading, setPopoverTagLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

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

  // 엑셀 내보내기
  const [exporting, setExporting] = useState(false);

  // 임시 비밀번호 발급
  const [showTempPwModal, setShowTempPwModal] = useState(false);
  const [tempPwScope, setTempPwScope] = useState<'all' | 'selected'>('all');
  const [tempPwSendEmail, setTempPwSendEmail] = useState(true);
  const [tempPwIssuing, setTempPwIssuing] = useState(false);

  // 커스텀 컬럼 정의 로드 + 시스템 설정
  useEffect(() => {
    (async () => {
      const [ul, up, pl, eut] = await Promise.all([
        getSystemSetting<boolean>('use_user_levels'),
        getSystemSetting<boolean>('use_points'),
        getSystemSetting<string>('point_label'),
        getSystemSetting<boolean>('enable_user_tags'),
      ]);
      setUseLevels(ul !== false);
      setUsePoints(up !== false);
      if (typeof pl === 'string' && pl) setPointLabel(pl);
      setEnableUserTags(eut === true);

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

  // 팝오버 외부 클릭 닫기
  useEffect(() => {
    if (!popoverUserId) return;
    function onClickOutside(e: MouseEvent) {
      if (!popoverRef.current?.contains(e.target as Node)) setPopoverUserId(null);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [popoverUserId]);

  // 태그 목록 로드
  useEffect(() => {
    if (enableUserTags) loadTags();
  }, [enableUserTags]);

  async function loadTags() {
    const supabase = createClient();
    const { data } = await supabase
      .from('user_tags')
      .select('id, name, color, sort_order, created_by, user_tag_members(count)')
      .order('sort_order');
    const rows: TagRow[] = ((data as any[]) ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      sort_order: t.sort_order,
      created_by: t.created_by,
      memberCount: t.user_tag_members?.[0]?.count ?? 0,
    }));
    setTags(rows);
  }

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
  }, [authUser?.id, search, sortKey, sortDir, page, pageSize, visibleFieldKeys.join('|'), selectedTagId]);

  // 검색/정렬/pageSize/태그 변경 시 1페이지로
  useEffect(() => {
    setPage(1);
  }, [search, sortKey, sortDir, pageSize, selectedTagId]);

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
        'id, login_id, name, email, phone, points, is_blocked, created_at, role, level_id, user_levels(name)';
      const selectExpr = extraCols.length > 0 ? `${baseCols}, ${extraCols.join(', ')}` : baseCols;

      // 태그 필터: 해당 태그에 속한 user_id 목록을 먼저 조회
      let tagFilterIds: string[] | null = null;
      if (selectedTagId) {
        const { data: tagMembers } = await supabase
          .from('user_tag_members')
          .select('user_id')
          .eq('tag_id', selectedTagId);
        tagFilterIds = (tagMembers ?? []).map((m: any) => m.user_id);
        if (tagFilterIds.length === 0) {
          setUsers([]);
          setTotalCount(0);
          setLoading(false);
          return;
        }
      }

      let query = supabase
        .from('users')
        .select(selectExpr, { count: 'exact' });

      if (myId) query = query.neq('id', myId);
      if (tagFilterIds) query = query.in('id', tagFilterIds);
      if (search) {
        query = query.or(`login_id.ilike.%${search}%,name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
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
          loginId: u.login_id || '',
          name: u.name,
          email: u.email,
          phone: u.phone || '',
          level: (u.user_levels as any)?.name || '',
          points: u.points || 0,
          createdAt: u.created_at,
          isBlocked: u.is_blocked,
          role: u.role || 'user',
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
      setSelectedUserIds(new Set());

      // 7) 태그 기능이 켜진 경우 user_tag_members 일괄 조회
      if (enableUserTags && ids.length > 0) {
        const { data: tagMemberRows } = await supabase
          .from('user_tag_members')
          .select('user_id, tag_id')
          .in('user_id', ids);
        const map: Record<string, string[]> = {};
        for (const row of (tagMemberRows as any[]) ?? []) {
          if (!map[row.user_id]) map[row.user_id] = [];
          map[row.user_id].push(row.tag_id);
        }
        setUserTagsMap(map);
      }

      // 8) 본인 정보 별도 조회 (목록과 무관하게 항상 표시)
      if (myId && !myInfo) {
        const { data: me } = await supabase
          .from('users')
          .select('id, login_id, name, email, phone, points, is_blocked, created_at, role, level_id, user_levels(name)')
          .eq('id', myId)
          .maybeSingle();
        if (me) {
          setMyInfo({
            id: (me as any).id,
            loginId: (me as any).login_id || '',
            name: (me as any).name,
            email: (me as any).email,
            phone: (me as any).phone || '',
            level: ((me as any).user_levels as any)?.name || '',
            points: (me as any).points || 0,
            createdAt: (me as any).created_at,
            isBlocked: (me as any).is_blocked,
            role: (me as any).role || 'user',
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

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
  }

  async function handleCreateTag(e: React.FormEvent) {
    e.preventDefault();
    if (!tagForm.name.trim()) return;
    setTagSubmitting(true);
    setTagError('');
    try {
      const supabase = createClient();
      const { data: { user: au } } = await supabase.auth.getUser();
      const { error } = await supabase.from('user_tags').insert({
        name: tagForm.name.trim(),
        color: tagForm.color,
        created_by: au?.id ?? null,
      });
      if (error) throw error;
      setTagForm({ name: '', color: '#6366f1' });
      await loadTags();
    } catch (err) {
      setTagError(err instanceof Error ? err.message : '태그 생성 중 오류가 발생했습니다.');
    } finally {
      setTagSubmitting(false);
    }
  }

  async function handleUpdateTag(id: string) {
    if (!editTagForm.name.trim()) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from('user_tags')
        .update({ name: editTagForm.name.trim(), color: editTagForm.color })
        .eq('id', id);
      if (error) throw error;
      setEditingTagId(null);
      await loadTags();
    } catch (err) {
      alert(err instanceof Error ? err.message : '태그 수정 중 오류가 발생했습니다.');
    }
  }

  async function handleDeleteTag(id: string, name: string) {
    if (!confirm(`"${name}" 태그를 삭제하시겠습니까? 해당 태그의 회원 연결도 모두 해제됩니다.`)) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from('user_tags').delete().eq('id', id);
      if (error) throw error;
      if (selectedTagId === id) setSelectedTagId(null);
      await loadTags();
    } catch (err) {
      alert(err instanceof Error ? err.message : '태그 삭제 중 오류가 발생했습니다.');
    }
  }

  async function handleBulkTag() {
    if (!bulkTagId || selectedUserIds.size === 0) return;
    // 관리자 제외
    const targetIds = Array.from(selectedUserIds).filter((uid) => {
      const u = users.find((r) => r.id === uid);
      return u && u.role === 'user';
    });
    if (targetIds.length === 0) {
      alert('선택된 회원 중 태그를 부여할 수 있는 사용자가 없습니다.\n관리자 계정은 태그를 부여할 수 없습니다.');
      return;
    }
    setBulkSubmitting(true);
    try {
      const supabase = createClient();
      if (bulkAction === 'add') {
        const { data: { user: au } } = await supabase.auth.getUser();
        const inserts = targetIds.map((uid) => ({
          tag_id: bulkTagId,
          user_id: uid,
          added_by: au?.id ?? null,
        }));
        const { error } = await supabase.from('user_tag_members').upsert(inserts, { onConflict: 'tag_id,user_id' });
        if (error) throw error;
      } else {
        for (const uid of targetIds) {
          await supabase.from('user_tag_members').delete().eq('tag_id', bulkTagId).eq('user_id', uid);
        }
      }
      setSelectedUserIds(new Set());
      await loadUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.');
    } finally {
      setBulkSubmitting(false);
    }
  }

  async function handlePopoverToggleTag(userId: string, tagId: string) {
    const supabase = createClient();
    const hasTag = (userTagsMap[userId] ?? []).includes(tagId);
    setPopoverTagLoading(true);
    try {
      if (hasTag) {
        await supabase.from('user_tag_members').delete().eq('tag_id', tagId).eq('user_id', userId);
        setUserTagsMap((prev) => ({ ...prev, [userId]: (prev[userId] ?? []).filter((id) => id !== tagId) }));
      } else {
        const { data: { user: au } } = await supabase.auth.getUser();
        await supabase.from('user_tag_members').insert({ tag_id: tagId, user_id: userId, added_by: au?.id ?? null });
        setUserTagsMap((prev) => ({ ...prev, [userId]: [...(prev[userId] ?? []), tagId] }));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.');
    } finally {
      setPopoverTagLoading(false);
    }
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
  function RoleBadge({ role }: { role: string }) {
    if (role === 'super_admin') return <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">슈퍼관리자</span>;
    if (role === 'admin') return <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">관리자</span>;
    return <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">사용자</span>;
  }

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

  async function handleIssueTempPasswords() {
    setTempPwIssuing(true);
    try {
      const supabase = createClient();
      const userIds = tempPwScope === 'selected' ? [...selectedUserIds] : undefined;

      const { data, error } = await supabase.functions.invoke('issue-temp-passwords', {
        body: { userIds, sendEmail: tempPwSendEmail },
      });

      if (error) throw new Error(error.message);
      if (!data?.ok) throw new Error(data?.error || '발급 실패');

      const results: { login_id: string; name: string; email: string; temp_password: string; email_sent: boolean; error?: string }[] = data.results;

      // CSV 생성 및 다운로드
      const headers = ['아이디', '이름', '이메일', '임시비밀번호', '이메일발송', '오류'];
      const rows = results.map((r) => [
        r.login_id, r.name, r.email, r.temp_password,
        r.email_sent ? '발송됨' : '미발송',
        r.error || '',
      ]);
      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      const bom = '\uFEFF';
      const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `temp_passwords_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      const successCount = results.filter((r) => !r.error).length;
      const failCount = results.filter((r) => !!r.error).length;
      alert(`완료: ${successCount}명 발급${failCount > 0 ? `, ${failCount}명 실패` : ''}\n\nCSV 파일이 다운로드되었습니다.\n⚠ 이 파일은 재다운로드할 수 없습니다. 안전하게 보관해주세요.`);
      setShowTempPwModal(false);
    } catch (err) {
      alert(`오류가 발생했습니다: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTempPwIssuing(false);
    }
  }

  async function handleExport() {
    try {
      setExporting(true);
      const supabase = createClient();

      const { data, error } = await supabase
        .from('users')
        .select(`
          id, login_id, name, email, phone, level, points,
          created_at, is_blocked, role,
          user_custom_fields(field_key, value)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 표시 중인 커스텀 필드 컬럼 추가
      const visibleFields = availableFields.filter((f) => visibleFieldKeys.includes(f.field_key));

      const headers = [
        '아이디', '이름', '이메일', '전화번호',
        ...(useLevels ? ['등급'] : []),
        ...(usePoints ? [pointLabel] : []),
        '가입일', '차단여부', '역할',
        ...visibleFields.map((f) => f.label),
      ];

      const rows = (data || []).map((u: any) => {
        const customMap: Record<string, unknown> = {};
        (u.user_custom_fields ?? []).forEach((cf: any) => {
          customMap[cf.field_key] = cf.value;
        });

        const row: unknown[] = [
          u.login_id || '',
          u.name || '',
          u.email || '',
          u.phone || '',
        ];
        if (useLevels) row.push(u.level || '');
        if (usePoints) row.push(u.points ?? 0);
        row.push(
          u.created_at ? format(new Date(u.created_at), 'yyyy-MM-dd HH:mm') : '',
          u.is_blocked ? '차단' : '정상',
          u.role || '',
        );
        visibleFields.forEach((f) => {
          const raw = customMap[f.field_key];
          row.push(raw !== undefined && raw !== null ? String(raw) : '');
        });
        return row;
      });

      const csvContent = [
        headers.join(','),
        ...rows.map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
        ),
      ].join('\n');

      const bom = '\uFEFF';
      const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `users_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export users:', err);
      alert('내보내기 중 오류가 발생했습니다.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">회원 관리</h1>
          <p className="text-sm text-gray-500 mt-1">총 {totalCount.toLocaleString()}명</p>
        </div>
        <div className="flex items-center gap-2">
          {enableUserTags && (
            <Button variant="outline" onClick={() => setShowTagPanel(true)}>
              태그 관리
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowTempPwModal(true)}>
            <KeyRound className="mr-2 h-4 w-4" />
            임시 비밀번호 발급
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            <Download className="mr-2 h-4 w-4" />
            {exporting ? '처리중...' : '내보내기'}
          </Button>
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
                  기본 컬럼(아이디·이름·이메일·전화번호·가입일·상태·관리)은 항상 표시됩니다.
                </p>
              </div>
            )}
          </div>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            회원 추가
          </Button>
        </div>
      </div>

      {/* 임시 비밀번호 발급 모달 */}
      {showTempPwModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">임시 비밀번호 일괄 발급</h2>
              <button type="button" onClick={() => setShowTempPwModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 발급 범위 */}
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">발급 대상</p>
                <div className="space-y-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="tempPwScope"
                      checked={tempPwScope === 'all'}
                      onChange={() => setTempPwScope('all')}
                    />
                    전체 회원 ({totalCount.toLocaleString()}명)
                  </label>
                  <label className={`flex cursor-pointer items-center gap-2 text-sm ${selectedUserIds.size === 0 ? 'opacity-40' : ''}`}>
                    <input
                      type="radio"
                      name="tempPwScope"
                      checked={tempPwScope === 'selected'}
                      onChange={() => setTempPwScope('selected')}
                      disabled={selectedUserIds.size === 0}
                    />
                    선택한 회원만 ({selectedUserIds.size}명)
                  </label>
                </div>
              </div>

              {/* 이메일 발송 */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">이메일로 발송</p>
                  <p className="text-xs text-gray-400">회원 이메일로 임시 비밀번호 안내 메일을 발송합니다.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setTempPwSendEmail((v) => !v)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                    tempPwSendEmail ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    tempPwSendEmail ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* 경고 */}
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 space-y-1">
                <p className="font-semibold">⚠ 주의사항</p>
                <p>• 발급 즉시 기존 비밀번호가 모두 변경됩니다.</p>
                <p>• 임시 비밀번호는 CSV 파일로 1회만 다운로드됩니다.</p>
                <p>• 파일을 닫으면 비밀번호를 다시 확인할 수 없습니다.</p>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowTempPwModal(false)} disabled={tempPwIssuing}>
                취소
              </Button>
              <Button
                className="flex-1"
                onClick={handleIssueTempPasswords}
                disabled={tempPwIssuing || (tempPwScope === 'selected' && selectedUserIds.size === 0)}
              >
                {tempPwIssuing ? '발급 중...' : '발급 + CSV 다운로드'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 태그 관리 슬라이드 패널 */}
      {enableUserTags && showTagPanel && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setShowTagPanel(false)} />
          <div className="fixed right-0 top-0 z-50 h-full w-96 bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-base font-semibold">태그 관리</h2>
              <button type="button" onClick={() => setShowTagPanel(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* 태그 생성 폼 */}
              <form onSubmit={handleCreateTag} className="space-y-3">
                <p className="text-sm font-medium text-gray-700">새 태그 만들기</p>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={tagForm.color}
                    onChange={(e) => setTagForm((p) => ({ ...p, color: e.target.value }))}
                    className="h-9 w-10 cursor-pointer rounded border px-0.5 py-0.5 flex-shrink-0"
                  />
                  <Input
                    value={tagForm.name}
                    onChange={(e) => setTagForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="태그 이름"
                    required
                    className="flex-1"
                  />
                  <Button type="submit" size="sm" disabled={tagSubmitting}>
                    {tagSubmitting ? '...' : '추가'}
                  </Button>
                </div>
                {tagError && <p className="text-xs text-red-600">{tagError}</p>}
              </form>

              <div className="border-t" />

              {/* 태그 목록 */}
              {tags.length === 0 ? (
                <p className="text-sm text-gray-400">생성된 태그가 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {tags.map((tag) => (
                    <div key={tag.id} className="flex items-center gap-2 rounded-lg border p-3">
                      {editingTagId === tag.id ? (
                        <>
                          <input
                            type="color"
                            value={editTagForm.color}
                            onChange={(e) => setEditTagForm((p) => ({ ...p, color: e.target.value }))}
                            className="h-8 w-9 cursor-pointer rounded border px-0.5 flex-shrink-0"
                          />
                          <Input
                            value={editTagForm.name}
                            onChange={(e) => setEditTagForm((p) => ({ ...p, name: e.target.value }))}
                            className="flex-1 h-8 text-sm"
                          />
                          <Button size="sm" className="h-8 px-2 text-xs" onClick={() => handleUpdateTag(tag.id)}>저장</Button>
                          <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => setEditingTagId(null)}>취소</Button>
                        </>
                      ) : (
                        <>
                          <span className="inline-block h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                          <span className="flex-1 text-sm font-medium">{tag.name}</span>
                          <span className="text-xs text-gray-400">{tag.memberCount ?? 0}명</span>
                          <button
                            type="button"
                            className="text-xs text-gray-500 hover:text-gray-700 px-1"
                            onClick={() => { setEditingTagId(tag.id); setEditTagForm({ name: tag.name, color: tag.color }); }}
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            className="text-xs text-red-500 hover:text-red-700 px-1"
                            onClick={() => handleDeleteTag(tag.id, tag.name)}
                          >
                            삭제
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* 본인 정보 카드 */}

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
              placeholder="아이디, 이름, 이메일, 전화번호 검색"
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
        {/* 태그 필터 칩 */}
        {enableUserTags && tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
            <button
              type="button"
              onClick={() => setSelectedTagId(null)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
                selectedTagId === null
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              전체
            </button>
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => setSelectedTagId(tag.id === selectedTagId ? null : tag.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
                  selectedTagId === tag.id
                    ? 'text-white border-transparent'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                }`}
                style={selectedTagId === tag.id ? { backgroundColor: tag.color, borderColor: tag.color } : {}}
              >
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: selectedTagId === tag.id ? 'rgba(255,255,255,0.7)' : tag.color }} />
                {tag.name}
                <span className={`text-xs ${selectedTagId === tag.id ? 'text-white/70' : 'text-gray-400'}`}>
                  {tag.memberCount ?? 0}
                </span>
              </button>
            ))}
          </div>
        )}
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
          {/* 일괄 태그 부여 바 */}
          {enableUserTags && selectedUserIds.size > 0 && (
            <div className="flex items-center gap-3 border-b px-4 py-3 bg-blue-50">
              <span className="text-sm font-medium text-blue-700">{selectedUserIds.size}명 선택됨</span>
              <select
                value={bulkTagId}
                onChange={(e) => setBulkTagId(e.target.value)}
                className="rounded-md border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">태그 선택</option>
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <div className="flex rounded-md border overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => setBulkAction('add')}
                  className={`px-2 py-1 ${bulkAction === 'add' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}
                >부여</button>
                <button
                  type="button"
                  onClick={() => setBulkAction('remove')}
                  className={`px-2 py-1 border-l ${bulkAction === 'remove' ? 'bg-red-500 text-white' : 'bg-white text-gray-600'}`}
                >제거</button>
              </div>
              <Button
                size="sm"
                variant={bulkAction === 'remove' ? 'destructive' : 'default'}
                disabled={!bulkTagId || bulkSubmitting}
                onClick={handleBulkTag}
              >
                {bulkSubmitting ? '처리 중...' : `태그 ${bulkAction === 'add' ? '부여' : '제거'}`}
              </Button>
              <button
                type="button"
                className="ml-auto text-xs text-gray-500 hover:text-gray-700"
                onClick={() => setSelectedUserIds(new Set())}
              >
                선택 해제
              </button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  {enableUserTags && (
                    <th className="w-10 px-2 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={users.length > 0 && selectedUserIds.size === users.length}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedUserIds(new Set(users.map((u) => u.id)));
                          else setSelectedUserIds(new Set());
                        }}
                      />
                    </th>
                  )}
                  <th className="w-[60px] px-2 py-3 font-medium text-gray-600 text-center whitespace-nowrap">
                    No.
                  </th>
                  {sortableHeader('아이디', 'login_id')}
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
                  {enableUserTags && (
                    <th className="px-4 py-3 font-medium text-gray-600 text-center whitespace-nowrap">역할</th>
                  )}
                  {enableUserTags && (
                    <th className="px-4 py-3 font-medium text-gray-600 text-center whitespace-nowrap">태그</th>
                  )}
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
                    {enableUserTags && (
                      <td className="w-10 px-2 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedUserIds.has(u.id)}
                          onChange={(e) => {
                            setSelectedUserIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(u.id);
                              else next.delete(u.id);
                              return next;
                            });
                          }}
                        />
                      </td>
                    )}
                    <td className="w-[60px] px-2 py-3 text-center text-gray-500">
                      {(page - 1) * pageSize + idx + 1}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-center truncate" title={u.loginId}>
                      {u.loginId || '-'}
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
                    {enableUserTags && (
                      <td className="px-4 py-3 text-center">
                        <RoleBadge role={u.role} />
                      </td>
                    )}
                    {enableUserTags && (
                      <td className="px-4 py-3 text-center relative" onClick={(e) => e.stopPropagation()}>
                        {u.role !== 'user' ? (
                          <span className="text-xs text-gray-300">-</span>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="inline-flex flex-wrap gap-1 justify-center items-center min-w-[2rem] min-h-[1.5rem] cursor-pointer hover:opacity-80"
                              onClick={() => setPopoverUserId(popoverUserId === u.id ? null : u.id)}
                              title="클릭하여 태그 수정"
                            >
                              {(userTagsMap[u.id] ?? []).length > 0
                                ? (userTagsMap[u.id] ?? []).map((tid) => {
                                    const tag = tags.find((t) => t.id === tid);
                                    if (!tag) return null;
                                    return (
                                      <span key={tid} className="inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: tag.color }}>
                                        {tag.name}
                                      </span>
                                    );
                                  })
                                : <span className="text-xs text-gray-300">+ 태그</span>
                              }
                            </button>
                            {popoverUserId === u.id && (
                              <div
                                ref={popoverRef}
                                className="absolute z-50 left-1/2 -translate-x-1/2 mt-1 w-44 rounded-lg border bg-white shadow-lg p-2 space-y-1"
                                style={{ top: '100%' }}
                              >
                                <p className="text-xs font-medium text-gray-500 px-1 pb-1 border-b">태그 선택</p>
                                {tags.length === 0 && <p className="text-xs text-gray-400 px-1">태그 없음</p>}
                                {tags.map((tag) => {
                                  const active = (userTagsMap[u.id] ?? []).includes(tag.id);
                                  return (
                                    <label key={tag.id} className="flex items-center gap-2 cursor-pointer rounded px-1 py-1 hover:bg-gray-50 text-sm">
                                      <input
                                        type="checkbox"
                                        checked={active}
                                        disabled={popoverTagLoading}
                                        onChange={() => handlePopoverToggleTag(u.id, tag.id)}
                                      />
                                      <span className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                                      <span className="truncate">{tag.name}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        )}
                      </td>
                    )}
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
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b px-6 py-4 flex-shrink-0">
              <h2 className="text-lg font-bold">회원 추가</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-6">
              <p className="mb-4 text-xs text-gray-400">회원이 즉시 생성되며 별도 이메일 인증 없이 바로 로그인 가능합니다.</p>
              <DynamicSignupForm
                adminMode
                onSuccess={async () => {
                  setShowAddModal(false);
                  await loadUsers();
                }}
              />
              <Button type="button" variant="outline" className="mt-3 w-full" onClick={() => setShowAddModal(false)}>
                취소
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
