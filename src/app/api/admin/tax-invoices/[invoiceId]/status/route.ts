import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateStatusSchema = z.object({
  status: z.enum(['issued', 'cancelled'], {
    errorMap: () => ({ message: '유효한 상태값을 입력해 주세요. (issued | cancelled)' }),
  }),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { invoiceId: string } }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    // Verify admin role
    const { data: adminProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status } = updateStatusSchema.parse(body);

    // Verify invoice exists
    const { data: invoice, error: fetchError } = await supabase
      .from('tax_invoices')
      .select('id, status')
      .eq('id', params.invoiceId)
      .single();

    if (fetchError || !invoice) {
      return NextResponse.json(
        { success: false, error: '세금계산서를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const updatePayload: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'issued' && invoice.status !== 'issued') {
      updatePayload.issued_at = new Date().toISOString();
    }

    const { data: updated, error: updateError } = await supabase
      .from('tax_invoices')
      .update(updatePayload)
      .eq('id', params.invoiceId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { success: false, error: '세금계산서 상태 업데이트 중 오류가 발생했습니다.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0]?.message ?? '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }
    console.error('PATCH /admin/tax-invoices/[invoiceId]/status error:', error);
    return NextResponse.json(
      { success: false, error: '세금계산서 상태 업데이트 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
