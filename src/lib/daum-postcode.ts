// joy: 다음 우편번호 API 동적 로더. 처음 호출 시에만 스크립트를 붙이고 이후엔 캐시 사용.
const SCRIPT_SRC = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';

declare global {
  interface Window {
    daum?: {
      Postcode: new (options: { oncomplete: (data: DaumPostcodeData) => void }) => { open: () => void };
    };
  }
}

export interface DaumPostcodeData {
  zonecode: string;
  address: string;
  roadAddress: string;
  jibunAddress: string;
  buildingName?: string;
}

let loadingPromise: Promise<void> | null = null;

export function loadDaumPostcodeScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.daum?.Postcode) return Promise.resolve();
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Daum postcode load failed')));
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadingPromise = null;
      reject(new Error('Daum postcode load failed'));
    };
    document.body.appendChild(script);
  });
  return loadingPromise;
}

export async function openDaumPostcode(onComplete: (data: DaumPostcodeData) => void): Promise<void> {
  await loadDaumPostcodeScript();
  if (!window.daum?.Postcode) throw new Error('Daum postcode not available');
  new window.daum.Postcode({
    oncomplete: (data) => onComplete(data),
  }).open();
}
