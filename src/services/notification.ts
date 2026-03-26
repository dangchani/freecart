import { createClient } from '@/lib/supabase/client';

export type NotificationType =
  | 'order_placed'
  | 'order_paid'
  | 'order_shipped'
  | 'order_delivered'
  | 'order_cancelled'
  | 'refund_approved'
  | 'refund_completed'
  | 'point_earned'
  | 'point_expiring'
  | 'coupon_received'
  | 'coupon_expiring'
  | 'review_reward'
  | 'stock_alert'
  | 'price_drop'
  | 'promotion'
  | 'system';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  imageUrl?: string;
  isRead: boolean;
  createdAt: string;
}

// 알림 목록 조회
export async function getNotifications(
  userId: string,
  limit: number = 20,
  offset: number = 0
): Promise<{ notifications: Notification[]; unreadCount: number; total: number }> {
  const supabase = createClient();

  const { data, error, count } = await supabase
    .from('notifications')
    .select('id, type, title, message, link, image_url, is_read, created_at', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return { notifications: [], unreadCount: 0, total: 0 };

  // 읽지 않은 알림 수
  const { count: unreadCount } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  return {
    notifications: (data || []).map((n: any) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      link: n.link,
      imageUrl: n.image_url,
      isRead: n.is_read,
      createdAt: n.created_at,
    })),
    unreadCount: unreadCount || 0,
    total: count || 0,
  };
}

// 알림 읽음 처리
export async function markAsRead(notificationId: string, userId: string): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userId);

  return !error;
}

// 모든 알림 읽음 처리
export async function markAllAsRead(userId: string): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  return !error;
}

// 알림 삭제
export async function deleteNotification(notificationId: string, userId: string): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId)
    .eq('user_id', userId);

  return !error;
}

// 알림 전송 (내부용)
export async function sendNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  options?: {
    link?: string;
    imageUrl?: string;
    sendEmail?: boolean;
    sendSms?: boolean;
    sendPush?: boolean;
  }
): Promise<boolean> {
  const supabase = createClient();

  // DB에 알림 저장
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    content: message,
    link_url: options?.link,
    is_read: false,
  });

  if (error) return false;

  // 이메일 발송
  if (options?.sendEmail) {
    await supabase.functions.invoke('send-email', {
      body: { userId, subject: title, content: message },
    });
  }

  // SMS 발송
  if (options?.sendSms) {
    await supabase.functions.invoke('send-sms', {
      body: { userId, message: `[프리카트] ${title}: ${message}` },
    });
  }

  // 푸시 알림
  if (options?.sendPush) {
    await supabase.functions.invoke('send-push', {
      body: { userId, title, body: message },
    });
  }

  return true;
}

// 알림 타입별 템플릿
export const NOTIFICATION_TEMPLATES: Record<NotificationType, { title: string; message: (data: any) => string }> = {
  order_placed: {
    title: '주문 완료',
    message: (data) => `주문번호 ${data.orderNumber}이 접수되었습니다.`,
  },
  order_paid: {
    title: '결제 완료',
    message: (data) => `주문번호 ${data.orderNumber}의 결제가 완료되었습니다.`,
  },
  order_shipped: {
    title: '배송 시작',
    message: (data) => `주문번호 ${data.orderNumber}이 배송 시작되었습니다. 운송장: ${data.trackingNumber}`,
  },
  order_delivered: {
    title: '배송 완료',
    message: (data) => `주문번호 ${data.orderNumber}이 배송 완료되었습니다.`,
  },
  order_cancelled: {
    title: '주문 취소',
    message: (data) => `주문번호 ${data.orderNumber}이 취소되었습니다.`,
  },
  refund_approved: {
    title: '환불 승인',
    message: (data) => `환불 요청이 승인되었습니다. 환불 금액: ${data.amount.toLocaleString()}원`,
  },
  refund_completed: {
    title: '환불 완료',
    message: (data) => `환불이 완료되었습니다. 환불 금액: ${data.amount.toLocaleString()}원`,
  },
  point_earned: {
    title: '포인트 적립',
    message: (data) => `${data.amount.toLocaleString()} 포인트가 적립되었습니다.`,
  },
  point_expiring: {
    title: '포인트 만료 예정',
    message: (data) => `${data.amount.toLocaleString()} 포인트가 ${data.daysLeft}일 후 만료됩니다.`,
  },
  coupon_received: {
    title: '쿠폰 발급',
    message: (data) => `${data.couponName} 쿠폰이 발급되었습니다.`,
  },
  coupon_expiring: {
    title: '쿠폰 만료 예정',
    message: (data) => `${data.couponName} 쿠폰이 ${data.daysLeft}일 후 만료됩니다.`,
  },
  review_reward: {
    title: '리뷰 작성 보상',
    message: (data) => `리뷰 작성으로 ${data.points.toLocaleString()} 포인트가 적립되었습니다.`,
  },
  stock_alert: {
    title: '재입고 알림',
    message: (data) => `${data.productName} 상품이 재입고되었습니다.`,
  },
  price_drop: {
    title: '가격 인하',
    message: (data) => `관심 상품 ${data.productName}의 가격이 인하되었습니다.`,
  },
  promotion: {
    title: '프로모션',
    message: (data) => data.message,
  },
  system: {
    title: '시스템 알림',
    message: (data) => data.message,
  },
};

// 알림 설정 조회
export async function getNotificationSettings(userId: string): Promise<{
  email: boolean;
  sms: boolean;
  push: boolean;
  marketing: boolean;
}> {
  const supabase = createClient();

  const { data } = await supabase
    .from('notification_settings')
    .select('email_order, email_marketing, sms_marketing, push_enabled')
    .eq('user_id', userId)
    .single();

  return {
    email: data?.email_order ?? true,
    sms: data?.sms_marketing ?? false,
    push: data?.push_enabled ?? true,
    marketing: data?.email_marketing ?? false,
  };
}

// 알림 설정 업데이트
export async function updateNotificationSettings(
  userId: string,
  settings: {
    email?: boolean;
    sms?: boolean;
    push?: boolean;
    marketing?: boolean;
  }
): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase
    .from('notification_settings')
    .upsert({
      user_id: userId,
      email_order: settings.email,
      sms_marketing: settings.sms,
      email_marketing: settings.marketing,
      push_enabled: settings.push,
    });

  return !error;
}
