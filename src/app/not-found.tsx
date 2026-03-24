import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
  return (
    <div className="container flex min-h-[calc(100vh-200px)] flex-col items-center justify-center py-8 text-center">
      <h1 className="mb-4 text-6xl font-bold">404</h1>
      <h2 className="mb-4 text-2xl font-semibold">페이지를 찾을 수 없습니다</h2>
      <p className="mb-8 text-muted-foreground">
        요청하신 페이지가 존재하지 않거나 이동되었습니다.
      </p>
      <Link to="/">
        <Button size="lg">홈으로 돌아가기</Button>
      </Link>
    </div>
  );
}
