import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t bg-gray-50">
      <div className="container py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div>
            <h3 className="mb-4 text-lg font-bold">Freecart</h3>
            <p className="text-sm text-gray-600">무료 오픈소스 쇼핑몰 솔루션</p>
          </div>

          <div>
            <h4 className="mb-4 font-semibold">고객센터</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><Link to="/faqs" className="hover:text-primary">자주 묻는 질문</Link></li>
              <li><Link to="/inquiries/new" className="hover:text-primary">문의하기</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-semibold">정책</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><Link to="/notices" className="hover:text-primary">공지사항</Link></li>
              <li><a href="#" className="hover:text-primary">이용약관</a></li>
              <li><a href="#" className="hover:text-primary">개인정보처리방침</a></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-semibold">팔로우</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><a href="https://github.com/dangchani/freecart" className="hover:text-primary">GitHub</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t pt-8 text-center text-sm text-gray-600">
          <p>&copy; {new Date().getFullYear()} Freecart. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
