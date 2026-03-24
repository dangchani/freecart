import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

const DAILY_POINTS = 10;
const CONSECUTIVE_BONUS: Record<number, number> = {
  5: 50,
  10: 100,
};

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

function getDateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

export async function POST() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const today = getTodayDate();

    // Check if already attended today
    const { data: existingAttendance } = await supabase
      .from('user_attendance')
      .select('id')
      .eq('user_id', user.id)
      .eq('attended_date', today)
      .single();

    if (existingAttendance) {
      return NextResponse.json(
        { success: false, error: '오늘은 이미 출석체크를 완료했습니다.' },
        { status: 409 }
      );
    }

    // Calculate consecutive days
    let consecutiveDays = 1;
    let checkDate = getDateNDaysAgo(1);

    // Walk back to find consecutive streak
    while (true) {
      const { data: prevAttendance } = await supabase
        .from('user_attendance')
        .select('id')
        .eq('user_id', user.id)
        .eq('attended_date', checkDate)
        .single();

      if (!prevAttendance) break;

      consecutiveDays++;
      const d = new Date(checkDate);
      d.setDate(d.getDate() - 1);
      checkDate = d.toISOString().split('T')[0];
    }

    // Calculate points earned
    let pointsEarned = DAILY_POINTS;
    const bonusPoints = CONSECUTIVE_BONUS[consecutiveDays] ?? 0;
    pointsEarned += bonusPoints;

    // Get current user points
    const { data: userData } = await supabase
      .from('users')
      .select('points')
      .eq('id', user.id)
      .single();

    const currentPoints = userData?.points ?? 0;
    const newBalance = currentPoints + pointsEarned;

    // Insert attendance record
    const { data: attendance, error: attendanceError } = await supabase
      .from('user_attendance')
      .insert({
        user_id: user.id,
        attended_date: today,
        points_earned: pointsEarned,
      })
      .select()
      .single();

    if (attendanceError) {
      return NextResponse.json(
        { success: false, error: '출석체크 처리 중 오류가 발생했습니다.' },
        { status: 400 }
      );
    }

    // Update user's points balance
    const { error: pointsUpdateError } = await supabase
      .from('users')
      .update({ points: newBalance })
      .eq('id', user.id);

    if (pointsUpdateError) {
      console.error('Failed to update user points:', pointsUpdateError);
    }

    // Insert points history record
    const descriptionParts = [`출석체크 (${today})`];
    if (bonusPoints > 0) {
      descriptionParts.push(`연속 ${consecutiveDays}일 보너스 +${bonusPoints}P`);
    }

    await supabase.from('user_points_history').insert({
      user_id: user.id,
      amount: pointsEarned,
      balance: newBalance,
      type: 'earn',
      description: descriptionParts.join(' / '),
    });

    return NextResponse.json({
      success: true,
      data: {
        attendance,
        pointsEarned,
        bonusPoints,
        consecutiveDays,
        newBalance,
        message:
          bonusPoints > 0
            ? `출석체크 완료! ${DAILY_POINTS}P + 연속 ${consecutiveDays}일 보너스 ${bonusPoints}P 획득!`
            : `출석체크 완료! ${DAILY_POINTS}P 획득!`,
      },
    });
  } catch (error) {
    console.error('POST /users/me/attendance error:', error);
    return NextResponse.json(
      { success: false, error: '출석체크 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = parseInt(
      searchParams.get('year') ?? String(new Date().getFullYear()),
      10
    );
    const month = parseInt(
      searchParams.get('month') ?? String(new Date().getMonth() + 1),
      10
    );

    if (month < 1 || month > 12 || year < 2000 || year > 2100) {
      return NextResponse.json(
        { success: false, error: '올바른 연월을 입력해 주세요.' },
        { status: 400 }
      );
    }

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // last day of month

    const { data, error } = await supabase
      .from('user_attendance')
      .select('*')
      .eq('user_id', user.id)
      .gte('attended_date', startDate)
      .lte('attended_date', endDate)
      .order('attended_date', { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: '출석 내역을 불러오는 중 오류가 발생했습니다.' },
        { status: 400 }
      );
    }

    const today = getTodayDate();
    const attendedToday = data?.some((a) => a.attended_date === today) ?? false;

    // Calculate current streak
    let currentStreak = 0;
    let checkDate = today;
    while (true) {
      const found = data?.some((a) => a.attended_date === checkDate);
      if (!found) {
        // If today not attended yet, check from yesterday for streak
        if (checkDate === today && !attendedToday) {
          checkDate = getDateNDaysAgo(1);
          continue;
        }
        break;
      }
      currentStreak++;
      const d = new Date(checkDate);
      d.setDate(d.getDate() - 1);
      checkDate = d.toISOString().split('T')[0];
    }

    return NextResponse.json({
      success: true,
      data: {
        year,
        month,
        attendedDates: data?.map((a) => a.attended_date) ?? [],
        history: data,
        attendedToday,
        currentStreak,
        totalThisMonth: data?.length ?? 0,
      },
    });
  } catch (error) {
    console.error('GET /users/me/attendance error:', error);
    return NextResponse.json(
      { success: false, error: '출석 내역을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
