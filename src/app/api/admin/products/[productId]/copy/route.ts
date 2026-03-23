import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const supabase = await createClient();
    const { productId } = await params;

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

    const { data: original, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (fetchError || !original) {
      return NextResponse.json({ success: false, error: '상품을 찾을 수 없습니다.' }, { status: 404 });
    }

    const timestamp = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, created_at, updated_at, view_count, ...productFields } = original;

    const { data, error } = await supabase
      .from('products')
      .insert({
        ...productFields,
        name: `${original.name} (복사)`,
        slug: `${original.slug}-copy-${timestamp}`,
        sku: original.sku ? `${original.sku}-COPY-${timestamp}` : undefined,
        status: 'inactive',
        view_count: 0,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch {
    return NextResponse.json(
      { success: false, error: '상품을 복사하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
