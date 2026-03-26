import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getSiteInfo } from '@/services/settings';

export function Footer() {
  const [info, setInfo] = useState({
    siteName: 'Freecart',
    siteDescription: '',
    companyName: '',
    companyCeo: '',
    companyAddress: '',
    companyPhone: '',
    companyEmail: '',
    companyBusinessNumber: '',
    githubUrl: '',
  });

  useEffect(() => {
    getSiteInfo().then((data) => setInfo(data));
  }, []);

  return (
    <footer className="border-t bg-gray-50">
      <div className="container py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div>
            <h3 className="mb-4 text-lg font-bold">{info.siteName}</h3>
            {info.siteDescription && (
              <p className="text-sm text-gray-600">{info.siteDescription}</p>
            )}
          </div>

          <div>
            <h4 className="mb-4 font-semibold">고객센터</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><Link to="/faqs" className="hover:text-primary">자주 묻는 질문</Link></li>
              <li><Link to="/inquiries/new" className="hover:text-primary">문의하기</Link></li>
              {info.companyPhone && <li>전화: {info.companyPhone}</li>}
              {info.companyEmail && <li>이메일: {info.companyEmail}</li>}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-semibold">정책</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><Link to="/notices" className="hover:text-primary">공지사항</Link></li>
              <li><Link to="/pages/terms" className="hover:text-primary">이용약관</Link></li>
              <li><Link to="/pages/privacy" className="hover:text-primary">개인정보처리방침</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-semibold">팔로우</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              {info.githubUrl && (
                <li><a href={info.githubUrl} target="_blank" rel="noopener noreferrer" className="hover:text-primary">GitHub</a></li>
              )}
            </ul>
          </div>
        </div>

        {/* 사업자 정보 */}
        {info.companyName && (
          <div className="mt-8 border-t pt-6 text-xs text-gray-500 space-y-1">
            <p>
              상호: {info.companyName}
              {info.companyCeo && <> | 대표: {info.companyCeo}</>}
              {info.companyBusinessNumber && <> | 사업자등록번호: {info.companyBusinessNumber}</>}
            </p>
            {info.companyAddress && <p>주소: {info.companyAddress}</p>}
          </div>
        )}

        <div className="mt-4 border-t pt-4 text-center text-sm text-gray-600">
          <p>&copy; {new Date().getFullYear()} {info.siteName}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
