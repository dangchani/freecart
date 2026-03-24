import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

export const dynamic = 'force-dynamic';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Freecart - 무료 오픈소스 쇼핑몰',
  description: '무료 오픈소스 쇼핑몰/커뮤니티 솔루션',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={inter.variable}>{children}</body>
    </html>
  );
}
