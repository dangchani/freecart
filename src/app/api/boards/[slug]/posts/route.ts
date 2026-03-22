import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createPostSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  isPinned: z.boolean().default(false),
  isNotice: z.boolean().default(false),
});

export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // 게시판 조회
    const { data: board, error: boardError } = await supabase
      .from('boards')
      .select('id')
      .eq('slug', params.slug)
      .single();

    if (boardError || !board) {
      return NextResponse.json(
        { success: false, error: '게시판을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const { data, error, count } = await supabase
      .from('posts')
      .select(
        `
        *,
        user:profiles(id, name)
      `,
        { count: 'exact' }
      )
      .eq('board_id', board.id)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);

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
  } catch (error) {
    return NextResponse.json(
      { success: false, error: '게시글 목록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    // 게시판 조회
    const { data: board, error: boardError } = await supabase
      .from('boards')
      .select('id')
      .eq('slug', params.slug)
      .single();

    if (boardError || !board) {
      return NextResponse.json(
        { success: false, error: '게시판을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const postData = createPostSchema.parse(body);

    const { data, error } = await supabase
      .from('posts')
      .insert({
        board_id: board.id,
        user_id: user.id,
        title: postData.title,
        content: postData.content,
        is_pinned: postData.isPinned,
        is_notice: postData.isNotice,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: '게시글 작성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
