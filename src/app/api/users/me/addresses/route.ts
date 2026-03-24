import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'edge';

const MAX_ADDRESSES = 5;

const createAddressSchema = z.object({
  name: z.string().min(1, '배송지 이름을 입력해 주세요.'),
  recipient_name: z.string().min(2, '수령인 이름을 입력해 주세요.'),
  recipient_phone: z
    .string()
    .regex(/^01[0-9]{8,9}$/, '올바른 전화번호 형식이 아닙니다.'),
  postal_code: z.string().min(5, '우편번호를 입력해 주세요.'),
  address1: z.string().min(1, '기본 주소를 입력해 주세요.'),
  address2: z.string().optional(),
  is_default: z.boolean().optional().default(false),
});

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('user_addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error: '배송지 목록을 불러오는 중 오류가 발생했습니다.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('GET /users/me/addresses error:', error);
    return NextResponse.json(
      { success: false, error: '배송지 목록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const addressData = createAddressSchema.parse(body);

    // Check address count limit
    const { count } = await supabase
      .from('user_addresses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if ((count ?? 0) >= MAX_ADDRESSES) {
      return NextResponse.json(
        { success: false, error: `배송지는 최대 ${MAX_ADDRESSES}개까지 등록할 수 있습니다.` },
        { status: 400 }
      );
    }

    // If setting as default, unset all other defaults first
    if (addressData.is_default) {
      await supabase
        .from('user_addresses')
        .update({ is_default: false })
        .eq('user_id', user.id)
        .eq('is_default', true);
    }

    // If this is the first address, make it default automatically
    const isFirstAddress = (count ?? 0) === 0;
    const shouldBeDefault = addressData.is_default || isFirstAddress;

    const { data, error } = await supabase
      .from('user_addresses')
      .insert({
        user_id: user.id,
        ...addressData,
        is_default: shouldBeDefault,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: '배송지 등록 중 오류가 발생했습니다.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0]?.message ?? '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }
    console.error('POST /users/me/addresses error:', error);
    return NextResponse.json(
      { success: false, error: '배송지 등록 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
