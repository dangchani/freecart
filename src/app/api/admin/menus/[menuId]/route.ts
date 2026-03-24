import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'edge';

const updateMenuSchema = z.object({
  parentId: z.string().uuid().optional().nullable(),
  name: z.string().min(1).optional(),
  url: z.string().optional(),
  sortOrder: z.number().int().optional(),
  isVisible: z.boolean().optional(),
  target: z.enum(['_self', '_blank']).optional(),
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
  { params }: { params: Promise<{ menuId: string }> }
) {
  try {
    const supabase = await createClient();
    const { menuId } = await params;

    const auth = await requireAdmin(supabase);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const updates = updateMenuSchema.parse(body);

    const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.parentId !== undefined) dbUpdates.parent_id = updates.parentId;
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.url !== undefined) dbUpdates.url = updates.url;
    if (updates.sortOrder !== undefined) dbUpdates.sort_order = updates.sortOrder;
    if (updates.isVisible !== undefined) dbUpdates.is_visible = updates.isVisible;
    if (updates.target !== undefined) dbUpdates.target = updates.target;

    const { data, error } = await supabase
      .from('menus')
      .update(dbUpdates)
      .eq('id', menuId)
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
      { success: false, error: '메뉴를 수정하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ menuId: string }> }
) {
  try {
    const supabase = await createClient();
    const { menuId } = await params;

    const auth = await requireAdmin(supabase);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { error } = await supabase.from('menus').delete().eq('id', menuId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: { id: menuId } });
  } catch {
    return NextResponse.json(
      { success: false, error: '메뉴를 삭제하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
