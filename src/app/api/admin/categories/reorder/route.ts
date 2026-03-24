import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'edge';

const reorderSchema = z.object({
  categories: z.array(
    z.object({
      id: z.string().uuid(),
      sortOrder: z.number().int().min(0),
    })
  ).min(1),
});

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const body = await request.json();
    const { categories } = reorderSchema.parse(body);

    // Update sort_order for each category using upsert batching
    const updates = categories.map(({ id, sortOrder }) =>
      supabase
        .from('categories')
        .update({ sort_order: sortOrder })
        .eq('id', id)
    );

    const results = await Promise.all(updates);
    const errors = results.filter((r) => r.error).map((r) => r.error?.message);

    if (errors.length > 0) {
      return NextResponse.json(
        { success: false, error: '일부 카테고리 순서 변경 중 오류가 발생했습니다.', details: errors },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${categories.length}개 카테고리의 순서가 변경되었습니다.`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: '입력값이 올바르지 않습니다.', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: '카테고리 순서 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
