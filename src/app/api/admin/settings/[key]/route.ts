import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateSettingSchema = z.object({
  value: z.string(),
  description: z.string().optional(),
});

async function requireAdmin(supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { authorized: false, status: 401, error: '인증이 필요합니다.' };
  const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (!adminProfile || adminProfile.role !== 'admin') return { authorized: false, status: 403, error: '관리자 권한이 필요합니다.' };
  return { authorized: true, status: 200, error: null };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const supabase = await createClient();
    const { key } = await params;

    const auth = await requireAdmin(supabase);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('key', key)
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: '설정을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json(
      { success: false, error: '설정을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const supabase = await createClient();
    const { key } = await params;

    const auth = await requireAdmin(supabase);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { value, description } = updateSettingSchema.parse(body);

    const dbUpdates: Record<string, unknown> = {
      key,
      value,
      updated_at: new Date().toISOString(),
    };
    if (description !== undefined) dbUpdates.description = description;

    const { data, error } = await supabase
      .from('settings')
      .upsert(dbUpdates, { onConflict: 'key' })
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
      { success: false, error: '설정을 저장하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
