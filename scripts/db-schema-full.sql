-- =============================================================================
-- Freecart Full Database Schema
-- Version: 1.0.0
-- Database: Supabase (PostgreSQL)
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- HELPER: updated_at auto-update trigger function
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SECTION 1: USER SYSTEM
-- =============================================================================

-- 1.1 user_levels (회원 등급)
CREATE TABLE IF NOT EXISTS user_levels (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level           INTEGER NOT NULL UNIQUE,
  name            VARCHAR(50) NOT NULL,
  discount_rate   DECIMAL(5,2) NOT NULL DEFAULT 0,
  point_rate      DECIMAL(5,2) NOT NULL DEFAULT 0,
  min_purchase_amount INTEGER NOT NULL DEFAULT 0,
  min_purchase_count  INTEGER NOT NULL DEFAULT 0,
  description     TEXT,
  is_default      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_user_levels_updated_at
  BEFORE UPDATE ON user_levels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 1.2 users (회원)
CREATE TABLE IF NOT EXISTS users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               VARCHAR(255) NOT NULL UNIQUE,
  password_hash       VARCHAR(255),
  name                VARCHAR(100) NOT NULL,
  nickname            VARCHAR(50),
  phone               VARCHAR(20),
  profile_image       VARCHAR(500),
  level_id            UUID NOT NULL REFERENCES user_levels(id),
  points              INTEGER NOT NULL DEFAULT 0,
  deposit             INTEGER NOT NULL DEFAULT 0,
  is_email_verified   BOOLEAN NOT NULL DEFAULT false,
  is_phone_verified   BOOLEAN NOT NULL DEFAULT false,
  is_dormant          BOOLEAN NOT NULL DEFAULT false,
  is_blocked          BOOLEAN NOT NULL DEFAULT false,
  blocked_reason      TEXT,
  last_login_at       TIMESTAMPTZ,
  dormant_at          TIMESTAMPTZ,
  marketing_agreed    BOOLEAN NOT NULL DEFAULT false,
  privacy_agreed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  terms_agreed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  memo                TEXT,
  referrer_id         UUID REFERENCES users(id),
  role                VARCHAR(20) NOT NULL DEFAULT 'user',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email       ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_level_id    ON users(level_id);
CREATE INDEX IF NOT EXISTS idx_users_phone       ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_referrer_id ON users(referrer_id);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 1.3 user_social_accounts (소셜 로그인)
CREATE TABLE IF NOT EXISTS user_social_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider        VARCHAR(20) NOT NULL,
  provider_id     VARCHAR(255) NOT NULL,
  provider_email  VARCHAR(255),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_user_social_user_id ON user_social_accounts(user_id);

-- 1.4 user_addresses (배송지)
CREATE TABLE IF NOT EXISTS user_addresses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             VARCHAR(50) NOT NULL,
  recipient_name   VARCHAR(100) NOT NULL,
  recipient_phone  VARCHAR(20) NOT NULL,
  postal_code      VARCHAR(10) NOT NULL,
  address1         VARCHAR(255) NOT NULL,
  address2         VARCHAR(255),
  is_default       BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON user_addresses(user_id);

CREATE TRIGGER trg_user_addresses_updated_at
  BEFORE UPDATE ON user_addresses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 1.5 user_points_history (포인트 내역)
CREATE TABLE IF NOT EXISTS user_points_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount          INTEGER NOT NULL,
  balance         INTEGER NOT NULL,
  type            VARCHAR(30) NOT NULL,
  description     VARCHAR(255) NOT NULL,
  reference_type  VARCHAR(30),
  reference_id    UUID,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_points_user_id    ON user_points_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_points_expires_at ON user_points_history(expires_at);

-- 1.6 user_deposits_history (예치금 내역)
CREATE TABLE IF NOT EXISTS user_deposits_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount          INTEGER NOT NULL,
  balance         INTEGER NOT NULL,
  type            VARCHAR(30) NOT NULL,
  description     VARCHAR(255) NOT NULL,
  reference_type  VARCHAR(30),
  reference_id    UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_deposits_user_id ON user_deposits_history(user_id);

-- 1.7 user_attendance (출석 체크)
CREATE TABLE IF NOT EXISTS user_attendance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attended_date   DATE NOT NULL,
  points_earned   INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, attended_date)
);

CREATE INDEX IF NOT EXISTS idx_user_attendance_user_date ON user_attendance(user_id, attended_date);

