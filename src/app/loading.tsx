export default function Loading() {
  return (
    <div className="container flex min-h-[calc(100vh-200px)] items-center justify-center py-8">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        <p className="text-muted-foreground">로딩 중...</p>
      </div>
    </div>
  );
}
