import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'daily';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query = supabase
      .from('orders')
      .select('total, created_at, status')
      .neq('status', 'cancelled');

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data: orders, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    const totalSales = (orders || []).reduce(
      (sum: number, o: { total: number }) => sum + (o.total || 0),
      0
    );
    const orderCount = (orders || []).length;
    const avgOrderValue = orderCount > 0 ? totalSales / orderCount : 0;

    const chartDataMap: Record<string, { date: string; sales: number; orders: number }> = {};

    (orders || []).forEach((order: { total: number; created_at: string }) => {
      const date = new Date(order.created_at);
      let key: string;

      if (period === 'monthly') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else if (period === 'weekly') {
        const startOfYear = new Date(date.getFullYear(), 0, 1);
        const weekNumber = Math.ceil(
          ((date.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
        );
        key = `${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
      } else {
        key = date.toISOString().split('T')[0];
      }

      if (!chartDataMap[key]) {
        chartDataMap[key] = { date: key, sales: 0, orders: 0 };
      }
      chartDataMap[key].sales += order.total || 0;
      chartDataMap[key].orders += 1;
    });

    const chartData = Object.values(chartDataMap).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    return NextResponse.json({
      success: true,
      data: {
        totalSales,
        orderCount,
        avgOrderValue,
        period,
        chartData,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: '매출 통계를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
