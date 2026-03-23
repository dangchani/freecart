import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function maskIdentifier(identifier: string, identifierType: string): string {
  const clean = identifier.replace(/[^0-9]/g, '');
  if (identifierType === 'phone') {
    if (clean.length >= 10) {
      return `${clean.slice(0, 3)}-****-${clean.slice(-4)}`;
    }
    return clean.slice(0, 3) + '****' + clean.slice(-2);
  } else {
    if (clean.length >= 10) {
      return `${clean.slice(0, 3)}-**-${clean.slice(-5)}`;
    }
    return clean.slice(0, 3) + '**' + clean.slice(-3);
  }
}

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

    const { data, error, count } = await supabase
      .from('cash_receipts')
      .select(
        `
        id, order_id, type, identifier_type, identifier,
        amount, approval_number, status, issued_at, created_at,
        order:orders(id, order_number, total)
      `,
        { count: 'exact' }
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json(
        { success: false, error: '현금영수증 목록을 불러오는 중 오류가 발생했습니다.' },
        { status: 400 }
      );
    }

    // Mask identifiers
    const maskedData = (data ?? []).map((receipt) => ({
      ...receipt,
      identifier: maskIdentifier(receipt.identifier, receipt.identifier_type),
    }));

    const totalPages = Math.ceil((count ?? 0) / limit);

    return NextResponse.json({
      success: true,
      data: {
        cashReceipts: maskedData,
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
    console.error('GET /users/me/cash-receipts error:', error);
    return NextResponse.json(
      { success: false, error: '현금영수증 목록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
