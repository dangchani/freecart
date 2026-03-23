import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createUserLevelSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().optional().nullable(),
  discount_rate: z.number().min(0).max(100).default(0),
  point_rate: z.number().min(0).max(100).default(0),
  min_purchase_amount: z.number().int().min(0).default(0),
  min_purchase_count: z.number().int().min(0).default(0),
  conditions: z.record(z.unknown()).optional().nullable(),
  is_default: z.boolean().default(false),
  color: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
});

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { data: levels, error } = await supabase
      .from('user_levels')
      .select('*')
      .order('min_purchase_amount', { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    // Get user count per level
    const { data: userCounts } = await supabase
      .from('users')
      .select('level_id')
      .not('level_id', 'is', null);

    const countMap: Record<string, number> = {};
    (userCounts || []).forEach((u) => {
      if (u.level_id) {
        countMap[u.level_id] = (countMap[u.level_id] || 0) + 1;
      }
    });

    const levelsWithCounts = (levels || []).map((level) => ({
      ...level,
      user_count: countMap[level.id] || 0,
    }));

    return NextResponse.json({ success: true, data: levelsWithCounts });
  } catch {
    return NextResponse.json(
      { success: false, error: '회원 등급 목록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const body = await request.json();
    const levelData = createUserLevelSchema.parse(body);

    // If this is set as default, unset other defaults
    if (levelData.is_default) {
      await supabase
        .from('user_levels')
        .update({ is_default: false })
        .eq('is_default', true);
    }

    const { data, error } = await supabase
      .from('user_levels')
      .insert(levelData)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: '입력값이 올바르지 않습니다.', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: '회원 등급 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
