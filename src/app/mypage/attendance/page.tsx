import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, CheckCircle, Flame } from 'lucide-react';
import { format, getDaysInMonth, startOfMonth, getDay } from 'date-fns';
import { ko } from 'date-fns/locale';

interface AttendanceData {
  attendedDates: string[];
  consecutiveDays: number;
  todayAttended: boolean;
  todayPoints?: number;
  currentMonth: string;
}

export default function AttendancePage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<AttendanceData>({
    attendedDates: [],
    consecutiveDays: 0,
    todayAttended: false,
    currentMonth: format(new Date(), 'yyyy-MM'),
  });
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      fetchAttendance();
    }
  }, [user, authLoading, currentMonth, navigate]);

  async function fetchAttendance() {
    setLoading(true);
    try {
      const month = format(currentMonth, 'yyyy-MM');
      const res = await fetch(`/api/users/me/attendance?month=${month}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error('출석 데이터 로딩 실패:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAttendance() {
    setChecking(true);
    try {
      const res = await fetch('/api/users/me/attendance', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setSuccessMessage(`출석 완료! ${json.data?.pointsEarned || 0}P 적립되었습니다.`);
        await fetchAttendance();
      } else {
        alert(json.error || '출석 체크에 실패했습니다.');
      }
    } catch (err) {
      console.error('출석 체크 실패:', err);
      alert('출석 체크 중 오류가 발생했습니다.');
    } finally {
      setChecking(false);
    }
  }

  function renderCalendar() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDayOfMonth = getDay(startOfMonth(currentMonth));
    const attendedSet = new Set(data.attendedDates);
    const today = format(new Date(), 'yyyy-MM-dd');

    const cells = [];
    // 빈 셀
    for (let i = 0; i < firstDayOfMonth; i++) {
      cells.push(<div key={`empty-${i}`} />);
    }
    // 날짜 셀
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isAttended = attendedSet.has(dateStr);
      const isToday = dateStr === today;

      cells.push(
        <div
          key={day}
          className={`flex aspect-square items-center justify-center rounded-full text-sm font-medium transition-colors ${
            isAttended
              ? 'bg-blue-500 text-white'
              : isToday
              ? 'border-2 border-blue-400 text-blue-600'
              : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          {isAttended ? (
            <span className="flex flex-col items-center leading-none">
              <CheckCircle className="h-4 w-4" />
              <span className="text-[10px]">{day}</span>
            </span>
          ) : (
            day
          )}
        </div>
      );
    }
    return cells;
  }

  if (authLoading) {
    return <div className="p-8 text-center text-gray-500">로딩 중...</div>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">출석 체크</h1>

      {/* 상태 카드들 */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-4 text-center">
          <Flame className="mx-auto mb-1 h-6 w-6 text-orange-500" />
          <p className="text-2xl font-bold">{data.consecutiveDays}</p>
          <p className="text-sm text-gray-500">연속 출석</p>
        </Card>
        <Card className="p-4 text-center">
          <CheckCircle className="mx-auto mb-1 h-6 w-6 text-blue-500" />
          <p className="text-2xl font-bold">{data.attendedDates.length}</p>
          <p className="text-sm text-gray-500">이번달 출석</p>
        </Card>
        <Card className="p-4 text-center">
          <Calendar className="mx-auto mb-1 h-6 w-6 text-green-500" />
          <p className="text-sm font-semibold text-gray-700">
            {data.todayAttended ? '오늘 출석 완료!' : '오늘 출석 전'}
          </p>
          <Button
            className="mt-2 w-full"
            size="sm"
            onClick={handleAttendance}
            disabled={data.todayAttended || checking}
          >
            {checking ? '체크 중...' : data.todayAttended ? '출석 완료' : '출석하기'}
          </Button>
        </Card>
      </div>

      {successMessage && (
        <div className="mb-4 rounded-md bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {successMessage}
        </div>
      )}

      {/* 스트릭 보너스 안내 */}
      <Card className="mb-6 p-4">
        <h2 className="mb-2 font-semibold text-gray-700">연속 출석 보너스</h2>
        <div className="flex gap-6 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-orange-400" />
            <span>5일 연속: +50P 보너스</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
            <span>10일 연속: +100P 보너스</span>
          </div>
        </div>
      </Card>

      {/* 달력 */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            className="rounded p-1 hover:bg-gray-100"
          >
            ‹
          </button>
          <h2 className="font-semibold">
            {format(currentMonth, 'yyyy년 MM월', { locale: ko })}
          </h2>
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            className="rounded p-1 hover:bg-gray-100"
          >
            ›
          </button>
        </div>

        <div className="mb-2 grid grid-cols-7 text-center text-xs font-medium text-gray-500">
          {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        {loading ? (
          <div className="py-8 text-center text-gray-400">로딩 중...</div>
        ) : (
          <div className="grid grid-cols-7 gap-1">{renderCalendar()}</div>
        )}
      </Card>
    </div>
  );
}
