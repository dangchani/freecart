import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createQnaSchema = z.object({
  question: z.string().min(1, '질문 내용을 입력해주세요.').max(1000),
  is_secret: z.boolean().default(false),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const supabase = await createClient();
    const { slug } = await params;
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Get current user (optional)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Resolve product
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id')
      .eq('slug', slug)
      .single();

    if (productError || !product) {
      return NextResponse.json({ success: false, error: '상품을 찾을 수 없습니다.' }, { status: 404 });
    }

    const productId = product.id;

    const { data: qnaList, error, count } = await supabase
      .from('product_qna')
      .select(
        `
        id,
        product_id,
        user_id,
        question,
        is_secret,
        answer,
        answered_at,
        answered_by,
        created_at
      `,
        { count: 'exact' }
      )
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    // Mask secret Q&As for non-authors
    const processedList = (qnaList || []).map((item: any) => {
      const isAuthor = user && item.user_id === user.id;
      if (item.is_secret && !isAuthor) {
        return {
          id: item.id,
          product_id: item.product_id,
          user_id: null,
          question: '비밀 질문입니다.',
          is_secret: true,
          answer: item.answer ? '비밀 답변입니다.' : null,
          answered_at: item.answered_at,
          answered_by: item.answered_by,
          created_at: item.created_at,
        };
      }
      return item;
    });

    return NextResponse.json({
      success: true,
      data: processedList,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Q&A를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const supabase = await createClient();
    const { slug } = await params;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    // Resolve product
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id')
      .eq('slug', slug)
      .single();

    if (productError || !product) {
      return NextResponse.json({ success: false, error: '상품을 찾을 수 없습니다.' }, { status: 404 });
    }

    const body = await request.json();
    const { question, is_secret } = createQnaSchema.parse(body);

    const { data, error } = await supabase
      .from('product_qna')
      .insert({
        product_id: product.id,
        user_id: user.id,
        question,
        is_secret,
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
      { success: false, error: 'Q&A 등록 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
