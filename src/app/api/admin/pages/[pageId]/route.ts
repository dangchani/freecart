import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updatePageSchema = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  content: z.string().optional(),
  type: z.string().optional(),
  excerpt: z.string().optional().nullable(),
  isVisible: z.boolean().optional(),
  seoTitle: z.string().optional().nullable(),
  seoDescription: z.string().optional().nullable(),
  seoKeywords: z.string().optional().nullable(),
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
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const supabase = await createClient();
    const { pageId } = await params;

    const auth = await requireAdmin(supabase);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const updates = updatePageSchema.parse(body);

    const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.slug !== undefined) dbUpdates.slug = updates.slug;
    if (updates.content !== undefined) dbUpdates.content = updates.content;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.excerpt !== undefined) dbUpdates.excerpt = updates.excerpt;
    if (updates.isVisible !== undefined) dbUpdates.is_visible = updates.isVisible;
    if (updates.seoTitle !== undefined) dbUpdates.seo_title = updates.seoTitle;
    if (updates.seoDescription !== undefined) dbUpdates.seo_description = updates.seoDescription;
    if (updates.seoKeywords !== undefined) dbUpdates.seo_keywords = updates.seoKeywords;

    const { data, error } = await supabase
      .from('content_pages')
      .update(dbUpdates)
      .eq('id', pageId)
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
      { success: false, error: '페이지를 수정하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const supabase = await createClient();
    const { pageId } = await params;

    const auth = await requireAdmin(supabase);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { error } = await supabase.from('content_pages').delete().eq('id', pageId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: { id: pageId } });
  } catch {
    return NextResponse.json(
      { success: false, error: '페이지를 삭제하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
