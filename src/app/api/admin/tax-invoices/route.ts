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

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const offset = (page - 1) * limit;
    const status = searchParams.get('status'); // 'issued' | 'cancelled'
    const search = searchParams.get('search') ?? '';

    let query = supabase
      .from('tax_invoices')
      .select(
        `
        *,
        order:orders(id, order_number, total, created_at),
        user:users(id, name, email)
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(
        `company_name.ilike.%${search}%,business_number.ilike.%${search}%,invoice_number.ilike.%${search}%`
      );
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
    console.error('GET /admin/tax-invoices error:', error);
    return NextResponse.json(
      { success: false, error: '세금계산서 목록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
