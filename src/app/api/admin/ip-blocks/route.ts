import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createIpBlockSchema = z.object({
  ip_address: z.string().regex(
    /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$|^([0-9a-fA-F:]+)(\/\d{1,3})?$/,
    'IP 주소 형식이 올바르지 않습니다.'
  ),
  reason: z.string().min(1).max(500),
  expires_at: z.string().datetime().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search');
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('ip_blocks')
      .select('*, blocked_by_user:users!blocked_by(id, name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search) {
      query = query.ilike('ip_address', `%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'IP 차단 목록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const body = await request.json();
    const blockData = createIpBlockSchema.parse(body);

    // Check if IP is already blocked
    const { data: existingBlock } = await supabase
      .from('ip_blocks')
      .select('id')
      .eq('ip_address', blockData.ip_address)
      .single();

    if (existingBlock) {
      return NextResponse.json(
        { success: false, error: '이미 차단된 IP 주소입니다.' },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from('ip_blocks')
      .insert({
        ...blockData,
        blocked_by: user.id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { success: true, data, message: `${blockData.ip_address} IP가 차단되었습니다.` },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: '입력값이 올바르지 않습니다.', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'IP 차단 설정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
