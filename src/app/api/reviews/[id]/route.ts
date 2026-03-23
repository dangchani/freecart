import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  images: z.array(z.string()).optional(),
});

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('reviews')
      .select(
        `
        *,
        user:profiles(id, name)
      `
      )
      .eq('id', params.id)
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: '리뷰를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: '리뷰 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const reviewData = updateReviewSchema.parse(body);

    const updateData: any = { updated_at: new Date().toISOString() };
    if (reviewData.rating !== undefined) updateData.rating = reviewData.rating;
    if (reviewData.title !== undefined) updateData.title = reviewData.title;
    if (reviewData.content !== undefined) updateData.content = reviewData.content;
    if (reviewData.images !== undefined) updateData.images = reviewData.images;

    const { data, error } = await supabase
      .from('reviews')
      .update(updateData)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: '리뷰 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: '리뷰 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
