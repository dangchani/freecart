import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get('type');
    const isActiveParam = searchParams.get('isActive');

    let query = supabase
      .from('skins')
      .select(
        'id, name, slug, type, description, version, thumbnail_url, preview_url, is_system, is_active, settings'
      )
      .order('name', { ascending: true });

    if (typeFilter) {
      query = query.eq('type', typeFilter);
    }

    if (isActiveParam !== null) {
      query = query.eq('is_active', isActiveParam === 'true');
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json(
      { success: false, error: '스킨 목록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
