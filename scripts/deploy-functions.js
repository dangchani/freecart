#!/usr/bin/env node

/**
 * Supabase Edge Functions 배포 스크립트
 *
 * 사용법:
 *   node scripts/deploy-functions.js           # 전체 배포
 *   node scripts/deploy-functions.js send-email  # 단일 배포
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// .env에서 VITE_SUPABASE_URL을 읽어 project-ref 추출
function getProjectRef() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env 파일을 찾을 수 없습니다. 먼저 node scripts/setup.js 를 실행하세요.');
    process.exit(1);
  }

  const env = fs.readFileSync(envPath, 'utf8');
  const match = env.match(/VITE_SUPABASE_URL=https:\/\/([a-z0-9]+)\.supabase\.co/);
  if (!match) {
    console.error('❌ .env에서 VITE_SUPABASE_URL을 찾을 수 없습니다.');
    process.exit(1);
  }

  return match[1];
}

// 배포할 함수 목록
const ALL_FUNCTIONS = [
  'verify-payment',
  'send-email',
  'issue-temp-passwords',
  'send-webhook',
  'test-integration',
  'gf-shipping-print',
  'gf-webhook-receiver',
];

function deploy(funcName, projectRef) {
  console.log(`\n📦 배포 중: ${funcName}`);
  try {
    execSync(
      `npx supabase functions deploy ${funcName} --project-ref ${projectRef} --no-verify-jwt`,
      { stdio: 'inherit' }
    );
    console.log(`✅ ${funcName} 배포 완료`);
    return true;
  } catch {
    console.error(`❌ ${funcName} 배포 실패`);
    return false;
  }
}

async function main() {
  const projectRef = getProjectRef();
  console.log(`\n🚀 Supabase Edge Functions 배포`);
  console.log(`   프로젝트: ${projectRef}`);

  // 특정 함수만 배포하는 경우
  const target = process.argv[2];
  const targets = target ? [target] : ALL_FUNCTIONS;

  if (target && !ALL_FUNCTIONS.includes(target)) {
    console.error(`❌ 알 수 없는 함수명: ${target}`);
    console.log(`사용 가능한 함수: ${ALL_FUNCTIONS.join(', ')}`);
    process.exit(1);
  }

  const results = targets.map((fn) => ({ name: fn, ok: deploy(fn, projectRef) }));

  const failed = results.filter((r) => !r.ok);
  console.log('\n─────────────────────────────────');
  if (failed.length === 0) {
    console.log(`✅ 전체 배포 완료 (${results.length}개)`);
  } else {
    console.log(`⚠️  ${results.length - failed.length}개 성공, ${failed.length}개 실패`);
    console.log(`실패한 함수: ${failed.map((r) => r.name).join(', ')}`);
    console.log('\n💡 실패 원인이 로그인 문제라면:');
    console.log('   npx supabase logout');
    console.log('   npx supabase login');
    console.log('   npm run functions:deploy');
    process.exit(1);
  }
}

main().catch(console.error);
