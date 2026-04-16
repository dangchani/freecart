import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Search,
  Trash2,
  ChevronDown,
  ChevronUp,
  MapPin,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface AddressRow {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  name: string;
  recipientName: string;
  recipientPhone: string;
  postalCode: string;
  address1: string;
  address2: string | null;
  isDefault: boolean;
  createdAt: string;
}

const PAGE_SIZE = 20;

export default function AdminAddressesPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [addresses, setAddresses] = useState<AddressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [committedSearch, setCommittedSearch] = useState('');

  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) { navigate('/auth/login'); return; }
      loadAddresses();
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!authLoading && user) loadAddresses();
  }, [page, committedSearch]);

  async function loadAddresses() {
    try {
      setLoading(true);
      const supabase = createClient();

      let query = supabase
        .from('user_addresses')
        .select(`
          id, user_id, name, recipient_name, recipient_phone,
          postal_code, address1, address2, is_default, created_at,
          users!user_addresses_user_id_fkey(name, email)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (committedSearch) {
        query = query.or(
          `recipient_name.ilike.%${committedSearch}%,` +
          `address1.ilike.%${committedSearch}%,` +
          `name.ilike.%${committedSearch}%`
        );
      }

      const { data, error, count } = await query;
      if (error) throw error;

      setTotalCount(count ?? 0);
      setAddresses(
        (data ?? []).map((a: any) => ({
          id: a.id,
          userId: a.user_id,
          userName: a.users?.name ?? '—',
          userEmail: a.users?.email ?? '—',
          name: a.name,
          recipientName: a.recipient_name,
          recipientPhone: a.recipient_phone,
          postalCode: a.postal_code,
          address1: a.address1,
          address2: a.address2,
          isDefault: a.is_default,
          createdAt: a.created_at,
        }))
      );
    } catch (err) {
      console.error('배송지 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('이 배송지를 삭제하시겠습니까?')) return;
    setDeletingId(id);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('user_addresses').delete().eq('id', id);
      if (error) throw error;
      setAddresses((prev) => prev.filter((a) => a.id !== id));
      setTotalCount((prev) => prev - 1);
    } catch (err) {
      console.error('삭제 실패:', err);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setDeletingId(null);
    }
  }

  function handleSearch() {
    setCommittedSearch(searchQuery);
    setPage(0);
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  if (authLoading) return <div className="container py-8">로딩 중...</div>;

  return (
    <div className="container py-8">
      <Link to="/admin" className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="mr-1 h-4 w-4" />
        대시보드로 돌아가기
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">배송지 관리</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { loadAddresses(); }}>
            <RefreshCw className="mr-2 h-4 w-4" />새로고침
          </Button>
        </div>
      </div>

      {/* 검색 */}
      <Card className="mb-4 p-4">
        <div className="flex gap-2">
          <Input
            placeholder="수령인명, 배송지명, 주소 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            className="max-w-sm"
          />
          <Button onClick={handleSearch}>
            <Search className="mr-2 h-4 w-4" />검색
          </Button>
          {committedSearch && (
            <Button variant="ghost" onClick={() => { setSearchQuery(''); setCommittedSearch(''); setPage(0); }}>
              초기화
            </Button>
          )}
        </div>
      </Card>

      {/* 목록 */}
      {loading ? (
        <Card className="p-12 text-center text-gray-400">로딩 중...</Card>
      ) : addresses.length === 0 ? (
        <Card className="p-12 text-center">
          <MapPin className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-gray-500">등록된 배송지가 없습니다.</p>
        </Card>
      ) : (
        <Card>
          {/* 헤더 */}
          <div className="grid grid-cols-[2fr_2fr_2fr_3fr_1fr_1fr] gap-4 p-4 border-b bg-gray-50 text-xs font-semibold text-gray-500 text-center">
            <div>회원</div>
            <div>배송지명 / 수령인</div>
            <div>연락처</div>
            <div>주소</div>
            <div>기본여부</div>
            <div>관리</div>
          </div>

          <div className="divide-y">
            {addresses.map((addr) => {
              const isExpanded = expandedUserId === addr.userId;
              return (
                <div key={addr.id}>
                  <div className="grid grid-cols-[2fr_2fr_2fr_3fr_1fr_1fr] gap-4 p-4 items-center text-sm text-center hover:bg-gray-50">
                    {/* 회원 */}
                    <div>
                      <p className="font-medium truncate">{addr.userName}</p>
                      <p className="text-xs text-gray-400 truncate">{addr.userEmail}</p>
                      <button
                        type="button"
                        onClick={() => setExpandedUserId(isExpanded ? null : addr.userId)}
                        className="mt-1 inline-flex items-center gap-0.5 text-xs text-blue-500 hover:underline"
                      >
                        {isExpanded ? (
                          <><ChevronUp className="h-3 w-3" />접기</>
                        ) : (
                          <><ChevronDown className="h-3 w-3" />이 회원 전체 보기</>
                        )}
                      </button>
                    </div>

                    {/* 배송지명 / 수령인 */}
                    <div>
                      <p className="font-medium">{addr.name}</p>
                      <p className="text-xs text-gray-500">{addr.recipientName}</p>
                    </div>

                    {/* 연락처 */}
                    <div className="text-gray-700">{addr.recipientPhone}</div>

                    {/* 주소 */}
                    <div className="text-left">
                      <p className="text-xs text-gray-600">
                        [{addr.postalCode}] {addr.address1}
                      </p>
                      {addr.address2 && (
                        <p className="text-xs text-gray-400">{addr.address2}</p>
                      )}
                    </div>

                    {/* 기본여부 */}
                    <div className="flex justify-center">
                      {addr.isDefault ? (
                        <Badge variant="default" className="text-xs">기본</Badge>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </div>

                    {/* 관리 */}
                    <div className="flex justify-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={deletingId === addr.id}
                        onClick={() => handleDelete(addr.id)}
                        className="text-gray-400 hover:text-red-600"
                        title="삭제"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* 같은 회원의 전체 배송지 인라인 확장 */}
                  {isExpanded && (
                    <UserAddressesExpanded
                      userId={addr.userId}
                      onDelete={(id) => {
                        setAddresses((prev) => prev.filter((a) => a.id !== id));
                        setTotalCount((c) => c - 1);
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            const p = page < 4 ? i : page - 3 + i;
            if (p >= totalPages) return null;
            return (
              <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm" onClick={() => setPage(p)}>
                {p + 1}
              </Button>
            );
          })}
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-500 ml-2">총 {totalCount}건</span>
        </div>
      )}
    </div>
  );
}

// 특정 회원의 전체 배송지를 인라인 확장으로 보여주는 서브 컴포넌트
function UserAddressesExpanded({
  userId,
  onDelete,
}: {
  userId: string;
  onDelete: (id: string) => void;
}) {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('user_addresses')
      .select('id, name, recipient_name, recipient_phone, postal_code, address1, address2, is_default, created_at')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data }) => { setList(data ?? []); setLoading(false); });
  }, [userId]);

  async function handleDelete(id: string) {
    if (!confirm('이 배송지를 삭제하시겠습니까?')) return;
    setDeletingId(id);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('user_addresses').delete().eq('id', id);
      if (error) throw error;
      setList((prev) => prev.filter((a) => a.id !== id));
      onDelete(id);
    } catch {
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return <div className="px-8 py-4 text-sm text-gray-400 bg-blue-50">불러오는 중...</div>;

  return (
    <div className="bg-blue-50 border-t border-blue-100">
      <div className="px-6 py-2 text-xs font-semibold text-blue-600">이 회원의 전체 배송지 ({list.length}개)</div>
      <div className="divide-y divide-blue-100">
        {list.map((addr) => (
          <div key={addr.id} className="flex items-center justify-between px-6 py-3 text-sm">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex-shrink-0">
                {addr.is_default
                  ? <Badge variant="default" className="text-xs">기본</Badge>
                  : <span className="inline-block w-10" />}
              </div>
              <div className="min-w-0">
                <span className="font-medium mr-2">{addr.name}</span>
                <span className="text-gray-500 mr-2">{addr.recipient_name}</span>
                <span className="text-gray-400 mr-3">{addr.recipient_phone}</span>
                <span className="text-gray-600">
                  [{addr.postal_code}] {addr.address1}{addr.address2 ? `, ${addr.address2}` : ''}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-xs text-gray-400">
                {format(new Date(addr.created_at), 'yyyy-MM-dd')}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={deletingId === addr.id}
                onClick={() => handleDelete(addr.id)}
                className="text-gray-400 hover:text-red-600 h-7 w-7 p-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
        {list.length === 0 && (
          <div className="px-6 py-3 text-sm text-gray-400">배송지가 없습니다.</div>
        )}
      </div>
    </div>
  );
}
