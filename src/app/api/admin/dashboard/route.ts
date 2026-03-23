import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();

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

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartISO = todayStart.toISOString();

    const [
      todayOrdersResult,
      todayUsersResult,
      orderStatusResult,
      recentOrdersResult,
      lowStockResult,
      newInquiriesResult,
      pendingReviewsResult,
    ] = await Promise.all([
      supabase
        .from('orders')
        .select('total, status')
        .gte('created_at', todayStartISO),
      supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayStartISO),
      supabase
        .from('orders')
        .select('status'),
      supabase
        .from('orders')
        .select('id, order_number, total, status, created_at, users(name, email)')
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('products')
        .select('id, name, stock_quantity, stock_alert_quantity')
        .filter('stock_quantity', 'lt', 'stock_alert_quantity')
        .limit(20),
      supabase
        .from('inquiries')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('is_visible', false),
    ]);

    const todayOrders = todayOrdersResult.data || [];
    const todaySales = todayOrders.reduce((sum: number, o: { total: number }) => sum + (o.total || 0), 0);

    const statusCounts: Record<string, number> = {
      pending: 0,
      paid: 0,
      preparing: 0,
      shipping: 0,
      delivered: 0,
      cancelled: 0,
    };
    (orderStatusResult.data || []).forEach((o: { status: string }) => {
      if (o.status in statusCounts) {
        statusCounts[o.status]++;
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        today: {
          sales: todaySales,
          orders: todayOrders.length,
          newUsers: todayUsersResult.count || 0,
        },
        orderStatus: statusCounts,
        recentOrders: recentOrdersResult.data || [],
        lowStockProducts: lowStockResult.data || [],
        newInquiries: newInquiriesResult.count || 0,
        pendingReviews: pendingReviewsResult.count || 0,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: '대시보드 데이터를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
