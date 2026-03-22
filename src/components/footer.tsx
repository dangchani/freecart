import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t bg-gray-50">
      <div className="container py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* 회사 정보 */}
          <div>
            <h3 className="mb-4 text-lg font-bold">Freecart</h3>
            <p className="text-sm text-gray-600">무료 오픈소스 쇼핑몰 솔루션</p>
          </div>

          {/* 고객센터 */}
          <div>
            <h4 className="mb-4 font-semibold">고객센터</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>
                <Link href="/help" className="hover:text-primary">
                  도움말
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-primary">
                  자주 묻는 질문
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-primary">
                  문의하기
                </Link>
              </li>
            </ul>
          </div>

          {/* 정책 */}
          <div>
            <h4 className="mb-4 font-semibold">정책</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>
                <Link href="/terms" className="hover:text-primary">
                  이용약관
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-primary">
                  개인정보처리방침
                </Link>
              </li>
              <li>
                <Link href="/refund" className="hover:text-primary">
                  환불정책
                </Link>
              </li>
            </ul>
          </div>

          {/* 소셜 */}
          <div>
            <h4 className="mb-4 font-semibold">팔로우</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>
                <a href="https://github.com/dangchani/freecart" className="hover:text-primary">
                  GitHub
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-primary">
                  Twitter
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-primary">
                  Discord
                </a>
              </li>
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
