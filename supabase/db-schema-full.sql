-- ==========================================
-- Freecart 초기 설정 SQL
-- ==========================================
-- Supabase Dashboard → SQL Editor에서 실행하세요.
-- 순서대로 전체를 한번에 실행하면 됩니다.
-- ==========================================

-- ==========================================
-- 1. profiles 테이블 (회원 정보)
-- ==========================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email varchar(255) NOT NULL,
  name varchar(100) NOT NULL DEFAULT '',
  phone varchar(20),
  role varchar(20) NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 회원가입 시 profiles 자동 생성 트리거
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    'user'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- 2. products 테이블 (상품)
-- ==========================================
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid,
  name varchar(255) NOT NULL,
  slug varchar(255) NOT NULL UNIQUE,
  description text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  compare_price numeric(12,2),
  cost numeric(12,2),
  stock integer NOT NULL DEFAULT 0,
  sku varchar(100),
  barcode varchar(100),
  images jsonb DEFAULT '[]'::jsonb,
  thumbnail varchar(500),
  is_active boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  options jsonb,
  variants jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_is_featured ON products(is_featured);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

-- ==========================================
-- 3. cart_items 테이블 (장바구니)
-- ==========================================
CREATE TABLE IF NOT EXISTS cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  options jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cart_items_user ON cart_items(user_id);

-- ==========================================
-- 4. orders 테이블 (주문)
-- ==========================================
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number varchar(50) NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  shipping_cost numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  shipping_address text,
  shipping_phone varchar(20),
  shipping_name varchar(100),
  payment_method varchar(50),
  status varchar(20) NOT NULL DEFAULT 'pending',
  payment_status varchar(20) NOT NULL DEFAULT 'pending',
  memo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);

-- ==========================================
-- 5. order_items 테이블 (주문 상품)
-- ==========================================
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id),
  product_name varchar(255) NOT NULL DEFAULT '',
  price numeric(12,2) NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  options jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- ==========================================
-- 6. reviews 테이블 (상품 리뷰)
-- ==========================================
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  product_slug varchar(255),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title varchar(255) NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  images jsonb DEFAULT '[]'::jsonb,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_product_slug ON reviews(product_slug);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);

-- ==========================================
-- 7. product_qna 테이블 (상품 Q&A)
-- ==========================================
CREATE TABLE IF NOT EXISTS product_qna (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  product_slug varchar(255),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  title varchar(255) NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  answer text,
  answered_at timestamptz,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_qna_slug ON product_qna(product_slug);

-- ==========================================
-- 8. popups 테이블 (팝업/배너)
-- ==========================================
CREATE TABLE IF NOT EXISTS popups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(255) NOT NULL,
  content text,
  image_url varchar(500),
  link_url varchar(500),
  position varchar(50) NOT NULL DEFAULT 'center',
  is_active boolean NOT NULL DEFAULT true,
  start_date timestamptz,
  end_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ==========================================
-- 9. settings 테이블 (사이트 설정 / DB 검증용)
-- ==========================================
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key varchar(255) NOT NULL UNIQUE,
  value jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 초기 설정값
INSERT INTO settings (key, value) VALUES
('site_name', '"Freecart"'),
('site_description', '"오픈소스 쇼핑몰 솔루션"'),
('schema_version', '"1.0.0"')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_select_all" ON settings FOR SELECT USING (true);
CREATE POLICY "settings_admin_all" ON settings FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ==========================================
-- 10. RLS (Row Level Security) 정책
-- ==========================================

-- profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- products (모든 사용자 읽기 가능)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_select_all" ON products FOR SELECT USING (true);
CREATE POLICY "products_admin_all" ON products FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- cart_items (본인 것만)
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cart_own" ON cart_items FOR ALL USING (auth.uid() = user_id);

-- orders (본인 것만 읽기, 관리자는 전체)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_select_own" ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "orders_insert_own" ON orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "orders_admin_all" ON orders FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- order_items
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items_select" ON order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
);
CREATE POLICY "order_items_insert" ON order_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
);
CREATE POLICY "order_items_admin_all" ON order_items FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- reviews (읽기: 전체, 쓰기: 본인)
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_select_all" ON reviews FOR SELECT USING (true);
CREATE POLICY "reviews_insert_own" ON reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviews_update_own" ON reviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "reviews_delete_own" ON reviews FOR DELETE USING (auth.uid() = user_id);

-- product_qna (읽기: 전체, 쓰기: 본인)
ALTER TABLE product_qna ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qna_select_all" ON product_qna FOR SELECT USING (true);
CREATE POLICY "qna_insert_own" ON product_qna FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "qna_update_own" ON product_qna FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "qna_admin_all" ON product_qna FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- popups (읽기: 전체, 쓰기: 관리자만)
ALTER TABLE popups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "popups_select_all" ON popups FOR SELECT USING (true);
CREATE POLICY "popups_admin_all" ON popups FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ==========================================
-- 11. 샘플 상품 데이터
-- ==========================================
-- 관리자 계정(admin@admin.com)은 Setup 위자드에서 자동 생성됩니다.
INSERT INTO products (name, slug, description, price, compare_price, stock, images, thumbnail, is_active, is_featured) VALUES
('기본 티셔츠', 'basic-tshirt', '편안한 기본 티셔츠입니다.', 19900, 29900, 100, '[]', null, true, true),
('슬림핏 청바지', 'slim-jeans', '스타일리시한 슬림핏 청바지입니다.', 39900, 59900, 50, '[]', null, true, true),
('캔버스 스니커즈', 'canvas-sneakers', '가벼운 캔버스 스니커즈입니다.', 49900, null, 80, '[]', null, true, false),
('니트 스웨터', 'knit-sweater', '따뜻한 니트 스웨터입니다.', 35900, 45900, 60, '[]', null, true, true),
('코튼 후드티', 'cotton-hoodie', '편안한 코튼 후드티입니다.', 42900, null, 40, '[]', null, true, false)
ON CONFLICT (slug) DO NOTHING;
