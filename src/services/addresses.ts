import { createClient } from '@/lib/supabase/client';

export interface UserAddress {
  id: string;
  userId: string;
  name: string;
  recipientName: string;
  recipientPhone: string;
  postalCode: string;
  address1: string;
  address2: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AddressInput {
  name: string;
  recipientName: string;
  recipientPhone: string;
  postalCode: string;
  address1: string;
  address2?: string;
  isDefault?: boolean;
}

function mapAddress(data: any): UserAddress {
  return {
    id: data.id,
    userId: data.user_id,
    name: data.name,
    recipientName: data.recipient_name,
    recipientPhone: data.recipient_phone,
    postalCode: data.postal_code,
    address1: data.address1,
    address2: data.address2,
    isDefault: data.is_default,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * 사용자 배송지 목록 조회
 */
export async function getUserAddresses(userId: string): Promise<UserAddress[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('user_addresses')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(mapAddress);
}

/**
 * 배송지 상세 조회
 */
export async function getAddressById(addressId: string): Promise<UserAddress | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('user_addresses')
    .select('*')
    .eq('id', addressId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return mapAddress(data);
}

/**
 * 기본 배송지 조회
 */
export async function getDefaultAddress(userId: string): Promise<UserAddress | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('user_addresses')
    .select('*')
    .eq('user_id', userId)
    .eq('is_default', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return mapAddress(data);
}

/**
 * 배송지 추가
 */
export async function createAddress(userId: string, input: AddressInput): Promise<UserAddress> {
  const supabase = createClient();

  // 기본 배송지로 설정하는 경우, 기존 기본 배송지 해제
  if (input.isDefault) {
    await supabase
      .from('user_addresses')
      .update({ is_default: false })
      .eq('user_id', userId)
      .eq('is_default', true);
  }

  // 첫 번째 배송지는 자동으로 기본 배송지로 설정
  const { data: existingAddresses } = await supabase
    .from('user_addresses')
    .select('id')
    .eq('user_id', userId)
    .limit(1);

  const isFirstAddress = !existingAddresses || existingAddresses.length === 0;

  const { data, error } = await supabase
    .from('user_addresses')
    .insert({
      user_id: userId,
      name: input.name,
      recipient_name: input.recipientName,
      recipient_phone: input.recipientPhone,
      postal_code: input.postalCode,
      address1: input.address1,
      address2: input.address2 || null,
      is_default: input.isDefault || isFirstAddress,
    })
    .select()
    .single();

  if (error) throw error;

  return mapAddress(data);
}

/**
 * 배송지 수정
 */
export async function updateAddress(addressId: string, userId: string, input: Partial<AddressInput>): Promise<UserAddress> {
  const supabase = createClient();

  // 기본 배송지로 설정하는 경우, 기존 기본 배송지 해제
  if (input.isDefault) {
    await supabase
      .from('user_addresses')
      .update({ is_default: false })
      .eq('user_id', userId)
      .eq('is_default', true)
      .neq('id', addressId);
  }

  const updateData: Record<string, any> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.recipientName !== undefined) updateData.recipient_name = input.recipientName;
  if (input.recipientPhone !== undefined) updateData.recipient_phone = input.recipientPhone;
  if (input.postalCode !== undefined) updateData.postal_code = input.postalCode;
  if (input.address1 !== undefined) updateData.address1 = input.address1;
  if (input.address2 !== undefined) updateData.address2 = input.address2;
  if (input.isDefault !== undefined) updateData.is_default = input.isDefault;

  const { data, error } = await supabase
    .from('user_addresses')
    .update(updateData)
    .eq('id', addressId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;

  return mapAddress(data);
}

/**
 * 배송지 삭제
 */
export async function deleteAddress(addressId: string, userId: string): Promise<void> {
  const supabase = createClient();

  // 삭제할 배송지가 기본 배송지인지 확인
  const { data: address } = await supabase
    .from('user_addresses')
    .select('is_default')
    .eq('id', addressId)
    .eq('user_id', userId)
    .single();

  const { error } = await supabase
    .from('user_addresses')
    .delete()
    .eq('id', addressId)
    .eq('user_id', userId);

  if (error) throw error;

  // 삭제한 배송지가 기본 배송지였다면, 다른 배송지를 기본으로 설정
  if (address?.is_default) {
    const { data: remaining } = await supabase
      .from('user_addresses')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (remaining && remaining.length > 0) {
      await supabase
        .from('user_addresses')
        .update({ is_default: true })
        .eq('id', remaining[0].id);
    }
  }
}

/**
 * 기본 배송지 설정
 */
export async function setDefaultAddress(addressId: string, userId: string): Promise<void> {
  const supabase = createClient();

  // 기존 기본 배송지 해제
  await supabase
    .from('user_addresses')
    .update({ is_default: false })
    .eq('user_id', userId)
    .eq('is_default', true);

  // 새 기본 배송지 설정
  const { error } = await supabase
    .from('user_addresses')
    .update({ is_default: true })
    .eq('id', addressId)
    .eq('user_id', userId);

  if (error) throw error;
}
