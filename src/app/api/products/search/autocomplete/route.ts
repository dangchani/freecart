import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';

    if (q.length < 2) {
      return NextResponse.json(
        { success: false, error: '검색어는 최소 2자 이상 입력해주세요.' },
        { status: 400 }
      );
    }

    // Search products by name
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, slug, primary_image, sale_price, regular_price, status')
      .ilike('name', `%${q}%`)
      .eq('status', 'active')
      .order('sales_count', { ascending: false })
      .limit(5);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    // Build keyword suggestions from product names
    const keywordSet = new Set<string>();
    keywordSet.add(q);
    for (const product of products || []) {
      const nameLower = product.name.toLowerCase();
      const qLower = q.toLowerCase();
      // Extract words from product names that contain the query
      const words = product.name.split(/\s+/);
      for (const word of words) {
        if (word.toLowerCase().includes(qLower) && word.length > 1) {
          keywordSet.add(word);
        }
      }
      if (nameLower.startsWith(qLower)) {
        keywordSet.add(product.name);
      }
    }

    // Also search search_keywords table if available
    const { data: keywordRows } = await supabase
      .from('search_keywords')
      .select('keyword')
      .ilike('keyword', `${q}%`)
      .order('count', { ascending: false })
      .limit(5);

    if (keywordRows) {
      for (const row of keywordRows) {
        keywordSet.add(row.keyword);
      }
    }

    const keywords = Array.from(keywordSet).slice(0, 8);

    return NextResponse.json({
      success: true,
      data: {
        keywords,
        products: products || [],
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: '자동완성 검색 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
