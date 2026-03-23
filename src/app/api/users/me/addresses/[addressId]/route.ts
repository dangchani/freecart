import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateAddressSchema = z.object({
  name: z.string().min(1, '배송지 이름을 입력해 주세요.').optional(),
  recipient_name: z.string().min(2, '수령인 이름을 입력해 주세요.').optional(),
  recipient_phone: z
    .string()
    .regex(/^01[0-9]{8,9}$/, '올바른 전화번호 형식이 아닙니다.')
    .optional(),
  postal_code: z.string().min(5, '우편번호를 입력해 주세요.').optional(),
  address1: z.string().min(1, '기본 주소를 입력해 주세요.').optional(),
  address2: z.string().optional(),
  is_default: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { addressId: string } }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { addressId } = params;
    const body = await request.json();
    const updates = updateAddressSchema.parse(body);

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: '변경할 내용이 없습니다.' },
        { status: 400 }
      );
    }

    // Verify the address belongs to the user
    const { data: existingAddress } = await supabase
      .from('user_addresses')
      .select('id')
      .eq('id', addressId)
      .eq('user_id', user.id)
      .single();

    if (!existingAddress) {
      return NextResponse.json(
        { success: false, error: '배송지를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // If setting as default, unset all other defaults first
    if (updates.is_default === true) {
      await supabase
        .from('user_addresses')
        .update({ is_default: false })
        .eq('user_id', user.id)
        .eq('is_default', true);
    }

    const { data, error } = await supabase
      .from('user_addresses')
      .update(updates)
      .eq('id', addressId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: '배송지 수정 중 오류가 발생했습니다.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0]?.message ?? '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }
    console.error('PATCH /users/me/addresses/[addressId] error:', error);
    return NextResponse.json(
      { success: false, error: '배송지 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { addressId: string } }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { addressId } = params;

    // Verify the address belongs to the user and get its data
    const { data: existingAddress } = await supabase
      .from('user_addresses')
      .select('id, is_default')
      .eq('id', addressId)
      .eq('user_id', user.id)
      .single();

    if (!existingAddress) {
      return NextResponse.json(
        { success: false, error: '배송지를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const { error } = await supabase
      .from('user_addresses')
      .delete()
      .eq('id', addressId)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json(
        { success: false, error: '배송지 삭제 중 오류가 발생했습니다.' },
        { status: 400 }
      );
    }

    // If deleted address was default, set the most recent remaining address as default
    if (existingAddress.is_default) {
      const { data: remainingAddresses } = await supabase
        .from('user_addresses')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (remainingAddresses && remainingAddresses.length > 0) {
        await supabase
          .from('user_addresses')
          .update({ is_default: true })
          .eq('id', remainingAddresses[0].id);
      }
    }

    return NextResponse.json({
      success: true,
      data: { message: '배송지가 삭제되었습니다.' },
    });
  } catch (error) {
    console.error('DELETE /users/me/addresses/[addressId] error:', error);
    return NextResponse.json(
      { success: false, error: '배송지 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
