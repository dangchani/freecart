/**
 * MinimalFooter - 미니멀 푸터
 * 카피라이트만
 */

import { Link } from 'react-router-dom';

interface Props {
  siteName?: string;
}

export default function MinimalFooter({ siteName = 'Freecart' }: Props) {
  return (
    <footer className="bg-white border-t">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} {siteName}</p>
          <div className="flex gap-6">
            <Link to="/terms" className="hover:text-gray-900">이용약관</Link>
            <Link to="/privacy" className="hover:text-gray-900">개인정보처리방침</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
