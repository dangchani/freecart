/**
 * SimpleFooter - 심플 푸터
 * 기본 정보만 표시
 */

import { Link } from 'react-router-dom';

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

export default function SimpleFooter({ siteName = '', companyInfo }: Props) {
  const info = companyInfo || {};

  return (
    <footer className="bg-gray-100 border-t">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between gap-6">
          {/* 회사 정보 */}
          <div className="text-sm text-gray-600 space-y-1">
            <p className="font-medium text-gray-900">{siteName}</p>
            <p>상호: {info.name} | 대표: {info.ceo}</p>
            <p>사업자등록번호: {info.businessNumber}</p>
            <p>주소: {info.address}</p>
            <p>고객센터: {info.tel} | 이메일: {info.email}</p>
          </div>

          {/* 링크 */}
          <div className="flex gap-6 text-sm">
            <Link to="/terms" className="text-gray-600 hover:text-gray-900">이용약관</Link>
            <Link to="/privacy" className="text-gray-600 hover:text-gray-900 font-medium">개인정보처리방침</Link>
            <Link to="/faqs" className="text-gray-600 hover:text-gray-900">FAQ</Link>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200 text-center text-xs text-gray-500">
          &copy; {new Date().getFullYear()} {siteName}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
