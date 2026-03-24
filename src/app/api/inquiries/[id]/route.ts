import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { data: inquiry, error } = await supabase
      .from('inquiries')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !inquiry) {
      return NextResponse.json({ success: false, error: '문의를 찾을 수 없습니다.' }, { status: 404 });
    }

    // Only allow the owner to view
    if (inquiry.user_id !== user.id) {
      return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: inquiry });
  } catch {
    return NextResponse.json(
      { success: false, error: '문의를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { data: inquiry, error: fetchError } = await supabase
      .from('inquiries')
      .select('id, user_id, status')
      .eq('id', id)
      .single();

    if (fetchError || !inquiry) {
      return NextResponse.json({ success: false, error: '문의를 찾을 수 없습니다.' }, { status: 404 });
    }

    // Only allow the owner
    if (inquiry.user_id !== user.id) {
      return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    // Only allow deletion of pending inquiries
    if (inquiry.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: '답변 완료된 문의는 삭제할 수 없습니다.' },
        { status: 400 }
      );
    }

    const { error } = await supabase.from('inquiries').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: null });
  } catch {
    return NextResponse.json(
      { success: false, error: '문의 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
