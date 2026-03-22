# Freecart

무료 오픈소스 쇼핑몰/커뮤니티 솔루션

## 기술 스택

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Authentication**: Supabase Auth
- **Deployment**: Cloudflare Pages (무료)

## 빠른 시작

### 1. 저장소 클론

```bash
git clone https://github.com/dangchani/freecart.git
cd freecart
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 환경 설정

```bash
npm run setup
```

또는 수동으로 설정:

```bash
cp .env.example .env
```

`.env` 파일을 열고 다음 값을 입력:

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase 프로젝트 URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase Anon Key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase Service Role Key

### 4. 데이터베이스 초기화

```bash
npm run db:init
```

출력된 SQL을 Supabase Dashboard → SQL Editor에서 실행

### 5. 샘플 데이터 생성 (선택)

```bash
npm run db:seed
```

### 6. 개발 서버 시작

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

## 주요 기능

- ✅ 상품 관리 (CRUD)
- ✅ 카테고리 관리
- ✅ 장바구니
- ✅ 주문/결제 (토스페이먼츠)
- ✅ 회원 관리
- ✅ 리뷰 시스템
- ✅ 게시판 (공지사항, 자유게시판, Q&A)
- ✅ 관리자 대시보드
- ✅ 다크 모드
- ✅ 반응형 디자인
- ✅ SEO 최적화

## 프로젝트 구조

```
freecart/
├── src/
│   ├── app/              # Next.js App Router 페이지
│   ├── components/       # React 컴포넌트
│   │   └── ui/          # UI 컴포넌트
│   ├── lib/             # 유틸리티 및 라이브러리
│   │   └── supabase/    # Supabase 클라이언트
│   ├── types/           # TypeScript 타입 정의
│   ├── hooks/           # Custom React Hooks
│   ├── services/        # API 서비스
│   └── store/           # 상태 관리 (Zustand)
├── scripts/             # 스크립트
├── public/              # 정적 파일
└── themes/              # 테마
```

## 스크립트

```bash
npm run dev           # 개발 서버 시작
npm run build         # 프로덕션 빌드
npm run start         # 프로덕션 서버 시작
npm run lint          # ESLint 실행
npm run lint:fix      # ESLint 자동 수정
npm run type-check    # TypeScript 타입 체크
npm run format        # Prettier 포맷팅
npm run test          # 테스트 실행
npm run db:init       # 데이터베이스 초기화
npm run db:seed       # 샘플 데이터 생성
npm run db:check      # 데이터베이스 확인
```

## 배포

### Cloudflare Pages (무료)

1. GitHub에 푸시
2. Cloudflare Pages 대시보드에서 프로젝트 연결
3. 빌드 설정:
   - Build command: `npm run build`
   - Build output directory: `.next`
4. 환경 변수 설정
5. 배포

## 라이선스

MIT License

## 지원

- 문서: [DOCUMENTATION.md](./DOCUMENTATION.md)
- 이슈: [GitHub Issues](https://github.com/dangchani/freecart/issues)
- 커뮤니티: [Discord](https://discord.gg/freecart)
