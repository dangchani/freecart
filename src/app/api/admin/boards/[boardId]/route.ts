import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'edge';

const updateBoardSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  allowComment: z.boolean().optional(),
  allowAnonymous: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

async function requireAdmin(supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { authorized: false, status: 401, error: '인증이 필요합니다.' };
  const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (!adminProfile || adminProfile.role !== 'admin') return { authorized: false, status: 403, error: '관리자 권한이 필요합니다.' };
  return { authorized: true, status: 200, error: null };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const supabase = await createClient();
    const { boardId } = await params;

    const auth = await requireAdmin(supabase);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const updates = updateBoardSchema.parse(body);

    const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.slug !== undefined) dbUpdates.slug = updates.slug;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
    if (updates.allowComment !== undefined) dbUpdates.allow_comment = updates.allowComment;
    if (updates.allowAnonymous !== undefined) dbUpdates.allow_anonymous = updates.allowAnonymous;
    if (updates.sortOrder !== undefined) dbUpdates.sort_order = updates.sortOrder;

    const { data, error } = await supabase
      .from('boards')
      .update(dbUpdates)
      .eq('id', boardId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: '입력값이 올바르지 않습니다.' }, { status: 400 });
    }
    return NextResponse.json(
      { success: false, error: '게시판을 수정하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const supabase = await createClient();
    const { boardId } = await params;

    const auth = await requireAdmin(supabase);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { error } = await supabase.from('boards').delete().eq('id', boardId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: { id: boardId } });
  } catch {
    return NextResponse.json(
      { success: false, error: '게시판을 삭제하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
