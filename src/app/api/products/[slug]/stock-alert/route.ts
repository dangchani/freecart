import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'edge';

const stockAlertSchema = z.object({
  variant_id: z.string().uuid().optional().nullable(),
  email: z.string().email().optional(),
});

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
    const { variant_id, email } = stockAlertSchema.parse(body);

    // Check if already registered
    let existingQuery = supabase
      .from('product_stock_alerts')
      .select('id')
      .eq('product_id', product.id)
      .eq('user_id', user.id);

    if (variant_id) {
      existingQuery = existingQuery.eq('variant_id', variant_id);
    } else {
      existingQuery = existingQuery.is('variant_id', null);
    }

    const { data: existing } = await existingQuery.single();

    if (existing) {
      return NextResponse.json(
        { success: false, error: '이미 재입고 알림이 등록되어 있습니다.' },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from('product_stock_alerts')
      .insert({
        product_id: product.id,
        variant_id: variant_id || null,
        user_id: user.id,
        email: email || null,
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
      { success: false, error: '재입고 알림 등록 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const { searchParams } = new URL(request.url);
    const variantId = searchParams.get('variant_id');

    let deleteQuery = supabase
      .from('product_stock_alerts')
      .delete()
      .eq('product_id', product.id)
      .eq('user_id', user.id);

    if (variantId) {
      deleteQuery = deleteQuery.eq('variant_id', variantId);
    } else {
      deleteQuery = deleteQuery.is('variant_id', null);
    }

    const { error } = await deleteQuery;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: null });
  } catch {
    return NextResponse.json(
      { success: false, error: '재입고 알림 취소 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
