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

async function seedDatabase() {
  console.log('🌱 샘플 데이터를 생성합니다...\n');

  try {
    // 카테고리 생성
    console.log('📁 카테고리 생성 중...');
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .insert([
        { name: '의류', slug: 'clothing', order: 1 },
        { name: '전자제품', slug: 'electronics', order: 2 },
        { name: '도서', slug: 'books', order: 3 },
      ])
      .select();

    if (catError) throw catError;
    console.log('✅ 카테고리 생성 완료');

    // 상품 생성
    console.log('📦 상품 생성 중...');
    const { error: prodError } = await supabase.from('products').insert([
      {
        category_id: categories[0]?.id,
        name: '기본 티셔츠',
        slug: 'basic-tshirt',
        description: '편안한 기본 티셔츠',
        price: 29000,
        stock: 100,
        is_active: true,
      },
      {
        category_id: categories[1]?.id,
        name: '무선 이어폰',
        slug: 'wireless-earbuds',
        description: '고품질 무선 이어폰',
        price: 89000,
        stock: 50,
        is_active: true,
      },
    ]);

    if (prodError) throw prodError;
    console.log('✅ 상품 생성 완료');

    // 게시판 생성
    console.log('📢 게시판 생성 중...');
    const { error: boardError } = await supabase.from('boards').insert([
      { name: '공지사항', slug: 'notice' },
      { name: '자유게시판', slug: 'free' },
      { name: 'Q&A', slug: 'qna' },
    ]);

    if (boardError) throw boardError;
    console.log('✅ 게시판 생성 완료');

    console.log('\n🎉 샘플 데이터 생성이 완료되었습니다!');
  } catch (error) {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  }
}

seedDatabase();