-- 1.8 user_messages (쪽지)
CREATE TABLE IF NOT EXISTS user_messages (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id             UUID REFERENCES users(id) ON DELETE SET NULL,
  receiver_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title                 VARCHAR(200) NOT NULL,
  content               TEXT NOT NULL,
  is_read               BOOLEAN NOT NULL DEFAULT false,
  read_at               TIMESTAMPTZ,
  deleted_by_sender     BOOLEAN NOT NULL DEFAULT false,
  deleted_by_receiver   BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_messages_receiver ON user_messages(receiver_id, is_read, created_at DESC);

-- 1.9 notification_settings (알림 설정)
CREATE TABLE IF NOT EXISTS notification_settings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  email_order      BOOLEAN NOT NULL DEFAULT true,
  email_shipping   BOOLEAN NOT NULL DEFAULT true,
  email_marketing  BOOLEAN NOT NULL DEFAULT false,
  sms_order        BOOLEAN NOT NULL DEFAULT true,
  sms_shipping     BOOLEAN NOT NULL DEFAULT true,
  sms_marketing    BOOLEAN NOT NULL DEFAULT false,
  push_enabled     BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_notification_settings_updated_at
  BEFORE UPDATE ON notification_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SECTION 2: PRODUCT SYSTEM
-- =============================================================================

-- 2.1 product_categories (카테고리)
CREATE TABLE IF NOT EXISTS product_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   UUID REFERENCES product_categories(id),
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  image_url   VARCHAR(500),
  depth       INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_visible  BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON product_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug      ON product_categories(slug);

CREATE TRIGGER trg_product_categories_updated_at
  BEFORE UPDATE ON product_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2.2 product_brands (브랜드)
CREATE TABLE IF NOT EXISTS product_brands (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(100) NOT NULL UNIQUE,
  logo_url    VARCHAR(500),
  description TEXT,
  is_visible  BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_product_brands_updated_at
  BEFORE UPDATE ON product_brands
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2.3 products (상품)
CREATE TABLE IF NOT EXISTS products (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id           UUID NOT NULL REFERENCES product_categories(id),
  brand_id              UUID REFERENCES product_brands(id),
  name                  VARCHAR(255) NOT NULL,
  slug                  VARCHAR(255) NOT NULL UNIQUE,
  sku                   VARCHAR(100),
  summary               VARCHAR(500),
  description           TEXT,
  manufacturer          VARCHAR(100),
  origin                VARCHAR(100),
  weight                DECIMAL(10,2),
  width                 DECIMAL(10,2),
  height                DECIMAL(10,2),
  depth_cm              DECIMAL(10,2),
  regular_price         INTEGER NOT NULL,
  sale_price            INTEGER NOT NULL,
  cost_price            INTEGER,
  point_rate            DECIMAL(5,2),
  stock_quantity        INTEGER NOT NULL DEFAULT 0,
  stock_alert_quantity  INTEGER NOT NULL DEFAULT 10,
  min_purchase_quantity INTEGER NOT NULL DEFAULT 1,
  max_purchase_quantity INTEGER,
  status                VARCHAR(20) NOT NULL DEFAULT 'draft',
  is_featured           BOOLEAN NOT NULL DEFAULT false,
  is_new                BOOLEAN NOT NULL DEFAULT false,
  is_best               BOOLEAN NOT NULL DEFAULT false,
  is_sale               BOOLEAN NOT NULL DEFAULT false,
  sale_start_at         TIMESTAMPTZ,
  sale_end_at           TIMESTAMPTZ,
  view_count            INTEGER NOT NULL DEFAULT 0,
  sales_count           INTEGER NOT NULL DEFAULT 0,
  wishlist_count        INTEGER NOT NULL DEFAULT 0,
  review_count          INTEGER NOT NULL DEFAULT 0,
  review_avg            DECIMAL(3,2) NOT NULL DEFAULT 0,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  tags                  TEXT[],
  video_url             VARCHAR(500),
  has_options           BOOLEAN NOT NULL DEFAULT false,
  shipping_type         VARCHAR(20) NOT NULL DEFAULT 'default',
  shipping_fee          INTEGER,
  seo_title             VARCHAR(255),
  seo_description       VARCHAR(500),
  seo_keywords          VARCHAR(255),
  external_id           VARCHAR(100),
  external_source       VARCHAR(50),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category_id  ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_brand_id     ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_slug         ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_status       ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_external     ON products(external_source, external_id);
CREATE INDEX IF NOT EXISTS idx_products_created_at   ON products(created_at DESC);

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2.4 product_options (상품 옵션 그룹)
CREATE TABLE IF NOT EXISTS product_options (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name        VARCHAR(50) NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_options_product_id ON product_options(product_id);

-- 2.5 product_option_values (옵션 값)
CREATE TABLE IF NOT EXISTS product_option_values (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id         UUID NOT NULL REFERENCES product_options(id) ON DELETE CASCADE,
  value             VARCHAR(100) NOT NULL,
  additional_price  INTEGER NOT NULL DEFAULT 0,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_option_values_option_id ON product_option_values(option_id);

-- 2.6 product_variants (상품 변형/SKU)
CREATE TABLE IF NOT EXISTS product_variants (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku               VARCHAR(100),
  option_values     JSONB NOT NULL DEFAULT '[]',
  additional_price  INTEGER NOT NULL DEFAULT 0,
  stock_quantity    INTEGER NOT NULL DEFAULT 0,
  image_url         VARCHAR(500),
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku        ON product_variants(sku);

CREATE TRIGGER trg_product_variants_updated_at
  BEFORE UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2.7 product_images (상품 이미지)
CREATE TABLE IF NOT EXISTS product_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url         VARCHAR(500) NOT NULL,
  alt         VARCHAR(255),
  is_primary  BOOLEAN NOT NULL DEFAULT false,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id, sort_order);

-- 2.8 product_tags (상품 태그 - 별도 테이블 방식)
CREATE TABLE IF NOT EXISTS product_tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tag         VARCHAR(50) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_tags_product_id ON product_tags(product_id);
CREATE INDEX IF NOT EXISTS idx_product_tags_tag        ON product_tags(tag);

-- 2.9 product_related (관련 상품)
CREATE TABLE IF NOT EXISTS product_related (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  related_product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_related_product_id ON product_related(product_id);

-- 2.10 product_sets (세트 상품)
CREATE TABLE IF NOT EXISTS product_sets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  included_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity            INTEGER NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_sets_product_id ON product_sets(product_id);

-- 2.11 product_gifts (사은품)
CREATE TABLE IF NOT EXISTS product_gifts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  gift_product_id  UUID REFERENCES products(id) ON DELETE SET NULL,
  gift_name        VARCHAR(100) NOT NULL,
  gift_image_url   VARCHAR(500),
  is_selectable    BOOLEAN NOT NULL DEFAULT false,
  start_at         TIMESTAMPTZ,
  end_at           TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_gifts_product_id ON product_gifts(product_id);

-- 2.12 product_stock_alerts (재입고 알림)
CREATE TABLE IF NOT EXISTS product_stock_alerts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id   UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  email        VARCHAR(255),
  is_notified  BOOLEAN NOT NULL DEFAULT false,
  notified_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_stock_alerts_product ON product_stock_alerts(product_id, is_notified);

-- 2.13 product_discounts (기간/타임 할인)
CREATE TABLE IF NOT EXISTS product_discounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  discount_type   VARCHAR(20) NOT NULL,
  discount_value  INTEGER NOT NULL,
  start_at        TIMESTAMPTZ NOT NULL,
  end_at          TIMESTAMPTZ NOT NULL,
  is_timesale     BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_discounts_product_id ON product_discounts(product_id);

-- 2.14 product_level_prices (등급별 가격)
CREATE TABLE IF NOT EXISTS product_level_prices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  level_id        UUID NOT NULL REFERENCES user_levels(id) ON DELETE CASCADE,
  discount_type   VARCHAR(20) NOT NULL,
  discount_value  INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_level_prices_product_id ON product_level_prices(product_id);

-- 2.15 product_quantity_discounts (수량별 할인)
CREATE TABLE IF NOT EXISTS product_quantity_discounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  min_quantity    INTEGER NOT NULL,
  discount_type   VARCHAR(20) NOT NULL,
  discount_value  INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_quantity_discounts_product_id ON product_quantity_discounts(product_id);

-- 2.16 product_qna (상품 문의)
CREATE TABLE IF NOT EXISTS product_qna (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question     TEXT NOT NULL,
  is_secret    BOOLEAN NOT NULL DEFAULT false,
  answer       TEXT,
  answered_by  UUID,
  answered_at  TIMESTAMPTZ,
  is_visible   BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_qna_product_id ON product_qna(product_id);
CREATE INDEX IF NOT EXISTS idx_product_qna_user_id    ON product_qna(user_id);

CREATE TRIGGER trg_product_qna_updated_at
  BEFORE UPDATE ON product_qna
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2.17 product_subscriptions (정기배송 상품 설정)
CREATE TABLE IF NOT EXISTS product_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  is_available BOOLEAN NOT NULL DEFAULT false,
  plans        JSONB NOT NULL DEFAULT '[]',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- user_wishlist (찜 목록) - depends on products
CREATE TABLE IF NOT EXISTS user_wishlist (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_user_wishlist_user_product ON user_wishlist(user_id, product_id);

-- user_recently_viewed (최근 본 상품) - depends on products
CREATE TABLE IF NOT EXISTS user_recently_viewed (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  viewed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_recently_viewed_user_id ON user_recently_viewed(user_id, viewed_at DESC);

-- =============================================================================
-- SECTION 3: COUPON / POINT SYSTEM
-- =============================================================================

-- 3.1 coupons (쿠폰)
CREATE TABLE IF NOT EXISTS coupons (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  VARCHAR(50) UNIQUE,
  name                  VARCHAR(100) NOT NULL,
  description           TEXT,
  discount_type         VARCHAR(20) NOT NULL,
  discount_value        INTEGER NOT NULL,
  max_discount_amount   INTEGER,
  min_order_amount      INTEGER NOT NULL DEFAULT 0,
  total_quantity        INTEGER,
  used_quantity         INTEGER NOT NULL DEFAULT 0,
  usage_limit           INTEGER,
  usage_limit_per_user  INTEGER NOT NULL DEFAULT 1,
  used_count            INTEGER NOT NULL DEFAULT 0,
  target_type           VARCHAR(20) NOT NULL DEFAULT 'all',
  target_ids            JSONB,
  auto_issue_type       VARCHAR(30),
  starts_at             TIMESTAMPTZ NOT NULL,
  expires_at            TIMESTAMPTZ NOT NULL,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupons_code       ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_auto_issue ON coupons(auto_issue_type, is_active);

CREATE TRIGGER trg_coupons_updated_at
  BEFORE UPDATE ON coupons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3.2 user_coupons (회원 쿠폰)
CREATE TABLE IF NOT EXISTS user_coupons (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coupon_id   UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  status      VARCHAR(20) NOT NULL DEFAULT 'unused',
  is_used     BOOLEAN NOT NULL DEFAULT false,
  used_at     TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, coupon_id)
);

CREATE INDEX IF NOT EXISTS idx_user_coupons_user_id ON user_coupons(user_id, is_used);

-- =============================================================================
-- SECTION 4: CART / ORDER SYSTEM
-- =============================================================================

-- 4.1 carts (장바구니)
CREATE TABLE IF NOT EXISTS carts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id  VARCHAR(100),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carts_user_id    ON carts(user_id);
CREATE INDEX IF NOT EXISTS idx_carts_session_id ON carts(session_id);

CREATE TRIGGER trg_carts_updated_at
  BEFORE UPDATE ON carts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4.2 cart_items (장바구니 아이템)
CREATE TABLE IF NOT EXISTS cart_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id     UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id  UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity    INTEGER NOT NULL DEFAULT 1,
  selected    BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);

CREATE TRIGGER trg_cart_items_updated_at
  BEFORE UPDATE ON cart_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4.3 orders (주문)
CREATE TABLE IF NOT EXISTS orders (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number            VARCHAR(30) NOT NULL UNIQUE,
  user_id                 UUID REFERENCES users(id) ON DELETE SET NULL,
  guest_email             VARCHAR(255),
  guest_password          VARCHAR(255),
  status                  VARCHAR(30) NOT NULL DEFAULT 'pending',
  orderer_name            VARCHAR(100) NOT NULL,
  orderer_phone           VARCHAR(20) NOT NULL,
  orderer_email           VARCHAR(255),
  recipient_name          VARCHAR(100) NOT NULL,
  recipient_phone         VARCHAR(20) NOT NULL,
  postal_code             VARCHAR(10) NOT NULL,
  address1                VARCHAR(255) NOT NULL,
  address2                VARCHAR(255),
  shipping_message        VARCHAR(255),
  subtotal                INTEGER NOT NULL,
  discount_amount         INTEGER NOT NULL DEFAULT 0,
  coupon_id               UUID REFERENCES coupons(id) ON DELETE SET NULL,
  coupon_discount         INTEGER NOT NULL DEFAULT 0,
  shipping_fee            INTEGER NOT NULL DEFAULT 0,
  used_points             INTEGER NOT NULL DEFAULT 0,
  used_deposit            INTEGER NOT NULL DEFAULT 0,
  total_amount            INTEGER NOT NULL,
  earned_points           INTEGER NOT NULL DEFAULT 0,
  payment_method          VARCHAR(30),
  pg_provider             VARCHAR(30),
  is_gift                 BOOLEAN NOT NULL DEFAULT false,
  gift_message            TEXT,
  admin_memo              TEXT,
  paid_at                 TIMESTAMPTZ,
  confirmed_at            TIMESTAMPTZ,
  cancelled_at            TIMESTAMPTZ,
  cancel_reason           TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_user_id      ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status       ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at   ON orders(created_at DESC);

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4.4 order_items (주문 아이템)
CREATE TABLE IF NOT EXISTS order_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id       UUID NOT NULL REFERENCES products(id),
  variant_id       UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  product_name     VARCHAR(255) NOT NULL,
  option_text      VARCHAR(255),
  product_image    VARCHAR(500),
  unit_price       INTEGER NOT NULL,
  quantity         INTEGER NOT NULL,
  discount_amount  INTEGER NOT NULL DEFAULT 0,
  total_price      INTEGER NOT NULL,
  status           VARCHAR(30) NOT NULL DEFAULT 'pending',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id   ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

CREATE TRIGGER trg_order_items_updated_at
  BEFORE UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4.5 order_status_history (주문 상태 이력)
CREATE TABLE IF NOT EXISTS order_status_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id  UUID REFERENCES order_items(id) ON DELETE CASCADE,
  from_status    VARCHAR(30),
  to_status      VARCHAR(30) NOT NULL,
  changed_by     UUID,
  note           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id);

-- 4.6 order_memos (주문 메모)
CREATE TABLE IF NOT EXISTS order_memos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  admin_id    UUID,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_memos_order_id ON order_memos(order_id);

-- 4.7 payments (결제)
CREATE TABLE IF NOT EXISTS payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  pg_provider         VARCHAR(30) NOT NULL,
  method              VARCHAR(30) NOT NULL,
  amount              INTEGER NOT NULL,
  status              VARCHAR(20) NOT NULL DEFAULT 'pending',
  pg_tid              VARCHAR(100),
  payment_key         VARCHAR(200),
  receipt_url         VARCHAR(500),
  card_company        VARCHAR(50),
  card_number         VARCHAR(20),
  installment_months  INTEGER,
  vbank_name          VARCHAR(50),
  vbank_number        VARCHAR(50),
  vbank_holder        VARCHAR(50),
  vbank_expires_at    TIMESTAMPTZ,
  paid_at             TIMESTAMPTZ,
  failed_at           TIMESTAMPTZ,
  fail_reason         TEXT,
  raw_data            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_pg_tid   ON payments(pg_tid);

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SECTION 5: SHIPPING / RETURNS
-- =============================================================================

-- 5.1 shipping_companies (배송 업체)
CREATE TABLE IF NOT EXISTS shipping_companies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(50) NOT NULL,
  code          VARCHAR(20) NOT NULL UNIQUE,
  tracking_url  VARCHAR(500),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5.2 shipping_settings (배송비 설정)
CREATE TABLE IF NOT EXISTS shipping_settings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(50) NOT NULL,
  type             VARCHAR(20) NOT NULL,
  base_fee         INTEGER NOT NULL DEFAULT 0,
  free_threshold   INTEGER,
  weight_rates     JSONB,
  is_default       BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_shipping_settings_updated_at
  BEFORE UPDATE ON shipping_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5.3 shipping_zones (지역별 추가 배송비)
CREATE TABLE IF NOT EXISTS shipping_zones (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(50) NOT NULL,
  postal_codes     TEXT[] NOT NULL,
  additional_fee   INTEGER NOT NULL,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5.4 shipments (배송)
CREATE TABLE IF NOT EXISTS shipments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  shipping_company_id  UUID REFERENCES shipping_companies(id) ON DELETE SET NULL,
  tracking_number      VARCHAR(50),
  status               VARCHAR(20) NOT NULL DEFAULT 'pending',
  shipped_at           TIMESTAMPTZ,
  delivered_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipments_order_id    ON shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking    ON shipments(tracking_number);

CREATE TRIGGER trg_shipments_updated_at
  BEFORE UPDATE ON shipments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5.5 returns (반품)
CREATE TABLE IF NOT EXISTS returns (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_ids     JSONB NOT NULL DEFAULT '[]',
  reason       VARCHAR(100) NOT NULL,
  description  TEXT,
  status       VARCHAR(30) NOT NULL DEFAULT 'pending',
  admin_memo   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_returns_order_id ON returns(order_id);
CREATE INDEX IF NOT EXISTS idx_returns_user_id  ON returns(user_id);

-- 5.6 exchanges (교환)
CREATE TABLE IF NOT EXISTS exchanges (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_ids             JSONB NOT NULL DEFAULT '[]',
  reason               VARCHAR(100) NOT NULL,
  exchange_variant_id  UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  status               VARCHAR(30) NOT NULL DEFAULT 'pending',
  admin_memo           TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exchanges_order_id ON exchanges(order_id);
CREATE INDEX IF NOT EXISTS idx_exchanges_user_id  ON exchanges(user_id);

-- 5.7 refunds (환불)
CREATE TABLE IF NOT EXISTS refunds (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id     UUID REFERENCES order_items(id) ON DELETE SET NULL,
  payment_id        UUID REFERENCES payments(id) ON DELETE SET NULL,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type              VARCHAR(20) NOT NULL DEFAULT 'cancel',
  amount            INTEGER NOT NULL,
  points_returned   INTEGER NOT NULL DEFAULT 0,
  deposit_returned  INTEGER NOT NULL DEFAULT 0,
  reason            TEXT NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',
  pg_tid            VARCHAR(100),
  approved_by       UUID,
  approved_at       TIMESTAMPTZ,
  processed_at      TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  rejected_reason   TEXT,
  admin_memo        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_user_id  ON refunds(user_id);

-- =============================================================================
-- SECTION 6: REVIEW SYSTEM
-- =============================================================================

-- 6.1 reviews (리뷰)
CREATE TABLE IF NOT EXISTS reviews (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_item_id    UUID REFERENCES order_items(id) ON DELETE SET NULL,
  rating           INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content          TEXT NOT NULL,
  option_text      VARCHAR(255),
  video_url        VARCHAR(500),
  is_photo_review  BOOLEAN NOT NULL DEFAULT false,
  is_video_review  BOOLEAN NOT NULL DEFAULT false,
  is_best          BOOLEAN NOT NULL DEFAULT false,
  like_count       INTEGER NOT NULL DEFAULT 0,
  points_earned    INTEGER NOT NULL DEFAULT 0,
  admin_reply      TEXT,
  admin_replied_at TIMESTAMPTZ,
  is_visible       BOOLEAN NOT NULL DEFAULT true,
  is_reported      BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id, is_visible);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id    ON reviews(user_id);

CREATE TRIGGER trg_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6.2 review_images (리뷰 이미지)
CREATE TABLE IF NOT EXISTS review_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id   UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  url         VARCHAR(500) NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_images_review_id ON review_images(review_id);

-- 6.3 review_videos (리뷰 동영상)
CREATE TABLE IF NOT EXISTS review_videos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id      UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  url            VARCHAR(500) NOT NULL,
  thumbnail_url  VARCHAR(500),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_videos_review_id ON review_videos(review_id);

-- 6.4 review_likes (리뷰 좋아요)
CREATE TABLE IF NOT EXISTS review_likes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id   UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(review_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_review_likes_unique ON review_likes(review_id, user_id);

-- 6.5 review_reports (리뷰 신고)
CREATE TABLE IF NOT EXISTS review_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id   UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      VARCHAR(50) NOT NULL,
  detail      TEXT,
  status      VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_reports_review_id ON review_reports(review_id);

-- =============================================================================
-- SECTION 7: COMMUNITY / BOARD
-- =============================================================================

-- 7.1 boards (게시판)
CREATE TABLE IF NOT EXISTS boards (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(100) NOT NULL,
  slug             VARCHAR(100) NOT NULL UNIQUE,
  description      TEXT,
  type             VARCHAR(20) NOT NULL DEFAULT 'normal',
  list_level       INTEGER NOT NULL DEFAULT 0,
  read_level       INTEGER NOT NULL DEFAULT 0,
  write_level      INTEGER NOT NULL DEFAULT 1,
  comment_level    INTEGER NOT NULL DEFAULT 1,
  download_level   INTEGER NOT NULL DEFAULT 1,
  use_category     BOOLEAN NOT NULL DEFAULT false,
  use_comment      BOOLEAN NOT NULL DEFAULT true,
  use_secret       BOOLEAN NOT NULL DEFAULT false,
  use_attachment   BOOLEAN NOT NULL DEFAULT true,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  settings         JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_boards_updated_at
  BEFORE UPDATE ON boards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7.2 board_categories (게시판 카테고리)
CREATE TABLE IF NOT EXISTS board_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name        VARCHAR(50) NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_board_categories_board_id ON board_categories(board_id);

-- 7.3 posts (게시글)
CREATE TABLE IF NOT EXISTS posts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id       UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id    UUID REFERENCES board_categories(id) ON DELETE SET NULL,
  title          VARCHAR(255) NOT NULL,
  content        TEXT NOT NULL,
  view_count     INTEGER NOT NULL DEFAULT 0,
  comment_count  INTEGER NOT NULL DEFAULT 0,
  like_count     INTEGER NOT NULL DEFAULT 0,
  is_pinned      BOOLEAN NOT NULL DEFAULT false,
  is_secret      BOOLEAN NOT NULL DEFAULT false,
  is_notice      BOOLEAN NOT NULL DEFAULT false,
  is_visible     BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_board_id ON posts(board_id, is_visible, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user_id  ON posts(user_id);

CREATE TRIGGER trg_posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7.4 post_images (게시글 이미지)
CREATE TABLE IF NOT EXISTS post_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  url         VARCHAR(500) NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_images_post_id ON post_images(post_id);

-- 7.5 post_attachments (게시글 첨부파일)
CREATE TABLE IF NOT EXISTS post_attachments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id          UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  filename         VARCHAR(255) NOT NULL,
  url              VARCHAR(500) NOT NULL,
  size             INTEGER NOT NULL,
  mime_type        VARCHAR(100) NOT NULL,
  download_count   INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_attachments_post_id ON post_attachments(post_id);

-- 7.6 comments (댓글)
CREATE TABLE IF NOT EXISTS comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id   UUID REFERENCES comments(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  is_deleted  BOOLEAN NOT NULL DEFAULT false,
  is_visible  BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_post_id    ON comments(post_id, is_visible);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id  ON comments(parent_id);

CREATE TRIGGER trg_comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7.7 post_likes (게시글 추천)
CREATE TABLE IF NOT EXISTS post_likes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_unique ON post_likes(post_id, user_id);

-- =============================================================================
-- SECTION 8: CUSTOMER SUPPORT
-- =============================================================================

-- 8.1 inquiries (1:1 문의)
CREATE TABLE IF NOT EXISTS inquiries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id     UUID REFERENCES orders(id) ON DELETE SET NULL,
  category     VARCHAR(50) NOT NULL,
  title        VARCHAR(200) NOT NULL,
  content      TEXT NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'pending',
  answer       TEXT,
  answered_by  UUID,
  answered_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inquiries_user_id ON inquiries(user_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_status  ON inquiries(status);

CREATE TRIGGER trg_inquiries_updated_at
  BEFORE UPDATE ON inquiries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8.2 inquiry_images / inquiry_attachments (문의 첨부파일)
CREATE TABLE IF NOT EXISTS inquiry_attachments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id   UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  filename     VARCHAR(255) NOT NULL,
  url          VARCHAR(500) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inquiry_attachments_inquiry_id ON inquiry_attachments(inquiry_id);

-- 8.3 faqs (FAQ)
CREATE TABLE IF NOT EXISTS faqs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category    VARCHAR(50) NOT NULL,
  question    VARCHAR(500) NOT NULL,
  answer      TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_visible  BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faqs_category   ON faqs(category, is_visible);

CREATE TRIGGER trg_faqs_updated_at
  BEFORE UPDATE ON faqs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8.4 notices (공지사항)
CREATE TABLE IF NOT EXISTS notices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       VARCHAR(200) NOT NULL,
  content     TEXT NOT NULL,
  is_pinned   BOOLEAN NOT NULL DEFAULT false,
  view_count  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_notices_updated_at
  BEFORE UPDATE ON notices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SECTION 9: MARKETING
-- =============================================================================

-- 9.1 banners (배너)
CREATE TABLE IF NOT EXISTS banners (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(200) NOT NULL,
  position          VARCHAR(50) NOT NULL,
  title             VARCHAR(200),
  subtitle          VARCHAR(200),
  image_url         VARCHAR(500) NOT NULL,
  mobile_image_url  VARCHAR(500),
  link_url          VARCHAR(500),
  link_target       VARCHAR(10) NOT NULL DEFAULT '_self',
  sort_order        INTEGER NOT NULL DEFAULT 0,
  starts_at         TIMESTAMPTZ,
  ends_at           TIMESTAMPTZ,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_banners_position ON banners(position, is_active, sort_order);

CREATE TRIGGER trg_banners_updated_at
  BEFORE UPDATE ON banners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9.2 popups (팝업)
CREATE TABLE IF NOT EXISTS popups (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(200) NOT NULL,
  content           TEXT,
  image_url         VARCHAR(500),
  link_url          VARCHAR(500),
  position          VARCHAR(20) NOT NULL DEFAULT 'center',
  width             INTEGER NOT NULL DEFAULT 500,
  height            INTEGER,
  starts_at         TIMESTAMPTZ NOT NULL,
  ends_at           TIMESTAMPTZ NOT NULL,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  show_today_close  BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_popups_updated_at
  BEFORE UPDATE ON popups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9.3 events (이벤트)
CREATE TABLE IF NOT EXISTS events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          VARCHAR(200) NOT NULL,
  slug           VARCHAR(200) NOT NULL UNIQUE,
  summary        VARCHAR(500),
  content        TEXT NOT NULL,
  thumbnail_url  VARCHAR(500),
  start_at       TIMESTAMPTZ NOT NULL,
  end_at         TIMESTAMPTZ NOT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  view_count     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SECTION 10: SETTINGS / ADMIN
-- =============================================================================

-- 10.1 settings (설정)
CREATE TABLE IF NOT EXISTS settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         VARCHAR(100) NOT NULL UNIQUE,
  value       TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10.2 menus (메뉴)
CREATE TABLE IF NOT EXISTS menus (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   UUID REFERENCES menus(id) ON DELETE CASCADE,
  position    VARCHAR(30) NOT NULL DEFAULT 'header',
  name        VARCHAR(100) NOT NULL,
  url         VARCHAR(500),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_visible  BOOLEAN NOT NULL DEFAULT true,
  target      VARCHAR(10) NOT NULL DEFAULT '_self',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menus_parent_id ON menus(parent_id);

CREATE TRIGGER trg_menus_updated_at
  BEFORE UPDATE ON menus
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 10.3 terms (약관)
CREATE TABLE IF NOT EXISTS terms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        VARCHAR(30) NOT NULL,
  title       VARCHAR(200) NOT NULL,
  content     TEXT NOT NULL,
  version     VARCHAR(20) NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT true,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  effective_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_terms_type ON terms(type, is_active);

-- 10.4 content_pages (컨텐츠 페이지)
CREATE TABLE IF NOT EXISTS content_pages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            VARCHAR(200) NOT NULL,
  slug             VARCHAR(200) NOT NULL UNIQUE,
  content          TEXT NOT NULL,
  type             VARCHAR(30) NOT NULL DEFAULT 'custom',
  excerpt          VARCHAR(500),
  parent_id        UUID REFERENCES content_pages(id) ON DELETE SET NULL,
  is_visible       BOOLEAN NOT NULL DEFAULT true,
  seo_title        VARCHAR(255),
  seo_description  VARCHAR(500),
  seo_keywords     VARCHAR(255),
  view_count       INTEGER NOT NULL DEFAULT 0,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_pages_slug      ON content_pages(slug);
CREATE INDEX IF NOT EXISTS idx_content_pages_parent_id ON content_pages(parent_id);

CREATE TRIGGER trg_content_pages_updated_at
  BEFORE UPDATE ON content_pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 10.5 main_sections (메인 페이지 섹션)
CREATE TABLE IF NOT EXISTS main_sections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        VARCHAR(30) NOT NULL,
  title       VARCHAR(100) NOT NULL,
  subtitle    VARCHAR(200),
  settings    JSONB,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_main_sections_updated_at
  BEFORE UPDATE ON main_sections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 10.6 admin_logs (관리자 활동 로그)
CREATE TABLE IF NOT EXISTS admin_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id        UUID,
  action          VARCHAR(50) NOT NULL,
  resource_type   VARCHAR(50) NOT NULL,
  resource_id     UUID,
  details         JSONB,
  ip_address      VARCHAR(45),
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id   ON admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at DESC);

-- 10.7 ip_blocks (IP 차단)
CREATE TABLE IF NOT EXISTS ip_blocks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address   VARCHAR(45) NOT NULL UNIQUE,
  reason       TEXT,
  blocked_by   UUID,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10.8 visitor_logs (방문자 로그)
CREATE TABLE IF NOT EXISTS visitor_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address  VARCHAR(45) NOT NULL,
  user_agent  TEXT,
  session_id  VARCHAR(100),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  page_url    VARCHAR(500),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visitor_logs_created_at ON visitor_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_logs_user_id    ON visitor_logs(user_id);

-- =============================================================================
-- SECTION 11: SKINS
-- =============================================================================

-- 11.1 skins (스킨)
CREATE TABLE IF NOT EXISTS skins (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(100) NOT NULL,
  slug           VARCHAR(100) NOT NULL UNIQUE,
  type           VARCHAR(30) NOT NULL,
  description    TEXT,
  version        VARCHAR(20) NOT NULL,
  thumbnail_url  VARCHAR(500),
  preview_url    VARCHAR(500),
  file_path      VARCHAR(500),
  is_system      BOOLEAN NOT NULL DEFAULT false,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  settings       JSONB,
  installed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skins_slug ON skins(slug);
CREATE INDEX IF NOT EXISTS idx_skins_type ON skins(type, is_active);

CREATE TRIGGER trg_skins_updated_at
  BEFORE UPDATE ON skins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 11.2 board_skin_settings (게시판 스킨 설정)
CREATE TABLE IF NOT EXISTS board_skin_settings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id      UUID NOT NULL UNIQUE REFERENCES boards(id) ON DELETE CASCADE,
  list_skin_id  UUID REFERENCES skins(id) ON DELETE SET NULL,
  view_skin_id  UUID REFERENCES skins(id) ON DELETE SET NULL,
  settings      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_board_skin_settings_board_id ON board_skin_settings(board_id);

CREATE TRIGGER trg_board_skin_settings_updated_at
  BEFORE UPDATE ON board_skin_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 11.3 category_skin_settings (카테고리 스킨 설정)
CREATE TABLE IF NOT EXISTS category_skin_settings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id           UUID NOT NULL UNIQUE REFERENCES product_categories(id) ON DELETE CASCADE,
  product_list_skin_id  UUID REFERENCES skins(id) ON DELETE SET NULL,
  product_card_skin_id  UUID REFERENCES skins(id) ON DELETE SET NULL,
  settings              JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_category_skin_settings_category_id ON category_skin_settings(category_id);

CREATE TRIGGER trg_category_skin_settings_updated_at
  BEFORE UPDATE ON category_skin_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SECTION 12: SUBSCRIPTION SYSTEM
-- =============================================================================

-- 12.1 user_subscriptions (정기배송 구독)
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id            UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id            UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity              INTEGER NOT NULL DEFAULT 1,
  cycle                 VARCHAR(20) NOT NULL,
  interval_count        INTEGER NOT NULL DEFAULT 1,
  delivery_day          INTEGER,
  next_delivery_date    DATE NOT NULL,
  price_per_delivery    INTEGER NOT NULL,
  discount_rate         DECIMAL(5,2),
  status                VARCHAR(20) NOT NULL DEFAULT 'active',
  delivery_count        INTEGER NOT NULL DEFAULT 0,
  shipping_address_id   UUID REFERENCES user_addresses(id) ON DELETE SET NULL,
  payment_method_id     VARCHAR(255),
  pause_until           DATE,
  paused_at             TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  cancel_reason         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id       ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_product_id    ON user_subscriptions(product_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_next_delivery ON user_subscriptions(next_delivery_date, status);

CREATE TRIGGER trg_user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 12.2 subscription_deliveries (구독 배송 내역)
CREATE TABLE IF NOT EXISTS subscription_deliveries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id  UUID NOT NULL REFERENCES user_subscriptions(id) ON DELETE CASCADE,
  delivery_number  INTEGER NOT NULL DEFAULT 1,
  scheduled_date   DATE NOT NULL,
  delivered_date   DATE,
  order_id         UUID REFERENCES orders(id) ON DELETE SET NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  skip_reason      TEXT,
  failure_reason   TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_deliveries_subscription_id ON subscription_deliveries(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_deliveries_scheduled_date  ON subscription_deliveries(scheduled_date);

CREATE TRIGGER trg_subscription_deliveries_updated_at
  BEFORE UPDATE ON subscription_deliveries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SECTION 13: FINANCE
-- =============================================================================

-- 13.1 cash_receipts (현금영수증)
CREATE TABLE IF NOT EXISTS cash_receipts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           UUID REFERENCES orders(id) ON DELETE SET NULL,
  payment_id         UUID REFERENCES payments(id) ON DELETE SET NULL,
  user_id            UUID REFERENCES users(id) ON DELETE SET NULL,
  type               VARCHAR(20) NOT NULL,
  identifier_type    VARCHAR(20) NOT NULL,
  identifier         VARCHAR(50) NOT NULL,
  amount             INTEGER NOT NULL,
  approval_number    VARCHAR(50),
  status             VARCHAR(20) NOT NULL DEFAULT 'pending',
  issued_at          TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_receipts_payment_id ON cash_receipts(payment_id);
CREATE INDEX IF NOT EXISTS idx_cash_receipts_approval   ON cash_receipts(approval_number);

-- 13.2 tax_invoices (세금계산서)
CREATE TABLE IF NOT EXISTS tax_invoices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID REFERENCES orders(id) ON DELETE SET NULL,
  payment_id          UUID REFERENCES payments(id) ON DELETE SET NULL,
  user_id             UUID REFERENCES users(id) ON DELETE SET NULL,
  business_number     VARCHAR(20) NOT NULL,
  company_name        VARCHAR(100) NOT NULL,
  ceo_name            VARCHAR(100) NOT NULL,
  business_type       VARCHAR(50),
  business_category   VARCHAR(50),
  email               VARCHAR(255) NOT NULL,
  address             VARCHAR(255),
  recipient_email     VARCHAR(255),
  amount              INTEGER NOT NULL,
  tax_amount          INTEGER NOT NULL,
  total_amount        INTEGER NOT NULL,
  invoice_number      VARCHAR(50) UNIQUE,
  issue_type          VARCHAR(20) NOT NULL DEFAULT 'regular',
  approval_number     VARCHAR(50),
  status              VARCHAR(20) NOT NULL DEFAULT 'pending',
  issued_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tax_invoices_payment_id      ON tax_invoices(payment_id);
CREATE INDEX IF NOT EXISTS idx_tax_invoices_business_number ON tax_invoices(business_number);
CREATE INDEX IF NOT EXISTS idx_tax_invoices_approval        ON tax_invoices(approval_number);

-- =============================================================================
-- SECTION 14: EXTERNAL CONNECTIONS
-- =============================================================================

-- 14.1 external_connections (외부 연동 설정)
CREATE TABLE IF NOT EXISTS external_connections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform      VARCHAR(30) NOT NULL,
  name          VARCHAR(100) NOT NULL,
  config        JSONB NOT NULL DEFAULT '{}',
  credentials   JSONB NOT NULL DEFAULT '{}',
  settings      JSONB,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_sync_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_external_connections_updated_at
  BEFORE UPDATE ON external_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 14.2 sync_jobs / sync_logs (동기화 로그)
CREATE TABLE IF NOT EXISTS sync_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id   UUID NOT NULL REFERENCES external_connections(id) ON DELETE CASCADE,
  type            VARCHAR(30) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  total_count     INTEGER NOT NULL DEFAULT 0,
  success_count   INTEGER NOT NULL DEFAULT 0,
  fail_count      INTEGER NOT NULL DEFAULT 0,
  items_synced    INTEGER NOT NULL DEFAULT 0,
  errors          JSONB,
  error_message   TEXT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_connection_id ON sync_logs(connection_id);

-- 14.3 price_history (가격 변동 이력)
CREATE TABLE IF NOT EXISTS price_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id  UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  old_price   INTEGER NOT NULL,
  new_price   INTEGER NOT NULL,
  source      VARCHAR(30) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_history_product_id ON price_history(product_id, created_at DESC);

-- 14.4 stock_history (재고 변동 이력)
CREATE TABLE IF NOT EXISTS stock_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id      UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  old_quantity    INTEGER NOT NULL,
  new_quantity    INTEGER NOT NULL,
  change_type     VARCHAR(30) NOT NULL,
  reference_type  VARCHAR(30),
  reference_id    UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_history_product_id ON stock_history(product_id, created_at DESC);

-- =============================================================================
-- SECTION 15: INSTALLED THEMES & SKINS
-- =============================================================================

-- 15.1 installed_themes (설치된 테마)
CREATE TABLE IF NOT EXISTS installed_themes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            VARCHAR(100) NOT NULL UNIQUE,
  theme_slug      VARCHAR(100),
  name            VARCHAR(100) NOT NULL,
  version         VARCHAR(20) NOT NULL,
  source          VARCHAR(20) NOT NULL DEFAULT 'builtin',
  license_key     VARCHAR(255),
  file_path       VARCHAR(500),
  commit_sha      VARCHAR(40),
  deployment_id   VARCHAR(100),
  is_active       BOOLEAN NOT NULL DEFAULT false,
  installed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at    TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_installed_themes_active ON installed_themes(is_active);

CREATE TRIGGER trg_installed_themes_updated_at
  BEFORE UPDATE ON installed_themes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 15.2 installed_skins (설치된 스킨)
CREATE TABLE IF NOT EXISTS installed_skins (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skin_slug      VARCHAR(100) NOT NULL UNIQUE,
  skin_name      VARCHAR(100) NOT NULL,
  type           VARCHAR(30) NOT NULL,
  version        VARCHAR(20) NOT NULL,
  source         VARCHAR(20) NOT NULL DEFAULT 'builtin',
  license_key    VARCHAR(255),
  file_path      VARCHAR(500) NOT NULL,
  commit_sha     VARCHAR(40),
  deployment_id  VARCHAR(100),
  is_active      BOOLEAN NOT NULL DEFAULT true,
  installed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_installed_skins_slug ON installed_skins(skin_slug);
CREATE INDEX IF NOT EXISTS idx_installed_skins_type ON installed_skins(type, is_active);

CREATE TRIGGER trg_installed_skins_updated_at
  BEFORE UPDATE ON installed_skins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SECTION 16: WEBHOOKS
-- =============================================================================

-- 16.1 webhook_configs (웹훅 설정)
CREATE TABLE IF NOT EXISTS webhook_configs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  url         VARCHAR(500) NOT NULL,
  secret      VARCHAR(255),
  events      JSONB NOT NULL DEFAULT '[]',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_webhook_configs_updated_at
  BEFORE UPDATE ON webhook_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 16.2 webhook_logs (웹훅 로그)
CREATE TABLE IF NOT EXISTS webhook_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id     UUID NOT NULL REFERENCES webhook_configs(id) ON DELETE CASCADE,
  event          VARCHAR(100) NOT NULL,
  payload        JSONB NOT NULL DEFAULT '{}',
  status         VARCHAR(20) NOT NULL DEFAULT 'pending',
  response_code  INTEGER,
  response_body  TEXT,
  sent_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook_id ON webhook_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status     ON webhook_logs(status);

-- =============================================================================
-- SECTION 17: SEARCH
-- =============================================================================

-- 17.1 search_keywords (검색어)
CREATE TABLE IF NOT EXISTS search_keywords (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword          VARCHAR(100) NOT NULL UNIQUE,
  count            INTEGER NOT NULL DEFAULT 1,
  search_count     INTEGER NOT NULL DEFAULT 1,
  last_searched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_keywords_keyword ON search_keywords(keyword);
CREATE INDEX IF NOT EXISTS idx_search_keywords_count   ON search_keywords(count DESC);

CREATE TRIGGER trg_search_keywords_updated_at
  BEFORE UPDATE ON search_keywords
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 17.2 user_search_history (사용자 검색 기록)
CREATE TABLE IF NOT EXISTS user_search_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  keyword     VARCHAR(100) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_search_history_user_id ON user_search_history(user_id, created_at DESC);

-- =============================================================================
-- SECTION 18: NOTIFICATIONS
-- =============================================================================

-- 18.1 notifications (알림)
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(50) NOT NULL,
  title       VARCHAR(200) NOT NULL,
  content     TEXT NOT NULL,
  link_url    VARCHAR(500),
  is_read     BOOLEAN NOT NULL DEFAULT false,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id, is_read, created_at DESC);

-- 18.2 email_logs (이메일 발송 로그)
CREATE TABLE IF NOT EXISTS email_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  to_email       VARCHAR(255) NOT NULL,
  template       VARCHAR(50) NOT NULL,
  subject        VARCHAR(200) NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'pending',
  sent_at        TIMESTAMPTZ,
  error_message  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_user_id    ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);

-- 18.3 sms_logs (SMS 발송 로그)
CREATE TABLE IF NOT EXISTS sms_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  to_phone       VARCHAR(20) NOT NULL,
  template       VARCHAR(50) NOT NULL,
  content        TEXT NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'pending',
  sent_at        TIMESTAMPTZ,
  error_message  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_logs_user_id    ON sms_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_created_at ON sms_logs(created_at DESC);

-- =============================================================================
-- SECTION 19: DEPLOYMENT
-- =============================================================================

-- 19.1 deployment_settings (배포 설정)
CREATE TABLE IF NOT EXISTS deployment_settings (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_repo              VARCHAR(255) NOT NULL,
  github_token             TEXT NOT NULL,
  github_branch            VARCHAR(100) NOT NULL DEFAULT 'main',
  cloudflare_project_name  VARCHAR(100),
  cloudflare_account_id    VARCHAR(100),
  cloudflare_api_token     TEXT,
  auto_deploy              BOOLEAN NOT NULL DEFAULT true,
  last_deployed_at         TIMESTAMPTZ,
  last_commit_sha          VARCHAR(40),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_deployment_settings_updated_at
  BEFORE UPDATE ON deployment_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 19.2 deployment_logs (배포 로그)
CREATE TABLE IF NOT EXISTS deployment_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type             VARCHAR(20) NOT NULL,
  target_type      VARCHAR(20),
  target_id        UUID,
  target_slug      VARCHAR(100),
  commit_sha       VARCHAR(40) NOT NULL,
  commit_message   TEXT,
  deployment_id    VARCHAR(100),
  status           VARCHAR(20) NOT NULL DEFAULT 'pending',
  progress         VARCHAR(100),
  build_log        TEXT,
  deployment_url   VARCHAR(500),
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ,
  duration         INTEGER,
  triggered_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deployment_logs_status ON deployment_logs(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_deployment_logs_type   ON deployment_logs(type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deployment_logs_target ON deployment_logs(target_type, target_id);

-- =============================================================================
-- DEFAULT DATA INSERTIONS
-- =============================================================================

-- Default user_levels (회원 등급)
INSERT INTO user_levels (level, name, discount_rate, point_rate, min_purchase_amount, min_purchase_count, description, is_default)
VALUES
  (0, '신규회원', 0.00, 1.00, 0,       0,  '가입 시 자동 부여되는 기본 등급',     true),
  (1, '1등급',    1.00, 1.00, 100000,  3,  '최소 구매 10만원 또는 3회',           false),
  (2, '2등급',    2.00, 1.50, 300000,  5,  '최소 구매 30만원 또는 5회',           false),
  (3, '정회원',   3.00, 2.00, 500000,  10, '최소 구매 50만원 또는 10회',          false),
  (4, '우수회원', 5.00, 2.50, 1000000, 20, '최소 구매 100만원 또는 20회',         false),
  (5, 'VIP',      7.00, 3.00, 3000000, 50, '최소 구매 300만원 또는 50회 이상',    false)
ON CONFLICT (level) DO NOTHING;

-- Default boards (게시판)
INSERT INTO boards (name, slug, description, type, sort_order, is_active)
VALUES
  ('자유게시판',   'free',           '자유롭게 이야기를 나누는 공간입니다.',     'normal',  1, true),
  ('공지사항',     'notice',         '공지사항 및 중요 안내 게시판입니다.',       'notice',  2, true),
  ('상품리뷰',     'product-review', '구매한 상품의 리뷰를 남기는 공간입니다.',  'normal',  3, true)
ON CONFLICT (slug) DO NOTHING;

-- Default settings (사이트 기본 설정)
INSERT INTO settings (key, value, description)
VALUES
  ('site_name',               '"프리카트 쇼핑몰"',                          '사이트명'),
  ('site_description',        '"최고의 쇼핑 경험을 제공합니다."',            '사이트 설명'),
  ('site_logo',               '""',                                          '로고 이미지 URL'),
  ('site_favicon',            '""',                                          '파비콘 URL'),
  ('shipping_fee',            '3000',                                        '기본 배송비 (원)'),
  ('free_shipping_threshold', '50000',                                       '무료배송 기준 금액 (원)'),
  ('point_rate',              '1.0',                                         '기본 포인트 적립률 (%)'),
  ('point_expiry_days',       '365',                                         '포인트 유효기간 (일)'),
  ('attendance_points',       '10',                                          '출석 체크 지급 포인트'),
  ('review_points',           '100',                                         '리뷰 작성 지급 포인트'),
  ('photo_review_points',     '300',                                         '포토리뷰 작성 지급 포인트'),
  ('active_theme',            '"default-shop"',                              '현재 활성화된 테마'),
  ('default_board_skin',      '"list-basic"',                                '기본 게시판 스킨'),
  ('default_product_skin',    '"grid-basic"',                                '기본 상품 리스트 스킨')
ON CONFLICT (key) DO NOTHING;

-- Default basic board skin
INSERT INTO skins (name, slug, type, description, version, is_system, is_active)
VALUES
  ('기본 리스트 스킨',     'list-basic',    'board_list',    '기본 게시판 리스트 스킨',     '1.0.0', true, true),
  ('기본 뷰 스킨',         'view-basic',    'board_view',    '기본 게시판 상세 스킨',       '1.0.0', true, true),
  ('기본 그리드 스킨',     'grid-basic',    'product_list',  '기본 상품 그리드 스킨',       '1.0.0', true, true),
  ('기본 상품 카드 스킨',  'card-basic',    'product_card',  '기본 상품 카드 스킨',         '1.0.0', true, true)
ON CONFLICT (slug) DO NOTHING;

-- Default installed_themes (기본 테마)
INSERT INTO installed_themes (slug, name, version, source, is_active, installed_at)
VALUES ('default-shop', '기본 쇼핑몰 테마', '1.0.0', 'builtin', true, NOW())
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on main tables
ALTER TABLE users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_addresses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_points_history    ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_deposits_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_wishlist          ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_recently_viewed   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_attendance        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_coupons           ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews                ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_likes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries              ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications          ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions     ENABLE ROW LEVEL SECURITY;

-- users: users can read/update their own record
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.uid()::text = id::text);

-- user_addresses: users manage their own addresses
CREATE POLICY "user_addresses_own" ON user_addresses
  FOR ALL USING (auth.uid()::text = user_id::text);

-- user_points_history: read own history
CREATE POLICY "user_points_history_read_own" ON user_points_history
  FOR SELECT USING (auth.uid()::text = user_id::text);

-- user_deposits_history: read own history
CREATE POLICY "user_deposits_history_read_own" ON user_deposits_history
  FOR SELECT USING (auth.uid()::text = user_id::text);

-- user_wishlist: users manage their own wishlist
CREATE POLICY "user_wishlist_own" ON user_wishlist
  FOR ALL USING (auth.uid()::text = user_id::text);

-- user_recently_viewed: users manage their own recently viewed
CREATE POLICY "user_recently_viewed_own" ON user_recently_viewed
  FOR ALL USING (auth.uid()::text = user_id::text);

-- user_attendance: users read/insert their own attendance
CREATE POLICY "user_attendance_own" ON user_attendance
  FOR ALL USING (auth.uid()::text = user_id::text);

-- user_messages: users can see messages they sent or received
CREATE POLICY "user_messages_own" ON user_messages
  FOR SELECT USING (
    auth.uid()::text = receiver_id::text OR
    auth.uid()::text = sender_id::text
  );

-- notification_settings: users manage their own settings
CREATE POLICY "notification_settings_own" ON notification_settings
  FOR ALL USING (auth.uid()::text = user_id::text);

-- user_coupons: users view their own coupons
CREATE POLICY "user_coupons_read_own" ON user_coupons
  FOR SELECT USING (auth.uid()::text = user_id::text);

-- carts: users manage their own carts
CREATE POLICY "carts_own" ON carts
  FOR ALL USING (auth.uid()::text = user_id::text);

-- cart_items: users manage items in their own carts
CREATE POLICY "cart_items_own" ON cart_items
  FOR ALL USING (
    cart_id IN (
      SELECT id FROM carts WHERE user_id::text = auth.uid()::text
    )
  );

-- orders: users view their own orders
CREATE POLICY "orders_read_own" ON orders
  FOR SELECT USING (auth.uid()::text = user_id::text);

-- order_items: users view items in their own orders
CREATE POLICY "order_items_read_own" ON order_items
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM orders WHERE user_id::text = auth.uid()::text
    )
  );

-- reviews: anyone can read visible reviews; users manage their own
CREATE POLICY "reviews_read_public" ON reviews
  FOR SELECT USING (is_visible = true);

CREATE POLICY "reviews_manage_own" ON reviews
  FOR ALL USING (auth.uid()::text = user_id::text);

-- review_likes: users manage their own likes
CREATE POLICY "review_likes_own" ON review_likes
  FOR ALL USING (auth.uid()::text = user_id::text);

-- post_likes: users manage their own likes
CREATE POLICY "post_likes_own" ON post_likes
  FOR ALL USING (auth.uid()::text = user_id::text);

-- inquiries: users manage their own inquiries
CREATE POLICY "inquiries_own" ON inquiries
  FOR ALL USING (auth.uid()::text = user_id::text);

-- notifications: users read their own notifications
CREATE POLICY "notifications_read_own" ON notifications
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (auth.uid()::text = user_id::text);

-- user_subscriptions: users manage their own subscriptions
CREATE POLICY "user_subscriptions_own" ON user_subscriptions
  FOR ALL USING (auth.uid()::text = user_id::text);

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
