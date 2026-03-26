/**
 * NewsletterFooter - 뉴스레터 푸터
 * 이메일 구독 폼 포함
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Youtube, Send } from 'lucide-react';

interface Props {
  siteName?: string;
  companyInfo?: {
    name?: string;
    address?: string;
    tel?: string;
    email?: string;
    businessNumber?: string;
  };
}

export default function NewsletterFooter({ siteName = 'Freecart', companyInfo }: Props) {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const info = companyInfo || {};

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail('');
    }
  };

  return (
    <footer className="bg-gray-50">
      {/* 뉴스레터 섹션 */}
      <div className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="max-w-xl mx-auto text-center">
            <h3 className="text-2xl font-bold mb-2">뉴스레터 구독</h3>
            <p className="text-gray-400 mb-6">새로운 상품과 특별 할인 소식을 받아보세요</p>

            {subscribed ? (
              <p className="text-green-400">구독해 주셔서 감사합니다!</p>
            ) : (
              <form onSubmit={handleSubscribe} className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="이메일 주소"
                  className="flex-1 px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-white"
                  required
                />
                <button
                  type="submit"
                  className="px-6 py-3 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-colors flex items-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  구독
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* 메인 푸터 */}
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="grid md:grid-cols-4 gap-8">
          {/* 로고 & 소셜 */}
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-4">{siteName}</h3>
            <div className="flex gap-3">
              <a href="#" className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300 transition-colors">
                <Instagram className="h-5 w-5 text-gray-700" />
              </a>
              <a href="#" className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300 transition-colors">
                <Youtube className="h-5 w-5 text-gray-700" />
              </a>
            </div>
          </div>

          {/* 쇼핑 */}
          <div>
            <h4 className="font-bold text-gray-900 mb-4">쇼핑</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><Link to="/products" className="hover:text-gray-900">전체상품</Link></li>
              <li><Link to="/products?sort=newest" className="hover:text-gray-900">신상품</Link></li>
              <li><Link to="/products?sort=best" className="hover:text-gray-900">베스트</Link></li>
              <li><Link to="/products?sale=true" className="hover:text-gray-900">세일</Link></li>
            </ul>
          </div>

          {/* 고객지원 */}
          <div>
            <h4 className="font-bold text-gray-900 mb-4">고객지원</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><Link to="/faqs" className="hover:text-gray-900">FAQ</Link></li>
              <li><Link to="/inquiries/new" className="hover:text-gray-900">1:1 문의</Link></li>
              <li><Link to="/mypage/orders" className="hover:text-gray-900">주문조회</Link></li>
              <li><Link to="/notices" className="hover:text-gray-900">공지사항</Link></li>
            </ul>
          </div>

          {/* 연락처 */}
          <div>
            <h4 className="font-bold text-gray-900 mb-4">고객센터</h4>
            <p className="text-2xl font-bold text-gray-900 mb-2">{info.tel}</p>
            <p className="text-sm text-gray-600">평일 09:00 ~ 18:00</p>
            <p className="text-sm text-gray-600">{info.email}</p>
          </div>
        </div>

        {/* 회사 정보 */}
        <div className="mt-10 pt-6 border-t border-gray-200 text-xs text-gray-500">
          <p>상호: {info.name} | 사업자등록번호: {info.businessNumber}</p>
          <p>주소: {info.address}</p>
          <div className="flex gap-4 mt-4">
            <Link to="/terms" className="hover:text-gray-700">이용약관</Link>
            <Link to="/privacy" className="hover:text-gray-700 font-medium">개인정보처리방침</Link>
          </div>
          <p className="mt-4">&copy; {new Date().getFullYear()} {siteName}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
