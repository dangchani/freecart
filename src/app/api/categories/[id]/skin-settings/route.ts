import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateSkinSettingsSchema = z.object({
  product_list_skin_id: z.string().uuid().optional().nullable(),
  product_card_skin_id: z.string().uuid().optional().nullable(),
  settings: z.record(z.unknown()).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();

    const { id: categoryId } = await params;

    // Verify category exists
    const { data: category, error: catError } = await supabase
      .from('categories')
      .select('id, name')
      .eq('id', categoryId)
      .single();

    if (catError || !category) {
      return NextResponse.json({ success: false, error: '카테고리를 찾을 수 없습니다.' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('category_skin_settings')
      .select(`
        *,
        product_list_skin:skins!product_list_skin_id(id, name, slug, type),
        product_card_skin:skins!product_card_skin_id(id, name, slug, type)
      `)
      .eq('category_id', categoryId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: data || null });
  } catch {
    return NextResponse.json(
      { success: false, error: '카테고리 스킨 설정을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { id: categoryId } = await params;
    const body = await request.json();
    const updateData = updateSkinSettingsSchema.parse(body);

    // Verify category exists
    const { data: category } = await supabase
      .from('categories')
      .select('id')
      .eq('id', categoryId)
      .single();

    if (!category) {
      return NextResponse.json({ success: false, error: '카테고리를 찾을 수 없습니다.' }, { status: 404 });
    }

    // Upsert skin settings
    const { data, error } = await supabase
      .from('category_skin_settings')
      .upsert(
        {
          category_id: categoryId,
          ...updateData,
        },
        { onConflict: 'category_id' }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
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
      { success: false, error: '카테고리 스킨 설정 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
