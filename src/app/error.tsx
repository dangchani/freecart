'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container flex min-h-[calc(100vh-200px)] flex-col items-center justify-center py-8 text-center">
      <h1 className="mb-4 text-6xl font-bold">500</h1>
      <h2 className="mb-4 text-2xl font-semibold">문제가 발생했습니다</h2>
      <p className="mb-8 text-muted-foreground">
        일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
      </p>
      <div className="flex gap-4">
        <Button size="lg" onClick={() => reset()}>
          다시 시도
        </Button>
        <Button size="lg" variant="outline" onClick={() => (window.location.href = '/')}>
          홈으로 돌아가기
        </Button>
      </div>
    </div>
  );
}
