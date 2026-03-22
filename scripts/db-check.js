#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase URL과 Service Role Key가 필요합니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDatabase() {
  console.log('🔍 데이터베이스 연결을 확인합니다...\n');

  try {
    // 테이블 목록 확인
    const tables = [
      'categories',
      'products',
      'profiles',
      'cart_items',
      'orders',
      'order_items',
      'reviews',
      'boards',
      'posts',
      'comments',
    ];

    for (const table of tables) {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`❌ ${table}: 테이블 없음 또는 접근 불가`);
      } else {
        console.log(`✅ ${table}: ${count}개 레코드`);
      }
    }

    console.log('\n✅ 데이터베이스 확인 완료!');
  } catch (error) {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  }
}

checkDatabase();
