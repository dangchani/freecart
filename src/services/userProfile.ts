import { createClient } from '@/lib/supabase/client';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone?: string;
  birthday?: string;
  gender?: 'male' | 'female' | 'other';
  profileImage?: string;
  level: {
    id: string;
    name: string;
    discountRate: number;
  };
  points: number;
  deposit: number;
  totalOrders: number;
  totalSpent: number;
  addresses: UserAddress[];
  preferences: UserPreferences;
  createdAt: string;
}

export interface UserAddress {
  id: string;
  name: string;
  recipientName: string;
  phone: string;
  zipcode: string;
  address1: string;
  address2?: string;
  isDefault: boolean;
}

export interface UserPreferences {
  marketingEmail: boolean;
  marketingSms: boolean;
  orderNotification: boolean;
  reviewReminder: boolean;
}

// 사용자 프로필 가져오기
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const supabase = createClient();

  // 기본 정보
  const { data: user, error } = await supabase
    .from('users')
    .select(`
      id, email, name, phone, birthday, gender, profile_image, created_at,
      points, deposit,
      user_levels(id, name, discount_rate)
    `)
    .eq('id', userId)
    .single();

  if (error || !user) return null;

  // 배송지 목록
  const { data: addresses } = await supabase
    .from('user_addresses')
    .select('id, name, recipient_name, phone, zipcode, address1, address2, is_default')
    .eq('user_id', userId)
    .order('is_default', { ascending: false });

  // 주문 통계
  const { data: orderStats } = await supabase
    .from('orders')
    .select('id, total_amount')
    .eq('user_id', userId)
    .not('status', 'in', '("cancelled","refunded")');

  // 설정
  const { data: preferences } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  const totalOrders = orderStats?.length || 0;
  const totalSpent = orderStats?.reduce((sum, o: any) => sum + (o.total_amount || 0), 0) || 0;

  return {
    id: user.id,
    email: user.email,
    name: user.name || '',
    phone: user.phone,
    birthday: user.birthday,
    gender: user.gender,
    profileImage: user.profile_image,
    level: {
      id: (user as any).user_levels?.id || '',
      name: (user as any).user_levels?.name || '일반',
      discountRate: (user as any).user_levels?.discount_rate || 0,
    },
    points: user.points || 0,
    deposit: user.deposit || 0,
    totalOrders,
    totalSpent,
    addresses: (addresses || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      recipientName: a.recipient_name,
      phone: a.phone,
      zipcode: a.zipcode,
      address1: a.address1,
      address2: a.address2,
      isDefault: a.is_default,
    })),
    preferences: preferences || {
      marketingEmail: false,
      marketingSms: false,
      orderNotification: true,
      reviewReminder: true,
    },
    createdAt: user.created_at,
  };
}

// 프로필 업데이트
export async function updateUserProfile(
  userId: string,
  data: {
    name?: string;
    phone?: string;
    birthday?: string;
    gender?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { error } = await supabase
    .from('users')
    .update({
      name: data.name,
      phone: data.phone,
      birthday: data.birthday,
      gender: data.gender,
    })
    .eq('id', userId);

  if (error) {
    return { success: false, error: '프로필 업데이트에 실패했습니다.' };
  }

  return { success: true };
}

// 프로필 이미지 업로드
export async function uploadProfileImage(
  userId: string,
  file: File
): Promise<{ success: boolean; url?: string; error?: string }> {
  const supabase = createClient();

  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}-${Date.now()}.${fileExt}`;
  const filePath = `profiles/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('profiles')
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    return { success: false, error: '이미지 업로드에 실패했습니다.' };
  }

  const { data: publicUrl } = supabase.storage
    .from('profiles')
    .getPublicUrl(filePath);

  // DB 업데이트
  await supabase
    .from('users')
    .update({ profile_image: publicUrl.publicUrl })
    .eq('id', userId);

  return { success: true, url: publicUrl.publicUrl };
}

