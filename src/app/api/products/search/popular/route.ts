import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

const FALLBACK_POPULAR_KEYWORDS = [
  '신상품',
  '베스트셀러',
  '할인',
  '무료배송',
  '추천',
  '인기',
  '세일',
  '특가',
  '한정판',
  '신규',
];

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: keywords, error } = await supabase
      .from('search_keywords')
      .select('id, keyword, count, created_at')
      .order('count', { ascending: false })
      .limit(10);

    if (error || !keywords || keywords.length === 0) {
      // Return fallback popular keywords if table doesn't exist or is empty
      return NextResponse.json({
        success: true,
        data: FALLBACK_POPULAR_KEYWORDS.map((keyword, index) => ({
          rank: index + 1,
          keyword,
          count: null,
        })),
      });
    }

    return NextResponse.json({
      success: true,
      data: keywords.map((row: any, index: number) => ({
        rank: index + 1,
        keyword: row.keyword,
        count: row.count,
      })),
    });
  } catch {
    return NextResponse.json(
      { success: false, error: '인기 검색어를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
