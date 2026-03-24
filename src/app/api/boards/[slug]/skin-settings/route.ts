import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'edge';

const updateSkinSettingsSchema = z.object({
  list_skin_id: z.string().uuid().optional().nullable(),
  view_skin_id: z.string().uuid().optional().nullable(),
  settings: z.record(z.unknown()).optional().nullable(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const supabase = await createClient();
    const { slug } = await params;

    // Resolve board by slug
    const { data: board, error: boardError } = await supabase
      .from('boards')
      .select('id')
      .eq('slug', slug)
      .single();

    if (boardError || !board) {
      return NextResponse.json({ success: false, error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    const { data: skinSettings, error } = await supabase
      .from('board_skin_settings')
      .select(
        `
        id,
        board_id,
        list_skin_id,
        view_skin_id,
        settings,
        list_skin:skins!list_skin_id(id, name, slug, type, thumbnail_url),
        view_skin:skins!view_skin_id(id, name, slug, type, thumbnail_url)
      `
      )
      .eq('board_id', board.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    if (!skinSettings) {
      return NextResponse.json({
        success: true,
        data: {
          board_id: board.id,
          list_skin_id: null,
          view_skin_id: null,
          settings: null,
        },
      });
    }

    return NextResponse.json({ success: true, data: skinSettings });
  } catch {
    return NextResponse.json(
      { success: false, error: '스킨 설정을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const supabase = await createClient();
    const { slug } = await params;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profile?.role !== 'admin') {
      return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    // Resolve board by slug
    const { data: board, error: boardError } = await supabase
      .from('boards')
      .select('id')
      .eq('slug', slug)
      .single();

    if (boardError || !board) {
      return NextResponse.json({ success: false, error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    const body = await request.json();
    const updateData = updateSkinSettingsSchema.parse(body);

    // Upsert skin settings
    const { data, error } = await supabase
      .from('board_skin_settings')
      .upsert(
        {
          board_id: board.id,
          ...updateData,
        },
        { onConflict: 'board_id' }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: '입력값이 올바르지 않습니다.', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: '스킨 설정 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
