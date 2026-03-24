import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  const { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = await request.json();

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return NextResponse.json({ error: '모든 필드를 입력해주세요.' }, { status: 400 });
  }

  // URL 형식 검증
  try {
    new URL(supabaseUrl);
  } catch {
    return NextResponse.json({ error: 'Supabase URL 형식이 올바르지 않습니다.' }, { status: 400 });
  }

  // Supabase 연결 테스트
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { error } = await supabase.from('_test_connection').select('*').limit(1);
    // 테이블이 없는 오류(42P01)는 정상 — 연결 자체는 성공
    if (error && error.code !== '42P01' && !error.message.includes('does not exist')) {
      return NextResponse.json(
        { error: `Supabase 연결 실패: ${error.message}` },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: 'Supabase 서버에 연결할 수 없습니다. URL과 Key를 확인해주세요.' },
      { status: 400 }
    );
  }

  // 암호화 키 생성
  const encryptionKey = randomBytes(32).toString('hex');

  // .env 파일 경로 (프로젝트 루트)
  const envPath = join(process.cwd(), '.env');

  // 기존 .env 내용 읽기 (있을 경우 병합)
  let existingEnv = '';
  if (existsSync(envPath)) {
    existingEnv = readFileSync(envPath, 'utf-8');
  }

  // 기존 값을 새 값으로 교체하는 함수
  const setEnvVar = (content: string, key: string, value: string): string => {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
      return content.replace(regex, `${key}=${value}`);
    }
    return content + (content.endsWith('\n') ? '' : '\n') + `${key}=${value}\n`;
  };

  let envContent = existingEnv || '';
  envContent = setEnvVar(envContent, 'NEXT_PUBLIC_SUPABASE_URL', supabaseUrl);
  envContent = setEnvVar(envContent, 'NEXT_PUBLIC_SUPABASE_ANON_KEY', supabaseAnonKey);
  envContent = setEnvVar(envContent, 'SUPABASE_SERVICE_ROLE_KEY', supabaseServiceRoleKey);

  // ENCRYPTION_KEY가 없을 때만 새로 생성
  if (!/^ENCRYPTION_KEY=/m.test(envContent)) {
    envContent = setEnvVar(envContent, 'ENCRYPTION_KEY', encryptionKey);
  }

  // NEXT_PUBLIC_SITE_URL이 없을 때만 기본값 추가
  if (!/^NEXT_PUBLIC_SITE_URL=/m.test(envContent)) {
    envContent = setEnvVar(envContent, 'NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
  }

  writeFileSync(envPath, envContent, 'utf-8');

  return NextResponse.json({
    message:
      '.env 파일이 생성되었습니다.\n\n개발 서버를 재시작하면 설정이 적용됩니다.\n터미널에서 Ctrl+C 후 npm run dev를 다시 실행해주세요.',
  });
}
