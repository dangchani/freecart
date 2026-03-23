import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  _request: NextRequest,
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
      .select('id, like_count, user_id')
      .eq('id', reviewId)
      .single();

    if (reviewError || !review) {
      return NextResponse.json({ success: false, error: '리뷰를 찾을 수 없습니다.' }, { status: 404 });
    }

    // Cannot like own review
    if (review.user_id === user.id) {
      return NextResponse.json(
        { success: false, error: '자신의 리뷰에는 좋아요를 누를 수 없습니다.' },
        { status: 400 }
      );
    }

    // Check if already liked
    const { data: existing } = await supabase
      .from('review_likes')
      .select('id')
      .eq('review_id', reviewId)
      .eq('user_id', user.id)
      .single();

    if (existing) {
      return NextResponse.json(
        { success: false, error: '이미 좋아요를 누른 리뷰입니다.' },
        { status: 409 }
      );
    }

    // Insert like
    const { error: likeError } = await supabase
      .from('review_likes')
      .insert({ review_id: reviewId, user_id: user.id });

    if (likeError) {
      return NextResponse.json({ success: false, error: likeError.message }, { status: 400 });
    }

    // Increment like_count on reviews
    const newCount = (review.like_count || 0) + 1;
    await supabase.from('reviews').update({ like_count: newCount }).eq('id', reviewId);

    return NextResponse.json({ success: true, data: { likeCount: newCount } });
  } catch {
    return NextResponse.json(
      { success: false, error: '좋아요 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
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
      .select('id, like_count')
      .eq('id', reviewId)
      .single();

    if (reviewError || !review) {
      return NextResponse.json({ success: false, error: '리뷰를 찾을 수 없습니다.' }, { status: 404 });
    }

    // Delete like
    const { error: deleteError } = await supabase
      .from('review_likes')
      .delete()
      .eq('review_id', reviewId)
      .eq('user_id', user.id);

    if (deleteError) {
      return NextResponse.json({ success: false, error: deleteError.message }, { status: 400 });
    }

    // Decrement like_count (floor at 0)
    const newCount = Math.max((review.like_count || 0) - 1, 0);
    await supabase.from('reviews').update({ like_count: newCount }).eq('id', reviewId);

    return NextResponse.json({ success: true, data: { likeCount: newCount } });
  } catch {
    return NextResponse.json(
      { success: false, error: '좋아요 취소 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
