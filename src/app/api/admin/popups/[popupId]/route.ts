import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updatePopupSchema = z.object({
  name: z.string().min(1).optional(),
  content: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  linkUrl: z.string().optional().nullable(),
  position: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional(),
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
  { params }: { params: Promise<{ popupId: string }> }
) {
  try {
    const supabase = await createClient();
    const { popupId } = await params;

    const auth = await requireAdmin(supabase);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const updates = updatePopupSchema.parse(body);

    const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.content !== undefined) dbUpdates.content = updates.content;
    if (updates.imageUrl !== undefined) dbUpdates.image_url = updates.imageUrl;
    if (updates.linkUrl !== undefined) dbUpdates.link_url = updates.linkUrl;
    if (updates.position !== undefined) dbUpdates.position = updates.position;
    if (updates.width !== undefined) dbUpdates.width = updates.width;
    if (updates.height !== undefined) dbUpdates.height = updates.height;
    if (updates.startsAt !== undefined) dbUpdates.starts_at = updates.startsAt;
    if (updates.endsAt !== undefined) dbUpdates.ends_at = updates.endsAt;
    if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;

    const { data, error } = await supabase
      .from('popups')
      .update(dbUpdates)
      .eq('id', popupId)
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
      { success: false, error: '팝업을 수정하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ popupId: string }> }
) {
  try {
    const supabase = await createClient();
    const { popupId } = await params;

    const auth = await requireAdmin(supabase);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { error } = await supabase.from('popups').delete().eq('id', popupId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: { id: popupId } });
  } catch {
    return NextResponse.json(
      { success: false, error: '팝업을 삭제하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
