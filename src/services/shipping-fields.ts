// joy: 배송지 폼에 포함할 동적 필드 목록 조회
import { createClient } from '@/lib/supabase/client';
import type { FieldType } from '@/components/signup-fields/types';

export interface ShippingFieldDef {
  id: string;
  field_key: string;
  label: string;
  field_type: FieldType;
  shipping_is_required: boolean;
  shipping_sort_order: number;
  placeholder: string | null;
  help_text: string | null;
  options: Array<{ label: string; value: string }> | null;
}

/**
 * 배송지 폼에 포함할 필드 목록 반환.
 * is_active=true AND use_in_shipping=true 인 필드를 shipping_sort_order 순으로 반환.
 * address / terms / file / password 타입은 배송지 폼에 적합하지 않으므로 제외.
 */
export async function getShippingFields(): Promise<ShippingFieldDef[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('signup_field_definitions')
    .select('id, field_key, label, field_type, shipping_is_required, shipping_sort_order, placeholder, help_text, options')
    .eq('is_active', true)
    .eq('use_in_shipping', true)
    .not('field_type', 'in', '(address,terms,file,password)')
    .order('shipping_sort_order', { ascending: true });

  if (error) {
    console.error('getShippingFields error:', error);
    return [];
  }
  return (data ?? []) as ShippingFieldDef[];
}
