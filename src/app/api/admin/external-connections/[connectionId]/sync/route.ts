import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { connectionId } = await params;

    // Verify connection exists and is active
    const { data: connection, error: connError } = await supabase
      .from('external_connections')
      .select('id, name, platform, is_active')
      .eq('id', connectionId)
      .single();

    if (connError || !connection) {
      return NextResponse.json({ success: false, error: '외부 연동을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (!connection.is_active) {
      return NextResponse.json({ success: false, error: '비활성화된 연동입니다. 동기화를 실행하려면 먼저 활성화하세요.' }, { status: 400 });
    }

    // Check for already running sync job
    const { data: runningJob } = await supabase
      .from('sync_jobs')
      .select('id, status')
      .eq('connection_id', connectionId)
      .eq('status', 'running')
      .single();

    if (runningJob) {
      return NextResponse.json(
        { success: false, error: '이미 동기화가 진행 중입니다.' },
        { status: 409 }
      );
    }

    // Create a new sync job record
    const { data: syncJob, error: jobError } = await supabase
      .from('sync_jobs')
      .insert({
        connection_id: connectionId,
        status: 'pending',
        started_at: new Date().toISOString(),
        items_synced: 0,
        errors: [],
      })
      .select()
      .single();

    if (jobError) {
      return NextResponse.json({ success: false, error: jobError.message }, { status: 400 });
    }

    // Update connection last_sync_at
    await supabase
      .from('external_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connectionId);

    return NextResponse.json(
      {
        success: true,
        data: syncJob,
        message: `${connection.name} 동기화 작업이 시작되었습니다.`,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: '동기화 실행 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
