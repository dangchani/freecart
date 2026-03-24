import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

type SortOption = 'latest' | 'rating_high' | 'rating_low' | 'helpful';

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const visible = local.length > 2 ? local.slice(0, 2) : local.slice(0, 1);
  return `${visible}${'*'.repeat(Math.max(local.length - 2, 1))}@${domain}`;
}

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
    const sort: SortOption = (searchParams.get('sort') as SortOption) || 'latest';
    const ratingFilter = searchParams.get('rating');
    const photoOnly = searchParams.get('photoOnly') === 'true';
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Get current user (optional)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Resolve product_id from slug
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id')
      .eq('slug', slug)
      .single();

    if (productError || !product) {
      return NextResponse.json({ success: false, error: '상품을 찾을 수 없습니다.' }, { status: 404 });
    }

    const productId = product.id;

    // Build summary query
    const { data: allReviews, error: summaryError } = await supabase
      .from('reviews')
      .select('rating, is_photo_review')
      .eq('product_id', productId)
      .eq('is_visible', true);

    if (summaryError) {
      return NextResponse.json({ success: false, error: summaryError.message }, { status: 400 });
    }

    const totalCount = allReviews?.length || 0;
    const avgRating =
      totalCount > 0
        ? allReviews!.reduce((sum, r) => sum + r.rating, 0) / totalCount
        : 0;
    const ratingCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let photoReviewCount = 0;
    for (const r of allReviews || []) {
      ratingCounts[r.rating] = (ratingCounts[r.rating] || 0) + 1;
      if (r.is_photo_review) photoReviewCount++;
    }

    // Build main reviews query
    let reviewQuery = supabase
      .from('reviews')
      .select(
        `
        id,
        product_id,
        user_id,
        order_item_id,
        rating,
        content,
        option_text,
        video_url,
        is_photo_review,
        is_best,
        like_count,
        admin_reply,
        admin_replied_at,
        is_visible,
        created_at,
        review_images(id, image_url, sort_order),
        user:users(id, nickname, profile_image, email)
      `,
        { count: 'exact' }
      )
      .eq('product_id', productId)
      .eq('is_visible', true)
      .range(from, to);

    if (ratingFilter) {
      reviewQuery = reviewQuery.eq('rating', parseInt(ratingFilter));
    }

    if (photoOnly) {
      reviewQuery = reviewQuery.eq('is_photo_review', true);
    }

    // Apply sort
    switch (sort) {
      case 'rating_high':
        reviewQuery = reviewQuery.order('rating', { ascending: false }).order('created_at', { ascending: false });
        break;
      case 'rating_low':
        reviewQuery = reviewQuery.order('rating', { ascending: true }).order('created_at', { ascending: false });
        break;
      case 'helpful':
        reviewQuery = reviewQuery.order('like_count', { ascending: false }).order('created_at', { ascending: false });
        break;
      case 'latest':
      default:
        reviewQuery = reviewQuery.order('created_at', { ascending: false });
        break;
    }

    const { data: reviews, error: reviewsError, count } = await reviewQuery;

    if (reviewsError) {
      return NextResponse.json({ success: false, error: reviewsError.message }, { status: 400 });
    }

    // Get liked review ids for current user
    let likedReviewIds = new Set<string>();
    if (user && reviews && reviews.length > 0) {
      const reviewIds = reviews.map((r: any) => r.id);
      const { data: likes } = await supabase
        .from('review_likes')
        .select('review_id')
        .eq('user_id', user.id)
        .in('review_id', reviewIds);
      if (likes) {
        likedReviewIds = new Set(likes.map((l: any) => l.review_id));
      }
    }

    // Process reviews: mask email if no nickname
    const processedReviews = (reviews || []).map((review: any) => {
      const userData = review.user;
      let displayName = '익명';
      if (userData) {
        if (userData.nickname) {
          displayName = userData.nickname;
        } else if (userData.email) {
          displayName = maskEmail(userData.email);
        }
      }
      return {
        ...review,
        user: userData
          ? {
              id: userData.id,
              nickname: displayName,
              profileImage: userData.profile_image || null,
            }
          : null,
        isLiked: likedReviewIds.has(review.id),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          avgRating: Math.round(avgRating * 10) / 10,
          totalCount,
          ratingCounts,
          photoReviewCount,
        },
        reviews: processedReviews,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: '리뷰를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
