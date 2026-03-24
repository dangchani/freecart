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

    const { data: skin, error } = await supabase
      .from('skins')
      .select(
        'id, name, slug, type, description, version, thumbnail_url, preview_url, is_system, is_active, settings'
      )
      .eq('id', id)
      .single();

    if (error || !skin) {
      return NextResponse.json({ success: false, error: '스킨을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: skin });
  } catch {
    return NextResponse.json(
      { success: false, error: '스킨을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
