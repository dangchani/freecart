import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const offset = (page - 1) * limit;
    const status = searchParams.get('status'); // 'issued' | 'cancelled'

    let query = supabase
      .from('tax_invoices')
      .select(
        `
        id, order_id, business_number, company_name, ceo_name,
        business_type, business_category, email, address, recipient_email,
        amount, tax_amount, total_amount, invoice_number, status,
        issued_at, created_at,
        order:orders(id, order_number, total)
      `,
        { count: 'exact' }
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, error: '세금계산서 목록을 불러오는 중 오류가 발생했습니다.' },
        { status: 400 }
      );
    }

    const totalPages = Math.ceil((count ?? 0) / limit);

    return NextResponse.json({
      success: true,
      data: {
        taxInvoices: data ?? [],
        pagination: {
          page,
          limit,
          total: count ?? 0,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error('GET /users/me/tax-invoices error:', error);
    return NextResponse.json(
      { success: false, error: '세금계산서 목록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
