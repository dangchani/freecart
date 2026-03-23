#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase URL과 Service Role Key가 필요합니다.');
  console.error('   .env 파일을 확인해주세요.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function initDatabase() {
  console.log('🚀 데이터베이스 초기화를 시작합니다...\n');

  try {
    // Read the full schema SQL file
    const schemaPath = path.join(__dirname, 'db-schema-full.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log('📄 스키마 파일을 읽었습니다:', schemaPath);
    console.log('   총 크기:', (sql.length / 1024).toFixed(1), 'KB\n');

    // SQL 실행은 Supabase Dashboard에서 직접 실행해야 합니다.
    console.log('⚠️  다음 방법으로 스키마를 적용하세요:\n');
    console.log('방법 1: Supabase Dashboard → SQL Editor');
    console.log('  1. https://app.supabase.com 에서 프로젝트 선택');
    console.log('  2. SQL Editor 메뉴 클릭');
    console.log('  3. scripts/db-schema-full.sql 파일 내용을 붙여넣기 후 실행\n');

    console.log('방법 2: psql 직접 실행 (DATABASE_URL 필요)');
    console.log('  psql $DATABASE_URL -f scripts/db-schema-full.sql\n');

    console.log('방법 3: Supabase CLI 사용');
    console.log('  supabase db push --db-url $DATABASE_URL\n');

    // Optional: attempt to run via supabase rpc if available
    console.log('─'.repeat(60));
    console.log('💡 SQL 파일 위치:', schemaPath);
    console.log('─'.repeat(60));

    // Print first 20 lines as preview
    const lines = sql.split('\n').slice(0, 20);
    console.log('\n📋 스키마 미리보기 (처음 20줄):');
    lines.forEach((line, i) => console.log(`  ${String(i + 1).padStart(3)}: ${line}`));
    console.log('  ...');

    console.log('\n✅ db-schema-full.sql 파일이 준비되었습니다.');
    console.log('   위의 방법 중 하나로 Supabase에 스키마를 적용하세요.');
  } catch (error) {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  }
}

initDatabase();
