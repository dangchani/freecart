/**
 * ThreeColumnFooter - 3컬럼 푸터
 * 회사정보 + 링크 + 고객센터
 */

import { Link } from 'react-router-dom';
import { Phone, Mail, Clock, MapPin } from 'lucide-react';

interface Props {
  siteName?: string;
  companyInfo?: {
    name?: string;
    ceo?: string;
    address?: string;
    tel?: string;
    email?: string;
    businessNumber?: string;
  };
}

export default function ThreeColumnFooter({ siteName = '', companyInfo }: Props) {
  const info = companyInfo || {};

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-3 gap-8">
          {/* 회사 정보 */}
          <div>
            <h3 className="text-white font-bold text-lg mb-4">{siteName}</h3>
            <div className="space-y-2 text-sm">
              <p>상호: {info.name}</p>
              <p>대표: {info.ceo}</p>
              <p>사업자등록번호: {info.businessNumber}</p>
              <p className="flex items-start gap-2">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                {info.address}
              </p>
            </div>
          </div>

          {/* 바로가기 */}
          <div>
            <h3 className="text-white font-bold text-lg mb-4">바로가기</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Link to="/products" className="hover:text-white">전체상품</Link>
              <Link to="/products?sort=newest" className="hover:text-white">신상품</Link>
              <Link to="/products?sort=best" className="hover:text-white">베스트</Link>
              <Link to="/products?sale=true" className="hover:text-white">세일</Link>
              <Link to="/boards" className="hover:text-white">게시판</Link>
              <Link to="/notices" className="hover:text-white">공지사항</Link>
              <Link to="/faqs" className="hover:text-white">FAQ</Link>
              <Link to="/inquiries/new" className="hover:text-white">1:1 문의</Link>
            </div>
          </div>

          {/* 고객센터 */}
          <div>
            <h3 className="text-white font-bold text-lg mb-4">고객센터</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5" />
                <div>
                  <p className="text-xl font-bold text-white">{info.tel}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Clock className="h-4 w-4" />
                <span>평일 09:00 ~ 18:00 (점심 12:00 ~ 13:00)</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4" />
                <span>{info.email}</span>
              </div>

              <div className="pt-4">
                <Link
                  to="/inquiries/new"
                  className="inline-block bg-white text-gray-900 px-6 py-2 rounded font-medium text-sm hover:bg-gray-100 transition-colors"
                >
                  1:1 문의하기
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* 하단 */}
        <div className="mt-10 pt-6 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex gap-6 text-sm">
            <Link to="/terms" className="hover:text-white">이용약관</Link>
            <Link to="/privacy" className="hover:text-white font-medium text-white">개인정보처리방침</Link>
          </div>
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} {siteName}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
