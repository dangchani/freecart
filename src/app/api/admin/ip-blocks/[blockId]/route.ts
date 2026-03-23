import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ blockId: string }> }
) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { blockId } = await params;

    // Get the block record first to return info in message
    const { data: block, error: blockError } = await supabase
      .from('ip_blocks')
      .select('id, ip_address')
      .eq('id', blockId)
      .single();

    if (blockError || !block) {
      return NextResponse.json({ success: false, error: 'IP 차단 항목을 찾을 수 없습니다.' }, { status: 404 });
    }

    const { error } = await supabase
      .from('ip_blocks')
      .delete()
      .eq('id', blockId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `${block.ip_address} IP 차단이 해제되었습니다.`,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'IP 차단 해제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