// 배송지 추가
export async function addAddress(
  userId: string,
  address: Omit<UserAddress, 'id'>
): Promise<{ success: boolean; addressId?: string; error?: string }> {
  const supabase = createClient();

  // 기본 배송지로 설정하면 다른 주소 기본값 해제
  if (address.isDefault) {
    await supabase
      .from('user_addresses')
      .update({ is_default: false })
      .eq('user_id', userId);
  }

  const { data, error } = await supabase
    .from('user_addresses')
    .insert({
      user_id: userId,
      name: address.name,
      recipient_name: address.recipientName,
      phone: address.phone,
      zipcode: address.zipcode,
      address1: address.address1,
      address2: address.address2,
      is_default: address.isDefault,
    })
    .select('id')
    .single();

  if (error) {
    return { success: false, error: '배송지 추가에 실패했습니다.' };
  }

  return { success: true, addressId: data.id };
}

// 배송지 수정
export async function updateAddress(
  addressId: string,
  userId: string,
  address: Partial<UserAddress>
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  if (address.isDefault) {
    await supabase
      .from('user_addresses')
      .update({ is_default: false })
      .eq('user_id', userId);
  }

  const { error } = await supabase
    .from('user_addresses')
    .update({
      name: address.name,
      recipient_name: address.recipientName,
      phone: address.phone,
      zipcode: address.zipcode,
      address1: address.address1,
      address2: address.address2,
      is_default: address.isDefault,
    })
    .eq('id', addressId)
    .eq('user_id', userId);

  if (error) {
    return { success: false, error: '배송지 수정에 실패했습니다.' };
  }

  return { success: true };
}

// 배송지 삭제
export async function deleteAddress(
  addressId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { error } = await supabase
    .from('user_addresses')
    .delete()
    .eq('id', addressId)
    .eq('user_id', userId);

  if (error) {
    return { success: false, error: '배송지 삭제에 실패했습니다.' };
  }

  return { success: true };
}

// 기본 배송지 설정
export async function setDefaultAddress(
  addressId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  // 모든 주소 기본값 해제
  await supabase
    .from('user_addresses')
    .update({ is_default: false })
    .eq('user_id', userId);

  // 선택한 주소 기본값 설정
  const { error } = await supabase
    .from('user_addresses')
    .update({ is_default: true })
    .eq('id', addressId)
    .eq('user_id', userId);

  if (error) {
    return { success: false, error: '기본 배송지 설정에 실패했습니다.' };
  }

  return { success: true };
}

// 설정 업데이트
export async function updatePreferences(
  userId: string,
  preferences: Partial<UserPreferences>
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { error } = await supabase
    .from('user_preferences')
    .upsert({
      user_id: userId,
      marketing_email: preferences.marketingEmail,
      marketing_sms: preferences.marketingSms,
      order_notification: preferences.orderNotification,
      review_reminder: preferences.reviewReminder,
    });

  if (error) {
    return { success: false, error: '설정 업데이트에 실패했습니다.' };
  }

  return { success: true };
}

// 비밀번호 변경
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  // 현재 비밀번호로 로그인 시도
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    return { success: false, error: '로그인 정보를 찾을 수 없습니다.' };
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (signInError) {
    return { success: false, error: '현재 비밀번호가 올바르지 않습니다.' };
  }

  // 새 비밀번호로 변경
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    return { success: false, error: '비밀번호 변경에 실패했습니다.' };
  }

  return { success: true };
}

// 회원 탈퇴
export async function withdrawAccount(
  userId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  // 탈퇴 기록 저장
  await supabase.from('user_withdrawals').insert({
    user_id: userId,
    reason,
    withdrawn_at: new Date().toISOString(),
  });

  // 사용자 비활성화
  const { error } = await supabase
    .from('users')
    .update({
      is_active: false,
      withdrawn_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    return { success: false, error: '회원 탈퇴 처리에 실패했습니다.' };
  }

  // 로그아웃
  await supabase.auth.signOut();

  return { success: true };
}
