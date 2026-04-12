import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Package, CreditCard, Truck, CheckCircle, XCircle, Star, Gift, Megaphone } from 'lucide-react';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  type Notification,
  type NotificationType,
} from '@/services/notification';

const POLL_INTERVAL = 30_000;

function NotifIcon({ type }: { type: NotificationType }) {
  const cls = 'h-4 w-4 shrink-0';
  switch (type) {
    case 'order_placed':
    case 'order_paid':
      return <CreditCard className={cls} />;
    case 'order_shipped':
    case 'order_delivered':
      return <Truck className={cls} />;
    case 'order_cancelled':
      return <XCircle className={cls} />;
    case 'refund_approved':
    case 'refund_completed':
      return <CheckCircle className={cls} />;
    case 'point_earned':
    case 'point_expiring':
      return <Star className={cls} />;
    case 'coupon_received':
    case 'coupon_expiring':
      return <Gift className={cls} />;
    default:
      return <Megaphone className={cls} />;
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

interface Props {
  userId: string;
}

export function NotificationBell({ userId }: Props) {
  const [open, setOpen]               = useState(false);
  const [items, setItems]             = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const { notifications, unreadCount: cnt } = await getNotifications(userId, 10, 0);
    setItems(notifications);
    setUnreadCount(cnt);
  }, [userId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [load]);

  // 외부 클릭 닫기
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleMarkRead(id: string) {
    await markAsRead(id, userId);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function handleMarkAll() {
    await markAllAsRead(userId);
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 transition-colors"
        title="알림"
        aria-label={`알림 ${unreadCount > 0 ? `(${unreadCount}개 미확인)` : ''}`}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border bg-white shadow-xl z-50 overflow-hidden">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="text-sm font-semibold text-gray-900">알림</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAll}
                className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
              >
                모두 읽음
              </button>
            )}
          </div>

          {/* 목록 */}
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <Bell className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">알림이 없습니다</p>
              </div>
            ) : (
              items.map((n) => {
                const inner = (
                  <div
                    className={`flex gap-3 px-4 py-3 transition-colors hover:bg-gray-50 ${!n.isRead ? 'bg-blue-50/40' : ''}`}
                    onClick={() => { if (!n.isRead) handleMarkRead(n.id); setOpen(false); }}
                  >
                    <div className={`mt-0.5 ${!n.isRead ? 'text-blue-500' : 'text-gray-400'}`}>
                      <NotifIcon type={n.type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug truncate ${!n.isRead ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[11px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.isRead && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                    )}
                  </div>
                );

                return n.link ? (
                  <Link key={n.id} to={n.link} className="block cursor-pointer">
                    {inner}
                  </Link>
                ) : (
                  <div key={n.id} className="cursor-pointer">
                    {inner}
                  </div>
                );
              })
            )}
          </div>

          {/* 푸터 */}
          <div className="border-t px-4 py-2.5">
            <Link
              to="/mypage/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              모든 알림 보기
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
