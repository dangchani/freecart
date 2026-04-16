import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ProviderKey = 'goodsflow' | 'ecount' | 'ppurio' | 'popbill';

interface TestResult {
  ok: boolean;
  message: string;
}

// ---------------------------------------------------------------------------
// 서비스별 연결 테스트 함수
// 새 서비스 추가 시 이 부분에 case 추가
// ---------------------------------------------------------------------------

async function testGoodsflow(creds: Record<string, string>): Promise<TestResult> {
  const { api_key_prod, api_key_test, api_base_prod, api_base_test, use_test } = creds;

  const isTest = use_test === 'true';
  const apiKey = isTest
    ? (api_key_test || api_key_prod || '')
    : (api_key_prod || '');
  if (!apiKey) return { ok: false, message: isTest ? '테스트 API Key를 입력해주세요.' : '운영 API Key를 입력해주세요.' };

  const base = isTest
    ? (api_base_test ?? '').trim().replace(/\/$/, '') || 'https://test-api.goodsflow.io'
    : (api_base_prod ?? '').trim().replace(/\/$/, '') || 'https://api.goodsflow.io';

  try {
    const res = await fetch(`${base}/api/centers`, {
      headers: { Authorization: apiKey },
    });
    if (res.ok) {
      const data = await res.json();
      const count = data?.data?.length ?? 0;
      const env = isTest ? ' [테스트 서버]' : ' [운영 서버]';
      return { ok: true, message: `연결 성공 (출고지 ${count}개)${env}` };
    }
    return { ok: false, message: `인증 실패 (${res.status}) — ${isTest ? '테스트' : '운영'} 서버` };
  } catch (e) {
    return { ok: false, message: `요청 오류: ${String(e)}` };
  }
}

async function testEcount(creds: Record<string, string>): Promise<TestResult> {
  const { company_code, user_id, api_key } = creds;
  if (!company_code || !user_id || !api_key) return { ok: false, message: '회사코드, 사용자 ID, API Key를 모두 입력해주세요.' };

  try {
    const res = await fetch('https://oapi.ecount.com/OAPI/V2/Account/GetSessionID', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ COM_CODE: company_code, USER_ID: user_id, API_CERT_KEY: api_key, LAN_TYPE: 'ko-KR', ZONE: 'A' }),
    });
    const data = await res.json();
    if (data?.Status === '200') return { ok: true, message: '연결 성공' };
    return { ok: false, message: `인증 실패: ${data?.Message || res.status}` };
  } catch (e) {
    return { ok: false, message: `요청 오류: ${String(e)}` };
  }
}

async function testPpurio(creds: Record<string, string>): Promise<TestResult> {
  const { api_key, sender_phone } = creds;
  if (!api_key || !sender_phone) return { ok: false, message: 'API Key와 발신번호를 입력해주세요.' };

  try {
    const encoded = btoa(`${api_key}:`);
    const res = await fetch('https://message.ppurio.com/v1/balance', {
      headers: { Authorization: `Basic ${encoded}` },
    });
    if (res.ok) return { ok: true, message: '연결 성공' };
    return { ok: false, message: `인증 실패 (${res.status})` };
  } catch (e) {
    return { ok: false, message: `요청 오류: ${String(e)}` };
  }
}

async function testPopbill(creds: Record<string, string>): Promise<TestResult> {
  const { link_id, secret_key, business_number } = creds;
  if (!link_id || !secret_key || !business_number) return { ok: false, message: '링크 ID, Secret Key, 사업자번호를 모두 입력해주세요.' };

  try {
    const bn = business_number.replace(/-/g, '');
    const res = await fetch(`https://api.popbill.com/EasyFin/IsMember?LinkID=${link_id}&CorpNum=${bn}`, {
      headers: { Authorization: `Bearer ${secret_key}` },
    });
    if (res.ok) return { ok: true, message: '연결 성공' };
    return { ok: false, message: `인증 실패 (${res.status})` };
  } catch (e) {
    return { ok: false, message: `요청 오류: ${String(e)}` };
  }
}

// ---------------------------------------------------------------------------
// 메인 핸들러
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const { provider_key, credentials } = await req.json() as {
      provider_key: ProviderKey;
      credentials: Record<string, string>;
    };

    let result: TestResult;

    switch (provider_key) {
      case 'goodsflow': result = await testGoodsflow(credentials); break;
      case 'ecount':    result = await testEcount(credentials);    break;
      case 'ppurio':    result = await testPpurio(credentials);    break;
      case 'popbill':   result = await testPopbill(credentials);   break;
      default:
        result = { ok: false, message: `지원하지 않는 서비스입니다: ${provider_key}` };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, message: `오류: ${String(err)}` }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
