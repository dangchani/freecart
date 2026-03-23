import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateBrandSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).optional(),
  logo_url: z.string().url().optional().nullable(),
  description: z.string().optional().nullable(),
  website_url: z.string().url().optional().nullable(),
  is_visible: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { brandId } = await params;
    const body = await request.json();
    const updateData = updateBrandSchema.parse(body);

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: '변경할 내용이 없습니다.' }, { status: 400 });
    }

    // Check slug uniqueness if changing
    if (updateData.slug) {
      const { data: existing } = await supabase
        .from('product_brands')
        .select('id')
        .eq('slug', updateData.slug)
        .neq('id', brandId)
        .single();

      if (existing) {
        return NextResponse.json(
          { success: false, error: '이미 사용 중인 슬러그입니다.' },
          { status: 409 }
        );
      }
    }

    const { data, error } = await supabase
      .from('product_brands')
      .update(updateData)
      .eq('id', brandId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json({ success: false, error: '브랜드를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: '입력값이 올바르지 않습니다.', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: '브랜드 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { brandId } = await params;

    const { data: brand } = await supabase
      .from('product_brands')
      .select('id, name')
      .eq('id', brandId)
      .single();

    if (!brand) {
      return NextResponse.json({ success: false, error: '브랜드를 찾을 수 없습니다.' }, { status: 404 });
    }

    // Check for products using this brand
    const { count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('brand_id', brandId);

    if (productCount && productCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `이 브랜드를 사용 중인 상품이 ${productCount}개 있습니다. 상품의 브랜드를 먼저 변경해주세요.`,
        },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('product_brands')
      .delete()
      .eq('id', brandId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `${brand.name} 브랜드가 삭제되었습니다.`,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: '브랜드 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
