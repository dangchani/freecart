#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

function generateEncryptionKey() {
  return crypto.randomBytes(32).toString('hex');
}

async function setup() {
  console.log('\n🚀 Freecart 프로젝트 설정을 시작합니다...\n');

  // .env 파일 존재 확인
  const envPath = path.join(process.cwd(), '.env');
  const envExamplePath = path.join(process.cwd(), '.env.example');

  if (fs.existsSync(envPath)) {
    const overwrite = await question(
      '.env 파일이 이미 존재합니다. 덮어쓰시겠습니까? (y/N): '
    );
    if (overwrite.toLowerCase() !== 'y') {
      console.log('설정을 취소합니다.');
      rl.close();
      return;
    }
  }

  // Supabase 정보 입력
  console.log('\n📦 Supabase 정보를 입력하세요:');
  const supabaseUrl = await question('Supabase URL: ');
  const supabaseAnonKey = await question('Supabase Anon Key: ');
  const supabaseServiceKey = await question('Supabase Service Role Key (선택): ');

  // 사이트 정보
  console.log('\n🌐 사이트 정보를 입력하세요:');
  const siteUrl = await question('사이트 URL (기본값: http://localhost:3000): ');
  const siteName = await question('사이트 이름 (기본값: Freecart): ');

  // .env 파일 생성
  let envContent = fs.readFileSync(envExamplePath, 'utf8');

  // 값 교체
  envContent = envContent
    .replace('https://your-project-id.supabase.co', supabaseUrl || 'https://your-project-id.supabase.co')
    .replace(/NEXT_PUBLIC_SUPABASE_ANON_KEY=.*/g, `NEXT_PUBLIC_SUPABASE_ANON_KEY=${supabaseAnonKey}`)
    .replace(/SUPABASE_SERVICE_ROLE_KEY=.*/g, `SUPABASE_SERVICE_ROLE_KEY=${supabaseServiceKey || ''}`)
    .replace('http://localhost:3000', siteUrl || 'http://localhost:3000')
    .replace('NEXT_PUBLIC_SITE_NAME=Freecart', `NEXT_PUBLIC_SITE_NAME=${siteName || 'Freecart'}`)
    .replace(/ENCRYPTION_KEY=.*/g, `ENCRYPTION_KEY=${generateEncryptionKey()}`);

  fs.writeFileSync(envPath, envContent);

  console.log('\n✅ .env 파일이 생성되었습니다!');
  console.log('\n📝 다음 단계:');
  console.log('1. npm install - 의존성 패키지 설치');
  console.log('2. npm run db:init - 데이터베이스 초기화');
  console.log('3. npm run db:seed - 샘플 데이터 생성 (선택)');
  console.log('4. npm run dev - 개발 서버 시작');

  rl.close();
}

setup().catch(console.error);
