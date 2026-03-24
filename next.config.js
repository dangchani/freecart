/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloudflare Workers Edge Runtime 배포용
  images: {
    unoptimized: true, // Edge Runtime에서는 이미지 최적화 비활성화

    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'via.placeholder.com' },
    ],

    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },

  async redirects() {
    return [
      {
        source: '/admin',
        destination: '/admin/dashboard',
        permanent: true,
      },
    ];
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
        ],
      },
    ];
  },

  env: {
    NEXT_PUBLIC_APP_VERSION: '1.0.0',
  },

  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  typescript: {
    ignoreBuildErrors: false,
  },

  eslint: {
    ignoreDuringBuilds: false,
  },

  trailingSlash: false,
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx'],
};

// 로컬 개발 시 Cloudflare 바인딩 시뮬레이션
if (process.env.NODE_ENV === 'development') {
  const { setupDevPlatform } = require('@cloudflare/next-on-pages/next-dev');
  setupDevPlatform().catch(console.error);
}

module.exports = nextConfig;
