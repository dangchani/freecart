import { Wallet } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function AdminDepositsPage() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">예치금 관리</h1>
        <p className="text-sm text-gray-500 mt-1">회원별 예치금 내역을 조회하고 관리합니다.</p>
      </div>

      <Card className="flex flex-col items-center justify-center py-24 text-center">
        <Wallet className="h-12 w-12 text-gray-300 mb-4" />
        <p className="text-gray-400 text-sm">예치금 관리 기능이 준비 중입니다.</p>
      </Card>
    </div>
  );
}
