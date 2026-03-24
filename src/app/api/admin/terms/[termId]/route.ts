import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'edge';

const updateTermSchema = z.object({
  type: z.string().optional(),
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  version: z.string().optional(),
  isRequired: z.boolean().optional(),
  isActive: z.boolean().optional(),
  effectiveAt: z.string().datetime().optional().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ termId: string }> }
) {
  try {
    const supabase = await createClient();
    const { termId } = await params;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { data: adminProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const updates = updateTermSchema.parse(body);

    const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.content !== undefined) dbUpdates.content = updates.content;
    if (updates.version !== undefined) dbUpdates.version = updates.version;
    if (updates.isRequired !== undefined) dbUpdates.is_required = updates.isRequired;
    if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
    if (updates.effectiveAt !== undefined) dbUpdates.effective_at = updates.effectiveAt;

    const { data, error } = await supabase
      .from('terms')
      .update(dbUpdates)
      .eq('id', termId)
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
      { success: false, error: '약관을 수정하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
