'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { Package, ShoppingCart, Users, MessageSquare } from 'lucide-react';

interface Stats {
  totalProducts: number;
  totalOrders: number;
  totalUsers: number;
  totalPosts: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalProducts: 0,
    totalOrders: 0,
    totalUsers: 0,
    totalPosts: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/auth/login');
        return;
      }
      // TODO: 실제로는 user.role === 'admin' 체크 필요
      loadStats();
    }
  }, [user, authLoading, router]);

  async function loadStats() {
    try {
      // TODO: 실제 통계 API 호출
      // 현재는 더미 데이터
      setStats({
        totalProducts: 0,
        totalOrders: 0,
        totalUsers: 0,
        totalPosts: 0,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || loading) {
    return <div className="container py-8">로딩 중...</div>;
  }

  return (
    <div className="container py-8">
      <h1 className="mb-8 text-3xl font-bold">관리자 대시보드</h1>

      <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">총 상품</p>
              <p className="text-2xl font-bold">{stats.totalProducts}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <ShoppingCart className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">총 주문</p>
              <p className="text-2xl font-bold">{stats.totalOrders}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">총 회원</p>
              <p className="text-2xl font-bold">{stats.totalUsers}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
              <MessageSquare className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">총 게시글</p>
              <p className="text-2xl font-bold">{stats.totalPosts}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Link href="/admin/products">
          <Card className="p-6 transition-shadow hover:shadow-md cursor-pointer">
            <h2 className="mb-2 text-xl font-bold">상품 관리</h2>
            <p className="text-gray-600">상품 등록, 수정, 삭제 및 재고 관리</p>
          </Card>
        </Link>

        <Link href="/admin/orders">
          <Card className="p-6 transition-shadow hover:shadow-md cursor-pointer">
            <h2 className="mb-2 text-xl font-bold">주문 관리</h2>
            <p className="text-gray-600">주문 내역 조회 및 배송 상태 관리</p>
          </Card>
        </Link>

        <Link href="/admin/categories">
          <Card className="p-6 transition-shadow hover:shadow-md cursor-pointer">
            <h2 className="mb-2 text-xl font-bold">카테고리 관리</h2>
            <p className="text-gray-600">카테고리 추가, 수정, 삭제</p>
          </Card>
        </Link>

        <Link href="/admin/boards">
          <Card className="p-6 transition-shadow hover:shadow-md cursor-pointer">
            <h2 className="mb-2 text-xl font-bold">게시판 관리</h2>
            <p className="text-gray-600">게시판 및 게시글 관리</p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
