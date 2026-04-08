/**
 * OAuth 팝업 콜백 페이지
 * freecart-web이 code를 이 URL로 리다이렉트 → opener에 postMessage 후 닫힘
 */
import { useEffect } from 'react';

export default function OAuthCallbackPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (window.opener) {
      window.opener.postMessage(
        { type: 'OAUTH_CALLBACK', code, state, error },
        window.location.origin
      );
    }

    window.close();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">
      연동 처리 중...
    </div>
  );
}
