/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output 설정 (Cloudflare Pages Static Export용)
  // output: 'export', // 주석 해제 시 Static Export 활성화

  // 이미지 최적화
  images: {
    // Static Export 시 unoptimized 필요
    unoptimized: process.env.NODE_ENV === 'production',

    // 외부 이미지 도메인 허용
    domains: [
      'supabase.co',
      'via.placeholder.com',
      // Supabase Storage URL 추가
      // 예: 'your-project-id.supabase.co'
    ],

    // 이미지 형식
    formats: ['image/avif', 'image/webp'],

    // 디바이스 크기
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],

    // 이미지 크기
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],

    // 최소 캐시 시간 (초)
    minimumCacheTTL: 60,
  },

  // 리다이렉트
  async redirects() {
    return [
      {
        source: '/admin',
        destination: '/admin/dashboard',
        permanent: true,
      },
    ];
  },

  // 리라이트
  async rewrites() {
    return [
      // API Proxy (외부 API 호출 시)
      // {
      //   source: '/api/proxy/:path*',
      //   destination: 'https://external-api.com/:path*',
      // },
    ];
  },

  // 헤더
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },

  // 환경 변수
  env: {
    NEXT_PUBLIC_APP_VERSION: '1.0.0',
  },

  // 실험적 기능
  experimental: {
    // Server Actions
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // TypeScript 설정
  typescript: {
    // 프로덕션 빌드 시 타입 체크 (개발 속도 향상을 위해 false 가능)
    ignoreBuildErrors: false,
  },

  // ESLint 설정
  eslint: {
    // 프로덕션 빌드 시 ESLint 실행
    ignoreDuringBuilds: false,
  },

  // Webpack 설정
  webpack: (config, { isServer }) => {
    // 추가 Webpack 설정
    if (!isServer) {
      // 클라이언트 전용 설정
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    return config;
  },

  // Bundle Analyzer (빌드 분석)
  ...(process.env.ANALYZE === 'true' && {
    webpack: (config) => {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          reportFilename: './analyze.html',
          openAnalyzer: true,
        })
      );
      return config;
    },
  }),

  // Trailing Slash
  trailingSlash: false,

  // React Strict Mode
  reactStrictMode: true,

  // SWC Minify (빠른 빌드)
  swcMinify: true,

  // PoweredByHeader 제거
  poweredByHeader: false,

  // 압축
  compress: true,

  // 페이지 확장자
  pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx'],
};

module.exports = nextConfig;
