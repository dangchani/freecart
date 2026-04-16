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
    const dropPath = path.join(__dirname, 'db-drop-all.sql');
    const schemaPath = path.join(__dirname, 'db-schema-full.sql');

    const dropSql = fs.readFileSync(dropPath, 'utf8');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('📄 파일 준비 완료:');
    console.log('   1단계 (Drop):   ', dropPath, `(${(dropSql.length / 1024).toFixed(1)} KB)`);
    console.log('   2단계 (Schema): ', schemaPath, `(${(schemaSql.length / 1024).toFixed(1)} KB)\n`);

    console.log('⚠️  아래 순서대로 실행하세요 (Drop → Full Schema):\n');

    console.log('방법 1: Supabase Dashboard → SQL Editor');
    console.log('  1. https://app.supabase.com 에서 프로젝트 선택');
    console.log('  2. SQL Editor 메뉴 클릭');
    console.log('  3. scripts/db-drop-all.sql 실행 (기존 테이블 삭제)');
    console.log('  4. scripts/db-schema-full.sql 실행 (전체 스키마 생성)\n');

    console.log('방법 2: psql 직접 실행 (DATABASE_URL 필요)');
    console.log('  psql $DATABASE_URL -f scripts/db-drop-all.sql');
    console.log('  psql $DATABASE_URL -f scripts/db-schema-full.sql\n');

    console.log('─'.repeat(60));
    console.log('⚠️  주의: db-drop-all.sql 실행 시 모든 기존 데이터가 삭제됩니다!');
    console.log('   개별 마이그레이션 파일은 기존 DB 업그레이드용입니다.');
    console.log('   신규 설치는 반드시 Drop → Full Schema 순서로 진행하세요.');
    console.log('─'.repeat(60));

    console.log('\n✅ DB 초기화 파일이 준비되었습니다.');
  } catch (error) {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  }
}

initDatabase();
