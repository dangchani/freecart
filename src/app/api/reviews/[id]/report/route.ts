import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'edge';

const VALID_REASONS = ['spam', 'inappropriate', 'false_info', 'copyright', 'other'] as const;

const reportSchema = z.object({
  reason: z.enum(VALID_REASONS),
  detail: z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: reviewId } = await params;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    // Check review exists
    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .select('id, user_id')
      .eq('id', reviewId)
      .single();

    if (reviewError || !review) {
      return NextResponse.json({ success: false, error: '리뷰를 찾을 수 없습니다.' }, { status: 404 });
    }

    // Cannot report own review
    if (review.user_id === user.id) {
      return NextResponse.json(
        { success: false, error: '자신의 리뷰는 신고할 수 없습니다.' },
        { status: 400 }
      );
    }

    // Check if already reported by this user
    const { data: existing } = await supabase
      .from('review_reports')
      .select('id')
      .eq('review_id', reviewId)
      .eq('user_id', user.id)
      .single();

    if (existing) {
      return NextResponse.json(
        { success: false, error: '이미 신고한 리뷰입니다.' },
        { status: 409 }
      );
    }

    const body = await request.json();
    const { reason, detail } = reportSchema.parse(body);

    const { data, error } = await supabase
      .from('review_reports')
      .insert({
        review_id: reviewId,
        user_id: user.id,
        reason,
        detail: detail || null,
      })
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
      { success: false, error: '리뷰 신고 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
