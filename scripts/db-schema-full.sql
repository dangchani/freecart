-- =============================================================================
-- Freecart Full Database Schema
-- Version: 1.0.0
-- Database: Supabase (PostgreSQL)
-- =============================================================================
-- 완전 초기화 후 실행 방법:
--   1) Supabase SQL Editor에 이 파일 전체 붙여넣기
--   2) 또는 db-drop-all.sql 먼저 실행 후 이 파일 실행
-- =============================================================================

-- 기존 테이블 전체 삭제 (초기화 시 주석 해제)
/*
DROP POLICY IF EXISTS "products_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "products_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "products_storage_delete" ON storage.objects;
DROP POLICY IF EXISTS "themes_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "themes_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "themes_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "themes_storage_delete" ON storage.objects;
DROP POLICY IF EXISTS "popups_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "popups_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "popups_storage_delete" ON storage.objects;
-- ※ 버킷 삭제는 Supabase 대시보드 → Storage에서 직접 삭제
DROP FUNCTION IF EXISTS public.admin_create_user CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column CASCADE;
DROP TABLE IF EXISTS
  user_preferences, shipping_notifications, coupon_usages, order_virtual_accounts,
  order_payments, payment_gateways, deployment_logs, deployment_settings,
  sms_logs, email_logs, notifications, user_search_history, search_keywords,
  webhook_logs, webhook_configs, installed_skins, installed_themes,
  stock_history, price_history, sync_logs, external_connections,
  tax_invoices, cash_receipts, subscription_deliveries, user_subscriptions,
  category_skin_settings, board_skin_settings, skins, visitor_logs,
  ip_blocks, admin_logs, main_sections, content_pages, terms, menus, settings,
  events, popups, banners, notices, faqs, inquiry_attachments, inquiries,
  post_likes, comments, post_attachments, post_images, posts, board_categories, boards,
  review_reports, review_likes, review_videos, review_images, reviews,
  refunds, exchanges, returns, shipments, shipping_zones, shipping_settings, shipping_companies,
  payments, order_memos, order_status_history, order_items, orders,
  cart_items, carts, user_coupons, coupons, user_recently_viewed, user_wishlist,
  product_subscriptions, product_qna, product_quantity_discounts, product_level_prices,
  product_discounts, bundle_items, product_stock_alerts, product_gift_set_items, product_gift_tiers, product_gift_sets, product_sets, product_related,
  product_attribute_values, product_attributes, product_tag_map, product_tags,
  product_images, product_variants, product_option_values, product_options, products,
  product_brands, product_categories, notification_settings, user_messages,
  user_attendance, user_deposits_history, user_points_history, user_addresses,
  user_social_accounts, users, user_levels
CASCADE;
*/

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

DROP TRIGGER IF EXISTS trg_user_levels_updated_at ON user_levels;
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

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
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

DROP TRIGGER IF EXISTS trg_user_addresses_updated_at ON user_addresses;
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

DROP TRIGGER IF EXISTS trg_notification_settings_updated_at ON notification_settings;
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

DROP TRIGGER IF EXISTS trg_product_categories_updated_at ON product_categories;
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

DROP TRIGGER IF EXISTS trg_product_brands_updated_at ON product_brands;
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
  daily_purchase_limit  INTEGER,
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
  product_type          TEXT NOT NULL DEFAULT 'single' CHECK (product_type IN ('single', 'bundle')),
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

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2.4 product_options (상품 옵션 그룹)
CREATE TABLE IF NOT EXISTS product_options (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID    NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name        VARCHAR(50) NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT true,
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
  id                    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id            UUID    NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku                   VARCHAR(100),
  option_values         JSONB   NOT NULL DEFAULT '[]',
  additional_price      INTEGER NOT NULL DEFAULT 0,
  stock_quantity        INTEGER NOT NULL DEFAULT 0,
  image_url             VARCHAR(500),
  is_active             BOOLEAN NOT NULL DEFAULT true,
  min_purchase_quantity INTEGER DEFAULT NULL CHECK (min_purchase_quantity >= 1),
  max_purchase_quantity INTEGER DEFAULT NULL CHECK (max_purchase_quantity >= 1),
  daily_purchase_limit  INTEGER DEFAULT NULL CHECK (daily_purchase_limit >= 1),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku        ON product_variants(sku);

DROP TRIGGER IF EXISTS trg_product_variants_updated_at ON product_variants;
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

-- 2.8 product_tags (태그 마스터)
CREATE TABLE IF NOT EXISTS product_tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_tags_name ON product_tags(name);

-- 2.8-1 product_tag_map (상품↔태그 매핑)
CREATE TABLE IF NOT EXISTS product_tag_map (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tag_id     UUID NOT NULL REFERENCES product_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, tag_id)
);

-- 2.8-2 product_attributes (속성 마스터 - 예: 색상, 사이즈)
CREATE TABLE IF NOT EXISTS product_attributes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.8-3 product_attribute_values (속성값 - 예: 빨강, L)
CREATE TABLE IF NOT EXISTS product_attribute_values (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_id UUID NOT NULL REFERENCES product_attributes(id) ON DELETE CASCADE,
  value        VARCHAR(100) NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_product_attr_values_attr ON product_attribute_values(attribute_id);

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

-- 2.11 product_gift_sets (사은품 세트)
CREATE TABLE IF NOT EXISTS product_gift_sets (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID         NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name        VARCHAR(200) NOT NULL,
  gift_type   TEXT         NOT NULL DEFAULT 'select'
                CHECK (gift_type IN ('select', 'auto_same', 'auto_specific')),
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  starts_at   TIMESTAMPTZ,
  ends_at     TIMESTAMPTZ,
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_gift_sets_product_id
  ON product_gift_sets(product_id);

CREATE TRIGGER trg_product_gift_sets_updated_at
  BEFORE UPDATE ON product_gift_sets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2.11-b product_gift_tiers (사은품 구간)
--   min_quantity 이상 구매 시 free_count 개 선택 가능
CREATE TABLE IF NOT EXISTS product_gift_tiers (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_set_id   UUID    NOT NULL REFERENCES product_gift_sets(id) ON DELETE CASCADE,
  min_quantity  INTEGER NOT NULL CHECK (min_quantity >= 1),
  free_count    INTEGER NOT NULL CHECK (free_count >= 1),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_gift_tiers_gift_set_id
  ON product_gift_tiers(gift_set_id);

-- 2.11-c product_gift_set_items (사은품 풀)
CREATE TABLE IF NOT EXISTS product_gift_set_items (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_set_id     UUID    NOT NULL REFERENCES product_gift_sets(id) ON DELETE CASCADE,
  gift_product_id UUID    NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (gift_set_id, gift_product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_gift_set_items_gift_set_id
  ON product_gift_set_items(gift_set_id);

-- 2.12 bundle_items (묶음상품 구성)
CREATE TABLE IF NOT EXISTS bundle_items (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_product_id UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_id        UUID        NOT NULL REFERENCES products(id),
  variant_id        UUID        REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity          INTEGER     NOT NULL CHECK (quantity >= 1),
  sort_order        INTEGER     NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bundle_items_bundle_product_id ON bundle_items(bundle_product_id);
CREATE INDEX IF NOT EXISTS idx_bundle_items_product_id        ON bundle_items(product_id);

ALTER TABLE bundle_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bundle_items_public_read" ON bundle_items;
DROP POLICY IF EXISTS "bundle_items_admin_all"   ON bundle_items;

CREATE POLICY "bundle_items_public_read" ON bundle_items FOR SELECT USING (true);
CREATE POLICY "bundle_items_admin_all"   ON bundle_items FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'super_admin'))
);

-- 2.13 product_stock_alerts (재입고 알림)
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
  id              UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID     NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  min_quantity    INTEGER  NOT NULL CHECK (min_quantity >= 1),
  discount_type   VARCHAR(20) NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value  INTEGER  NOT NULL CHECK (discount_value >= 1),
  is_active       BOOLEAN  NOT NULL DEFAULT true,
  sort_order      INTEGER  NOT NULL DEFAULT 0,
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

DROP TRIGGER IF EXISTS trg_product_qna_updated_at ON product_qna;
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
  starts_at             TIMESTAMPTZ,
  ends_at               TIMESTAMPTZ,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  is_public             BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupons_code       ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_auto_issue ON coupons(auto_issue_type, is_active);

DROP TRIGGER IF EXISTS trg_coupons_updated_at ON coupons;
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
  user_id     UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  session_id  VARCHAR(100),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carts_user_id    ON carts(user_id);
CREATE INDEX IF NOT EXISTS idx_carts_session_id ON carts(session_id);

DROP TRIGGER IF EXISTS trg_carts_updated_at ON carts;
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

DROP TRIGGER IF EXISTS trg_cart_items_updated_at ON cart_items;
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
  payment_deadline        TIMESTAMPTZ,           -- 무통장/가상계좌 입금 마감 시각 (자동취소 기준)
  auto_confirm_at         TIMESTAMPTZ,           -- 자동 구매확정 예정 시각 (배송완료 후 N일)
  is_admin_order          BOOLEAN NOT NULL DEFAULT false, -- 관리자 직접 생성 주문 여부
  returned_amount         INTEGER NOT NULL DEFAULT 0,    -- 반품 완료 후 환불된 총금액
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_user_id      ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status       ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at   ON orders(created_at DESC);

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
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
  status              VARCHAR(30) NOT NULL DEFAULT 'pending',
  item_type           TEXT NOT NULL DEFAULT 'purchase'
                        CHECK (item_type IN ('purchase', 'gift', 'bundle_component')),
  gift_set_id         UUID REFERENCES product_gift_sets(id) ON DELETE SET NULL,
  bundle_item_id      UUID REFERENCES bundle_items(id) ON DELETE SET NULL,
  returned_quantity   INTEGER NOT NULL DEFAULT 0,  -- 반품 완료된 수량
  exchanged_quantity  INTEGER NOT NULL DEFAULT 0,  -- 교환 완료된 수량
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id   ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

DROP TRIGGER IF EXISTS trg_order_items_updated_at ON order_items;
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

DROP TRIGGER IF EXISTS trg_payments_updated_at ON payments;
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

DROP TRIGGER IF EXISTS trg_shipping_settings_updated_at ON shipping_settings;
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

DROP TRIGGER IF EXISTS trg_shipments_updated_at ON shipments;
CREATE TRIGGER trg_shipments_updated_at
  BEFORE UPDATE ON shipments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5.5 returns (반품)
-- 상태값: pending → approved → collected → completed | rejected
-- initiated_by: 'customer' (마이페이지 신청) | 'admin' (관리자 직접 처리)
-- items 구조: [{order_item_id: uuid, quantity: int}]
CREATE TABLE IF NOT EXISTS returns (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  items                JSONB NOT NULL DEFAULT '[]',
  reason               VARCHAR(100) NOT NULL,
  description          TEXT,
  status               VARCHAR(30) NOT NULL DEFAULT 'pending',
  refund_amount        INTEGER NOT NULL DEFAULT 0,   -- 반품 환불금액
  refund_method        VARCHAR(30),                  -- 'card' | 'bank_transfer' | 'point' | 'deposit'
  bank_name            VARCHAR(50),                  -- 무통장 환불 계좌
  bank_account         VARCHAR(30),
  account_holder       VARCHAR(50),
  initiated_by         VARCHAR(20) NOT NULL DEFAULT 'customer',
  admin_memo           TEXT,
  tracking_number      VARCHAR(50),
  tracking_company_id  UUID REFERENCES shipping_companies(id) ON DELETE SET NULL,
  approved_at          TIMESTAMPTZ,
  collected_at         TIMESTAMPTZ,
  processed_at         TIMESTAMPTZ,
  completed_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_returns_order_id ON returns(order_id);
CREATE INDEX IF NOT EXISTS idx_returns_user_id  ON returns(user_id);

-- 5.6 exchanges (교환)
-- 상태값: pending → approved → collected → reshipped → completed | rejected
-- initiated_by: 'customer' (마이페이지 신청) | 'admin' (관리자 직접 처리)
-- items 구조: [{order_item_id: uuid, quantity: int, exchange_variant_id: uuid}]
CREATE TABLE IF NOT EXISTS exchanges (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                 UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id                  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  items                    JSONB NOT NULL DEFAULT '[]',
  reason                   VARCHAR(100) NOT NULL,
  status                   VARCHAR(30) NOT NULL DEFAULT 'pending',
  price_diff               INTEGER NOT NULL DEFAULT 0,  -- 교환 가격차이 (양수=추가결제, 음수=환불)
  initiated_by             VARCHAR(20) NOT NULL DEFAULT 'customer',
  admin_memo               TEXT,
  tracking_number          VARCHAR(50),
  tracking_company_id      UUID REFERENCES shipping_companies(id) ON DELETE SET NULL,
  reship_tracking_number   VARCHAR(50),
  reship_company_id        UUID REFERENCES shipping_companies(id) ON DELETE SET NULL,
  approved_at              TIMESTAMPTZ,
  collected_at             TIMESTAMPTZ,
  processed_at             TIMESTAMPTZ,
  reshipped_at             TIMESTAMPTZ,
  completed_at             TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  type              VARCHAR(20) NOT NULL DEFAULT 'refund',    -- refund | exchange | return
  amount            INTEGER NOT NULL,
  points_returned   INTEGER NOT NULL DEFAULT 0,
  deposit_returned  INTEGER NOT NULL DEFAULT 0,
  reason            TEXT NOT NULL,
  reason_detail     TEXT,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',
  pg_tid            VARCHAR(100),
  bank_name         VARCHAR(50),                              -- 무통장 환불 계좌
  bank_account      VARCHAR(30),
  account_holder    VARCHAR(50),
  tracking_number   VARCHAR(50),                              -- 반품 회수 운송장
  images            JSONB NOT NULL DEFAULT '[]',
  items             JSONB NOT NULL DEFAULT '[]',              -- 환불 대상 상품 목록
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

DROP TRIGGER IF EXISTS trg_reviews_updated_at ON reviews;
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

DROP TRIGGER IF EXISTS trg_boards_updated_at ON boards;
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

DROP TRIGGER IF EXISTS trg_posts_updated_at ON posts;
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

DROP TRIGGER IF EXISTS trg_comments_updated_at ON comments;
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

DROP TRIGGER IF EXISTS trg_inquiries_updated_at ON inquiries;
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

DROP TRIGGER IF EXISTS trg_faqs_updated_at ON faqs;
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

DROP TRIGGER IF EXISTS trg_notices_updated_at ON notices;
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

DROP TRIGGER IF EXISTS trg_banners_updated_at ON banners;
CREATE TRIGGER trg_banners_updated_at
  BEFORE UPDATE ON banners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9.2 popups (팝업)
CREATE TABLE IF NOT EXISTS popups (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(200) NOT NULL,
  popup_type        VARCHAR(20)  NOT NULL DEFAULT 'image'
                      CHECK (popup_type IN ('text', 'image', 'slide')),
  content           TEXT,                                 -- text 타입 전용
  image_url         VARCHAR(500),                        -- image 타입 전용
  link_url          VARCHAR(500),                        -- image 타입 전용
  slide_settings    JSONB,                               -- slide 타입 전용 설정
  position          VARCHAR(20) NOT NULL DEFAULT 'center'
                      CHECK (position IN ('center','top','bottom','left','right','custom')),
  position_x        NUMERIC(5,2),                        -- position='custom' 일 때 X% (0~100)
  position_y        NUMERIC(5,2),                        -- position='custom' 일 때 Y% (0~100)
  width             INTEGER NOT NULL DEFAULT 500,
  height            INTEGER,
  starts_at         TIMESTAMPTZ,                          -- NULL = 즉시 노출
  ends_at           TIMESTAMPTZ,                          -- NULL = 무기한 노출
  sort_order        INTEGER NOT NULL DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  show_today_close  BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_popups_updated_at ON popups;
CREATE TRIGGER trg_popups_updated_at
  BEFORE UPDATE ON popups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9.2-1 popup_images (슬라이드형 팝업 이미지 목록)
CREATE TABLE IF NOT EXISTS popup_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  popup_id    UUID,
  image_url   VARCHAR(500) NOT NULL,
  link_url    VARCHAR(500),
  caption     VARCHAR(200),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- FK 명시적 재설정 (IF NOT EXISTS로 테이블이 스킵돼도 FK 보장)
ALTER TABLE popup_images
  DROP CONSTRAINT IF EXISTS popup_images_popup_id_fkey;
ALTER TABLE popup_images
  ADD CONSTRAINT popup_images_popup_id_fkey
  FOREIGN KEY (popup_id) REFERENCES popups(id) ON DELETE CASCADE;
ALTER TABLE popup_images
  ALTER COLUMN popup_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_popup_images_popup_id ON popup_images(popup_id);

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

DROP TRIGGER IF EXISTS trg_events_updated_at ON events;
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
  menu_type   VARCHAR(20) NOT NULL DEFAULT 'link',
  -- menu_type: 'category' | 'board' | 'notice' | 'faq' | 'inquiry' | 'product_qna' | 'review' | 'link'
  name        VARCHAR(100) NOT NULL,
  url         VARCHAR(500),
  category_id UUID REFERENCES product_categories(id) ON DELETE CASCADE,
  board_id    UUID REFERENCES boards(id) ON DELETE CASCADE,
  is_system   BOOLEAN NOT NULL DEFAULT false,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_visible  BOOLEAN NOT NULL DEFAULT true,
  target      VARCHAR(10) NOT NULL DEFAULT '_self',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menus_parent_id   ON menus(parent_id);
CREATE INDEX IF NOT EXISTS idx_menus_category_id ON menus(category_id);
CREATE INDEX IF NOT EXISTS idx_menus_board_id    ON menus(board_id);

-- 같은 카테고리/게시판이 메뉴에 중복 등록되지 않도록 유니크 제약
CREATE UNIQUE INDEX IF NOT EXISTS idx_menus_unique_category_id
  ON menus(category_id) WHERE category_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_menus_unique_board_id
  ON menus(board_id) WHERE board_id IS NOT NULL;

-- 시스템 고정 메뉴 항목 (삭제 불가, 숨김만 가능)
INSERT INTO menus (menu_type, name, is_system, is_visible, sort_order, position)
SELECT 'notice',      '공지사항', true, true, 100, 'header'
WHERE NOT EXISTS (SELECT 1 FROM menus WHERE menu_type = 'notice' AND is_system = true);

INSERT INTO menus (menu_type, name, is_system, is_visible, sort_order, position)
SELECT 'faq',         'FAQ',      true, true, 110, 'header'
WHERE NOT EXISTS (SELECT 1 FROM menus WHERE menu_type = 'faq' AND is_system = true);

INSERT INTO menus (menu_type, name, is_system, is_visible, sort_order, position)
SELECT 'inquiry',     '1:1 문의', true, true, 120, 'header'
WHERE NOT EXISTS (SELECT 1 FROM menus WHERE menu_type = 'inquiry' AND is_system = true);

INSERT INTO menus (menu_type, name, is_system, is_visible, sort_order, position)
SELECT 'product_qna', '상품 Q&A', true, true, 130, 'header'
WHERE NOT EXISTS (SELECT 1 FROM menus WHERE menu_type = 'product_qna' AND is_system = true);

INSERT INTO menus (menu_type, name, is_system, is_visible, sort_order, position)
SELECT 'review',      '리뷰',     true, true, 140, 'header'
WHERE NOT EXISTS (SELECT 1 FROM menus WHERE menu_type = 'review' AND is_system = true);

DROP TRIGGER IF EXISTS trg_menus_updated_at ON menus;
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

DROP TRIGGER IF EXISTS trg_content_pages_updated_at ON content_pages;
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

DROP TRIGGER IF EXISTS trg_main_sections_updated_at ON main_sections;
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

-- joy: is_admin / is_super_admin 헬퍼 함수 사전 정의
-- (아래 RLS 정책들이 is_admin(uuid)을 참조하므로, 함수 본 정의(섹션 11)보다 먼저 선언)
CREATE OR REPLACE FUNCTION is_super_admin(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = uid AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION is_admin(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = uid AND role IN ('admin', 'super_admin')
  );
$$;

-- joy: admin_logs RLS — 관리자만 조회, 본인이 admin_id인 로그만 insert
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_logs_select_admin" ON admin_logs;
CREATE POLICY "admin_logs_select_admin" ON admin_logs
  FOR SELECT USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_logs_insert_self" ON admin_logs;
CREATE POLICY "admin_logs_insert_self" ON admin_logs
  FOR INSERT WITH CHECK (
    is_admin(auth.uid()) AND admin_id = auth.uid()
  );

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
  slug           VARCHAR(100) NOT NULL,
  type           VARCHAR(30) NOT NULL,
  description    TEXT,
  version        VARCHAR(20) NOT NULL,
  thumbnail_url  VARCHAR(500),
  preview_url    VARCHAR(500),
  file_path      VARCHAR(500),
  -- 테마 연결 (type='theme-skin'인 경우) — FK는 installed_themes 생성 후 ALTER TABLE로 추가
  theme_id       UUID,
  -- Supabase Storage URL (themes/{slug}/skins/{skinSlug}.css)
  css_url        VARCHAR(500),
  -- 출처: builtin | store | upload
  source         VARCHAR(20) NOT NULL DEFAULT 'builtin',
  license_key    VARCHAR(255),
  is_system      BOOLEAN NOT NULL DEFAULT false,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  settings       JSONB,
  installed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skins_slug    ON skins(slug);
CREATE INDEX IF NOT EXISTS idx_skins_type    ON skins(type, is_active);
CREATE INDEX IF NOT EXISTS idx_skins_theme   ON skins(theme_id);
-- 테마 스킨: 테마 내 slug 유일성 (theme_id + slug 조합)
CREATE UNIQUE INDEX IF NOT EXISTS skins_theme_slug_unique  ON skins(theme_id, slug) WHERE theme_id IS NOT NULL;
-- 페이지 스킨: 전역 slug 유일성 (theme_id IS NULL인 경우만)
CREATE UNIQUE INDEX IF NOT EXISTS skins_page_slug_unique   ON skins(slug) WHERE theme_id IS NULL;

DROP TRIGGER IF EXISTS trg_skins_updated_at ON skins;
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

DROP TRIGGER IF EXISTS trg_board_skin_settings_updated_at ON board_skin_settings;
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

DROP TRIGGER IF EXISTS trg_category_skin_settings_updated_at ON category_skin_settings;
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

DROP TRIGGER IF EXISTS trg_user_subscriptions_updated_at ON user_subscriptions;
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

DROP TRIGGER IF EXISTS trg_subscription_deliveries_updated_at ON subscription_deliveries;
CREATE TRIGGER trg_subscription_deliveries_updated_at
  BEFORE UPDATE ON subscription_deliveries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SECTION 13: FINANCE
-- (cash_receipts, tax_invoices → Section 20에서 최신 스키마로 정의)
-- =============================================================================

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

DROP TRIGGER IF EXISTS trg_external_connections_updated_at ON external_connections;
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
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             VARCHAR(100) NOT NULL UNIQUE,
  theme_slug       VARCHAR(100),
  name             VARCHAR(100) NOT NULL,
  version          VARCHAR(20) NOT NULL,
  description      TEXT,
  source           VARCHAR(20) NOT NULL DEFAULT 'builtin',
  license_key      VARCHAR(255),
  -- Supabase Storage URLs
  css_url          VARCHAR(500),
  thumbnail_url    VARCHAR(500),
  -- 레이아웃 구성 (header/footer/productCard/productGrid/homeSections/settings)
  layout_config    JSONB DEFAULT '{}',
  -- 관리자 커스텀 CSS (인라인 스타일 — 최우선 적용)
  custom_css       TEXT,
  -- CSS 변수 오버라이드 {primary, secondary, font, ...}
  css_variables    JSONB DEFAULT '{}',
  -- 테마 스크립트 목록 [{id,name,src,content,position,enabled}]
  scripts          JSONB DEFAULT '[]',
  -- 현재 활성 스킨 slug
  active_skin_slug VARCHAR(100),
  -- HTML 템플릿 섹션 URL 맵 {sectionId: storageUrl}
  section_html_urls JSONB DEFAULT '{}',
  -- 관리자 입력 콘텐츠 설정값 {variableId: value}
  theme_settings   JSONB DEFAULT '{}',
  -- settings.json 파싱 결과 (콘텐츠 편집 스키마)
  settings_schema  JSONB DEFAULT '{}',
  -- Legacy fields
  config           JSONB DEFAULT '{}',
  file_path        VARCHAR(500),
  commit_sha       VARCHAR(40),
  deployment_id    VARCHAR(100),
  is_active        BOOLEAN NOT NULL DEFAULT false,
  installed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at     TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 동시에 하나의 테마만 활성화 가능
CREATE UNIQUE INDEX IF NOT EXISTS installed_themes_single_active
  ON installed_themes (is_active)
  WHERE is_active = true;

DROP TRIGGER IF EXISTS trg_installed_themes_updated_at ON installed_themes;
CREATE TRIGGER trg_installed_themes_updated_at
  BEFORE UPDATE ON installed_themes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- skins.theme_id FK (installed_themes 생성 후 추가)
ALTER TABLE skins DROP CONSTRAINT IF EXISTS skins_theme_id_fkey;
ALTER TABLE skins
  ADD CONSTRAINT skins_theme_id_fkey
  FOREIGN KEY (theme_id) REFERENCES installed_themes(id) ON DELETE CASCADE;

-- 15.2 installed_skins (레거시 — 현재 미사용. 스킨은 skins 테이블에서 관리)
-- theme_id 컬럼으로 테마 스킨/페이지 스킨 구분
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

DROP TRIGGER IF EXISTS trg_installed_skins_updated_at ON installed_skins;
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

DROP TRIGGER IF EXISTS trg_webhook_configs_updated_at ON webhook_configs;
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

DROP TRIGGER IF EXISTS trg_search_keywords_updated_at ON search_keywords;
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

DROP TRIGGER IF EXISTS trg_deployment_settings_updated_at ON deployment_settings;
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

-- Default basic board/product skins (theme_id IS NULL → page skins, slug 전역 유일)
INSERT INTO skins (name, slug, type, description, version, is_system, is_active, source)
VALUES
  ('기본 리스트 스킨',       'list-basic',         'board_list',    '기본 게시판 리스트 스킨',        '1.0.0', true, true, 'builtin'),
  ('기본 뷰 스킨',           'view-basic',         'board_view',    '기본 게시판 상세 스킨',          '1.0.0', true, true, 'builtin'),
  ('기본 그리드 스킨',       'grid-basic',         'product_list',  '기본 상품 그리드 스킨',          '1.0.0', true, true, 'builtin'),
  ('기본 상품 카드 스킨',    'card-basic',         'product_card',  '기본 상품 카드 스킨',            '1.0.0', true, true, 'builtin'),
  ('기본 상품 상세 스킨',    'product-view-basic', 'product_view',  '기본 상품 상세 페이지 스킨',     '1.0.0', true, true, 'builtin'),
  ('기본 장바구니 스킨',     'cart-basic',         'cart',          '기본 장바구니 페이지 스킨',      '1.0.0', true, true, 'builtin'),
  ('기본 주문/결제 스킨',    'checkout-basic',     'checkout',      '기본 주문·결제 페이지 스킨',     '1.0.0', true, true, 'builtin'),
  ('기본 마이페이지 스킨',   'mypage-basic',       'mypage',        '기본 마이페이지 스킨',           '1.0.0', true, true, 'builtin')
ON CONFLICT DO NOTHING;

-- Default installed_themes (기본 테마)
INSERT INTO installed_themes (slug, name, version, source, is_active, installed_at, layout_config)
VALUES (
  'default-shop',
  '기본 쇼핑몰 테마',
  '1.0.0',
  'builtin',
  true,
  NOW(),
  '{
    "header": "mega-menu",
    "footer": "simple",
    "productCard": "magazine",
    "productGrid": "slider",
    "homeSections": [
      {"id": "hero",          "type": "custom", "style": "html", "title": "메인 배너",    "enabled": true},
      {"id": "features",      "type": "custom", "style": "html", "title": "특징 아이콘",  "enabled": true},
      {"id": "categories",    "type": "custom", "style": "html", "title": "카테고리",     "enabled": true},
      {"id": "new-products",  "type": "custom", "style": "html", "title": "신상품",       "enabled": true},
      {"id": "best-products", "type": "custom", "style": "html", "title": "베스트셀러",   "enabled": true},
      {"id": "reviews",       "type": "custom", "style": "html", "title": "고객 후기",    "enabled": true},
      {"id": "newsletter",    "type": "custom", "style": "html", "title": "뉴스레터",     "enabled": true},
      {"id": "cta",           "type": "custom", "style": "html", "title": "CTA 배너",    "enabled": false}
    ],
    "settings": {
      "headerFixed": true,
      "showBreadcrumb": true,
      "sidebarPosition": "none",
      "productImageRatio": "1:1",
      "showTopBar": true
    }
  }'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- modern-store 테마 (HTML 템플릿 기반 — 업로드 스크립트로 파일 URL 채워짐)
INSERT INTO installed_themes (slug, name, version, source, is_active, installed_at, layout_config)
VALUES (
  'modern-store',
  'Modern Store',
  '1.0.0',
  'builtin',
  false,
  NOW(),
  '{
    "header": null,
    "footer": null,
    "productCard": "basic",
    "productGrid": "grid-4",
    "homeSections": [
      {"id": "hero",         "type": "custom", "style": "html", "title": "히어로 배너",  "enabled": true},
      {"id": "features",     "type": "custom", "style": "html", "title": "특징 아이콘",  "enabled": true},
      {"id": "products",     "type": "custom", "style": "html", "title": "추천 상품",    "enabled": true},
      {"id": "banner",       "type": "custom", "style": "html", "title": "배너 2분할",   "enabled": true},
      {"id": "reviews",      "type": "custom", "style": "html", "title": "고객 후기",    "enabled": true},
      {"id": "newsletter",   "type": "custom", "style": "html", "title": "뉴스레터",     "enabled": true},
      {"id": "categories",   "type": "custom", "style": "html", "title": "카테고리",     "enabled": false},
      {"id": "cta",          "type": "custom", "style": "html", "title": "CTA 배너",    "enabled": false}
    ],
    "settings": {
      "headerFixed": true,
      "showBreadcrumb": false,
      "sidebarPosition": "none",
      "productImageRatio": "3:4"
    }
  }'::jsonb
)
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
ALTER TABLE product_gift_sets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_gift_tiers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_gift_set_items ENABLE ROW LEVEL SECURITY;

-- product_gift_sets
CREATE POLICY "gift_sets_select_public" ON product_gift_sets
  FOR SELECT USING (true);
CREATE POLICY "gift_sets_modify_admin" ON product_gift_sets
  FOR ALL USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- product_gift_tiers
CREATE POLICY "gift_tiers_select_public" ON product_gift_tiers
  FOR SELECT USING (true);
CREATE POLICY "gift_tiers_modify_admin" ON product_gift_tiers
  FOR ALL USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- product_gift_set_items
CREATE POLICY "gift_set_items_select_public" ON product_gift_set_items
  FOR SELECT USING (true);
CREATE POLICY "gift_set_items_modify_admin" ON product_gift_set_items
  FOR ALL USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- product_quantity_discounts
ALTER TABLE product_quantity_discounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qty_discounts_select_public" ON product_quantity_discounts
  FOR SELECT USING (true);
CREATE POLICY "qty_discounts_modify_admin" ON product_quantity_discounts
  FOR ALL USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- main 충돌
-- admin 여부 확인 함수 (main, 인자 없음)
-- 이 함수는 role = 'admin'만 인식하고 super_admin을 누락.
-- joy 블록의 is_admin(uid UUID) 함수가 admin/super_admin 모두 처리하므로 해당 버전만 사용.
-- CREATE OR REPLACE FUNCTION public.is_admin()
-- RETURNS boolean
-- LANGUAGE sql
-- SECURITY DEFINER
-- STABLE
-- AS $$
--   SELECT EXISTS (
--     SELECT 1 FROM public.users
--     WHERE id::text = auth.uid()::text
--     AND role = 'admin'
--   );
-- $$;

-- users: users can read/update/insert their own record
DROP POLICY IF EXISTS "users_select_own" ON users;
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

DROP POLICY IF EXISTS "users_insert_own" ON users;
CREATE POLICY "users_insert_own" ON users
  FOR INSERT WITH CHECK (auth.uid()::text = id::text);

DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.uid()::text = id::text);

-- main 충돌
-- 관리자: 전체 회원 조회/수정 허용 (main)
-- public.is_admin() (인자 없음, 'admin'만 true)에 의존하여 super_admin을 누락.
-- 담당자 토글(enable_user_assignment) ON 상태에서 admin이 담당 외 사용자까지 조회 가능해져
-- 아래 users_select_admin / users_update_admin (can_manage_user 기반) 정책과 충돌.
-- joy 블록만 사용하도록 주석 처리.
-- DROP POLICY IF EXISTS "admin_select_all_users" ON users;
-- CREATE POLICY "admin_select_all_users" ON users
--   FOR SELECT USING (public.is_admin());
--
-- DROP POLICY IF EXISTS "admin_update_any_user" ON users;
-- CREATE POLICY "admin_update_any_user" ON users
--   FOR UPDATE USING (public.is_admin());

-- joy: users_select_admin / users_update_admin 정책은 can_manage_user() 함수가
-- 정의된 이후(joy 블록 하단)에 생성됩니다. 참조 순서 문제로 여기서는 생성하지 않음.

-- user_addresses: users manage their own addresses
DROP POLICY IF EXISTS "user_addresses_own" ON user_addresses;
CREATE POLICY "user_addresses_own" ON user_addresses
  FOR ALL USING (auth.uid()::text = user_id::text);

-- joy: 관리자(admin/super_admin)는 모든 회원의 주소를 조회/수정 가능
DROP POLICY IF EXISTS "user_addresses_admin_all" ON user_addresses;
CREATE POLICY "user_addresses_admin_all" ON user_addresses
  FOR ALL USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- user_points_history: read own history
DROP POLICY IF EXISTS "user_points_history_read_own" ON user_points_history;
CREATE POLICY "user_points_history_read_own" ON user_points_history
  FOR SELECT USING (auth.uid()::text = user_id::text);

-- user_deposits_history: read own history
DROP POLICY IF EXISTS "user_deposits_history_read_own" ON user_deposits_history;
CREATE POLICY "user_deposits_history_read_own" ON user_deposits_history
  FOR SELECT USING (auth.uid()::text = user_id::text);

-- user_wishlist: users manage their own wishlist
DROP POLICY IF EXISTS "user_wishlist_own" ON user_wishlist;
CREATE POLICY "user_wishlist_own" ON user_wishlist
  FOR ALL USING (auth.uid()::text = user_id::text);

-- user_recently_viewed: users manage their own recently viewed
DROP POLICY IF EXISTS "user_recently_viewed_own" ON user_recently_viewed;
CREATE POLICY "user_recently_viewed_own" ON user_recently_viewed
  FOR ALL USING (auth.uid()::text = user_id::text);

-- user_attendance: users read/insert their own attendance
DROP POLICY IF EXISTS "user_attendance_own" ON user_attendance;
CREATE POLICY "user_attendance_own" ON user_attendance
  FOR ALL USING (auth.uid()::text = user_id::text);

-- user_messages: users can see messages they sent or received
DROP POLICY IF EXISTS "user_messages_own" ON user_messages;
CREATE POLICY "user_messages_own" ON user_messages
  FOR SELECT USING (
    auth.uid()::text = receiver_id::text OR
    auth.uid()::text = sender_id::text
  );

-- notification_settings: users manage their own settings
DROP POLICY IF EXISTS "notification_settings_own" ON notification_settings;
CREATE POLICY "notification_settings_own" ON notification_settings
  FOR ALL USING (auth.uid()::text = user_id::text);

-- user_coupons: users view their own coupons
DROP POLICY IF EXISTS "user_coupons_read_own" ON user_coupons;
CREATE POLICY "user_coupons_read_own" ON user_coupons
  FOR SELECT USING (auth.uid()::text = user_id::text);

-- carts: users manage their own carts
DROP POLICY IF EXISTS "carts_own" ON carts;
CREATE POLICY "carts_own" ON carts
  FOR ALL
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

-- cart_items: users manage items in their own carts
DROP POLICY IF EXISTS "cart_items_own" ON cart_items;
CREATE POLICY "cart_items_own" ON cart_items
  FOR ALL
  USING (
    cart_id IN (SELECT id FROM carts WHERE user_id::text = auth.uid()::text)
  )
  WITH CHECK (
    cart_id IN (SELECT id FROM carts WHERE user_id::text = auth.uid()::text)
  );

-- orders: users view/insert their own orders; admins manage all
DROP POLICY IF EXISTS "orders_read_own" ON orders;
CREATE POLICY "orders_read_own" ON orders
  FOR SELECT USING (
    auth.uid()::text = user_id::text
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

DROP POLICY IF EXISTS "orders_insert_own" ON orders;
CREATE POLICY "orders_insert_own" ON orders
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "orders_update_admin" ON orders;
CREATE POLICY "orders_update_admin" ON orders
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

DROP POLICY IF EXISTS "orders_update_own" ON orders;
CREATE POLICY "orders_update_own" ON orders
  FOR UPDATE USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

-- shipments: 관리자 전체 관리, 사용자는 자신 주문의 배송정보 조회
DROP POLICY IF EXISTS "shipments_read_own" ON shipments;
CREATE POLICY "shipments_read_own" ON shipments
  FOR SELECT USING (
    order_id IN (SELECT id FROM orders WHERE user_id::text = auth.uid()::text)
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

DROP POLICY IF EXISTS "shipments_manage_admin" ON shipments;
CREATE POLICY "shipments_manage_admin" ON shipments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- order_items: users view/insert items in their own orders; admins manage all
DROP POLICY IF EXISTS "order_items_read_own" ON order_items;
CREATE POLICY "order_items_read_own" ON order_items
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM orders WHERE user_id::text = auth.uid()::text
    )
    OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "order_items_insert_own" ON order_items;
CREATE POLICY "order_items_insert_own" ON order_items
  FOR INSERT WITH CHECK (
    order_id IN (
      SELECT id FROM orders WHERE user_id::text = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "order_items_manage_admin" ON order_items;
CREATE POLICY "order_items_manage_admin" ON order_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- reviews: anyone can read visible reviews; users manage their own
DROP POLICY IF EXISTS "reviews_read_public" ON reviews;
CREATE POLICY "reviews_read_public" ON reviews
  FOR SELECT USING (is_visible = true);

DROP POLICY IF EXISTS "reviews_manage_own" ON reviews;
CREATE POLICY "reviews_manage_own" ON reviews
  FOR ALL USING (auth.uid()::text = user_id::text);

-- review_likes: users manage their own likes
DROP POLICY IF EXISTS "review_likes_own" ON review_likes;
CREATE POLICY "review_likes_own" ON review_likes
  FOR ALL USING (auth.uid()::text = user_id::text);

-- post_likes: users manage their own likes
DROP POLICY IF EXISTS "post_likes_own" ON post_likes;
CREATE POLICY "post_likes_own" ON post_likes
  FOR ALL USING (auth.uid()::text = user_id::text);

-- inquiries: users manage their own inquiries
DROP POLICY IF EXISTS "inquiries_own" ON inquiries;
CREATE POLICY "inquiries_own" ON inquiries
  FOR ALL USING (auth.uid()::text = user_id::text);

-- notifications: users read their own notifications
DROP POLICY IF EXISTS "notifications_read_own" ON notifications;
CREATE POLICY "notifications_read_own" ON notifications
  FOR SELECT USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (auth.uid()::text = user_id::text);

-- user_subscriptions: users manage their own subscriptions
DROP POLICY IF EXISTS "user_subscriptions_own" ON user_subscriptions;
CREATE POLICY "user_subscriptions_own" ON user_subscriptions
  FOR ALL USING (auth.uid()::text = user_id::text);

-- =============================================================================
-- AUTO CREATE USER PROFILE ON SIGNUP (Supabase Auth Trigger)
-- =============================================================================

-- Function: 회원가입 시 자동으로 public.users에 프로필 생성
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_level_id UUID;
BEGIN
  -- 기본 회원 등급 조회 (is_default = true)
  SELECT id INTO default_level_id FROM public.user_levels WHERE is_default = true LIMIT 1;

  -- 기본 등급이 없으면 첫 번째 등급 사용
  IF default_level_id IS NULL THEN
    SELECT id INTO default_level_id FROM public.user_levels ORDER BY level ASC LIMIT 1;
  END IF;

  -- public.users에 새 레코드 생성
  INSERT INTO public.users (
    id,
    email,
    name,
    level_id,
    role,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    default_level_id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    NOW(),
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: auth.users에 새 유저 생성 시 실행
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 이메일 인증 자동 완료 (rate limit 방지)
CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      updated_at = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_auto_confirm ON auth.users;
CREATE TRIGGER on_auth_user_auto_confirm
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_user();

-- =============================================================================
-- SECTION 11: PAYMENT GATEWAYS (PG사 설정)
-- =============================================================================

-- PG사 설정 테이블
CREATE TABLE IF NOT EXISTS payment_gateways (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     VARCHAR(30) NOT NULL UNIQUE,  -- 'toss', 'inicis', 'kiwoom', 'nicepay', 'kcp'
  name         VARCHAR(100) NOT NULL,
  client_key   VARCHAR(500),                 -- 공개키 (프론트에서 사용)
  secret_key   VARCHAR(500),                 -- 비밀키 (Edge Function에서만 사용)
  is_active    BOOLEAN NOT NULL DEFAULT false,
  settings     JSONB,                        -- PG사별 추가 설정 (mid, 상점아이디 등)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_payment_gateways_updated_at ON payment_gateways;
CREATE TRIGGER trg_payment_gateways_updated_at
  BEFORE UPDATE ON payment_gateways
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: 관리자만 수정 가능, 공개키는 누구나 조회 가능
ALTER TABLE payment_gateways ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_gateways_select" ON payment_gateways;
CREATE POLICY "payment_gateways_select" ON payment_gateways
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "payment_gateways_admin" ON payment_gateways;
CREATE POLICY "payment_gateways_admin" ON payment_gateways
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- =============================================================================
-- SECTION 20: MISSING TABLES (코드에서 참조하지만 스키마에 누락된 테이블)
-- =============================================================================

-- 20.1 order_payments (주문 결제 내역 - 부분결제/다중결제 지원)
CREATE TABLE IF NOT EXISTS order_payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_id       UUID REFERENCES payments(id),
  method           VARCHAR(30) NOT NULL,
  amount           INTEGER NOT NULL DEFAULT 0,
  status           VARCHAR(20) NOT NULL DEFAULT 'pending',
  pg_provider      VARCHAR(30),
  pg_transaction_id VARCHAR(100),
  paid_at          TIMESTAMPTZ,
  cancelled_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_payments_order_id   ON order_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_payments_payment_id ON order_payments(payment_id);

DROP TRIGGER IF EXISTS trg_order_payments_updated_at ON order_payments;
CREATE TRIGGER trg_order_payments_updated_at
  BEFORE UPDATE ON order_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 20.2 order_virtual_accounts (가상계좌 정보)
CREATE TABLE IF NOT EXISTS order_virtual_accounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  bank_code        VARCHAR(10) NOT NULL,
  bank_name        VARCHAR(50) NOT NULL,
  account_number   VARCHAR(50) NOT NULL,
  holder_name      VARCHAR(100) NOT NULL,
  amount           INTEGER NOT NULL,
  expires_at       TIMESTAMPTZ NOT NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'waiting',
  deposited_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_virtual_accounts_order_id ON order_virtual_accounts(order_id);

DROP TRIGGER IF EXISTS trg_order_virtual_accounts_updated_at ON order_virtual_accounts;
CREATE TRIGGER trg_order_virtual_accounts_updated_at
  BEFORE UPDATE ON order_virtual_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 20.3 coupon_usages (쿠폰 사용 내역)
CREATE TABLE IF NOT EXISTS coupon_usages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id        UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id         UUID REFERENCES orders(id) ON DELETE SET NULL,
  user_coupon_id   UUID REFERENCES user_coupons(id) ON DELETE SET NULL,
  discount_amount  INTEGER NOT NULL DEFAULT 0,
  used_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupon_usages_coupon_id      ON coupon_usages(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_user_id        ON coupon_usages(user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_order_id       ON coupon_usages(order_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_user_coupon_id ON coupon_usages(user_coupon_id);

-- 20.4 shipping_notifications (배송 알림 설정)
CREATE TABLE IF NOT EXISTS shipping_notifications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type             VARCHAR(20) NOT NULL DEFAULT 'all',
  is_active        BOOLEAN NOT NULL DEFAULT true,
  notify_shipped   BOOLEAN NOT NULL DEFAULT true,
  notify_delivered BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(order_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_shipping_notifications_order_id ON shipping_notifications(order_id);

DROP TRIGGER IF EXISTS trg_shipping_notifications_updated_at ON shipping_notifications;
CREATE TRIGGER trg_shipping_notifications_updated_at
  BEFORE UPDATE ON shipping_notifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 20.5 user_preferences (사용자 환경설정)
CREATE TABLE IF NOT EXISTS user_preferences (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  language         VARCHAR(10) NOT NULL DEFAULT 'ko',
  currency         VARCHAR(10) NOT NULL DEFAULT 'KRW',
  theme            VARCHAR(20) NOT NULL DEFAULT 'light',
  settings         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

DROP TRIGGER IF EXISTS trg_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER trg_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 20.6 cash_receipts (현금영수증)
CREATE TABLE IF NOT EXISTS cash_receipts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id         UUID        REFERENCES users(id) ON DELETE SET NULL,
  receipt_type    VARCHAR(20) NOT NULL
                  CHECK (receipt_type IN ('income_deduction', 'business_expense')),
  identifier_type VARCHAR(20) NOT NULL
                  CHECK (identifier_type IN ('phone', 'business_number', 'card')),
  identifier      VARCHAR(30) NOT NULL,
  amount          INTEGER     NOT NULL,
  pg_provider     VARCHAR(30),
  pg_receipt_id   VARCHAR(100),
  issued_at       TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  status               VARCHAR(20) NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'issued', 'cancelled', 'failed')),
  original_receipt_id  UUID REFERENCES cash_receipts(id) ON DELETE SET NULL,  -- 반품 후 재발행 시 원본 영수증
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_receipts_order_id ON cash_receipts(order_id);
CREATE INDEX IF NOT EXISTS idx_cash_receipts_status   ON cash_receipts(status);

DROP TRIGGER IF EXISTS trg_cash_receipts_updated_at ON cash_receipts;
CREATE TRIGGER trg_cash_receipts_updated_at
  BEFORE UPDATE ON cash_receipts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 20.7 tax_invoices (세금계산서)
CREATE TABLE IF NOT EXISTS tax_invoices (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID         NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id           UUID         REFERENCES users(id) ON DELETE SET NULL,
  business_name     VARCHAR(100) NOT NULL,
  business_number   VARCHAR(20)  NOT NULL,
  ceo_name          VARCHAR(50),
  business_address  VARCHAR(255),
  business_type     VARCHAR(50),
  business_item     VARCHAR(50),
  manager_name      VARCHAR(50),
  manager_email     VARCHAR(100),
  supply_amount     INTEGER      NOT NULL,
  tax_amount        INTEGER      NOT NULL,
  total_amount      INTEGER      NOT NULL,
  nts_result_code   VARCHAR(10),
  nts_issued_at     TIMESTAMPTZ,
  invoice_number    VARCHAR(50),
  issue_type        VARCHAR(20)  NOT NULL DEFAULT 'electronic'
                    CHECK (issue_type IN ('electronic', 'manual')),
  status               VARCHAR(20)  NOT NULL DEFAULT 'requested'
                       CHECK (status IN ('requested', 'issued', 'cancelled', 'failed')),
  admin_memo           TEXT,
  original_invoice_id  UUID REFERENCES tax_invoices(id) ON DELETE SET NULL,  -- 반품 후 재발행 시 원본 계산서
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tax_invoices_order_id        ON tax_invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_tax_invoices_business_number ON tax_invoices(business_number);
CREATE INDEX IF NOT EXISTS idx_tax_invoices_status          ON tax_invoices(status);

DROP TRIGGER IF EXISTS trg_tax_invoices_updated_at ON tax_invoices;
CREATE TRIGGER trg_tax_invoices_updated_at
  BEFORE UPDATE ON tax_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SEED DATA: 기본 데이터
-- =============================================================================

-- 기본 택배사 목록
INSERT INTO shipping_companies (name, code, tracking_url, is_active, sort_order) VALUES
  ('CJ대한통운',   'cj',       'https://trace.cjlogistics.com/web/detail.jsp?slipno={tracking_number}',     true, 1),
  ('한진택배',     'hanjin',   'https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&schLang=KR&wblnumList={tracking_number}', true, 2),
  ('롯데택배',     'lotte',    'https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo={tracking_number}', true, 3),
  ('우체국택배',   'epost',    'https://service.epost.go.kr/trace.RetrieveEmsRiaList.retrieveEmsRiaList.comm?sid1={tracking_number}', true, 4),
  ('로젠택배',     'logen',    'https://www.ilogen.com/web/personal/trace/{tracking_number}',                true, 5),
  ('경동택배',     'kdexp',    'https://kdexp.com/newDeliverySearch.kd?barcode={tracking_number}',          true, 6),
  ('대신택배',     'daeshin',  'https://www.ds3211.co.kr/freight/internalFreightSearch.ht?billno={tracking_number}', true, 7),
  ('일양로지스',   'ilyang',   'https://www.ilyanglogis.com/functionality/tracking_result.asp?hawb_no={tracking_number}', true, 8),
  ('GSPostbox',   'gspostbox', 'https://www.gspostbox.kr/contents/inquiry/search.do?delivery_no={tracking_number}', true, 9),
  ('쿠팡로켓배송', 'coupang',  '',                                                                          true, 10)
ON CONFLICT (code) DO NOTHING;

-- 기본 회원 등급
INSERT INTO user_levels (level, name, is_default, description)
VALUES (1, '일반회원', true, '기본 회원 등급')
ON CONFLICT (level) DO NOTHING;

-- 최고 관리자 프로필 (auth.users에 가입된 경우 자동 연결)
INSERT INTO users (id, email, name, level_id, role)
SELECT
  au.id,
  au.email,
  '최고관리자',
  (SELECT id FROM user_levels WHERE is_default = true LIMIT 1),
  'admin'
FROM auth.users au
WHERE au.email = 'admin@admin.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- 기본 사이트 설정 (모든 설정은 settings 테이블에서 관리)
INSERT INTO settings (key, value, description) VALUES
  ('site_name', '"Freecart"', '사이트 이름'),
  ('site_description', '"무료 오픈소스 쇼핑몰 솔루션"', '사이트 설명'),
  ('company_name', '""', '상호 (회사명)'),
  ('company_ceo', '""', '대표자명'),
  ('company_address', '""', '사업장 주소'),
  ('company_phone', '""', '대표전화'),
  ('company_email', '""', '대표 이메일'),
  ('company_business_number', '""', '사업자등록번호'),
  ('github_url', '""', 'GitHub 저장소 URL'),
  ('site_url', '""', '배포된 사이트 URL (Cloudflare Pages)'),
  ('installed_at', '""', '최초 설치 일시'),
  ('shipping_fee', '3000', '기본 배송비 (원)'),
  ('free_shipping_threshold', '50000', '무료배송 기준금액 (원)'),
  ('point_earn_rate', '1', '기본 포인트 적립률 (%)'),
  ('auto_confirm_days', '7', '배송완료 후 자동 구매확정까지 일수'),
  ('signup_points', '1000', '회원가입 포인트 (P)'),
  ('points_min_threshold', '1000', '포인트 사용 최소 보유량 (P)'),
  ('points_unit_amount', '100', '포인트 사용 단위 (원)'),
  ('points_max_usage_percent', '50', '포인트 최대 사용 비율 (%)'),
  ('store_api_url', '"https://freecart.kr"', '테마/스킨 스토어 API URL'),
  ('naver_client_id', '""', '네이버 소셜 로그인 Client ID'),
  -- 이메일 인증 / SMTP 설정
  ('supabase_access_token', '""', 'Supabase Personal Access Token (Management API 용)'),
  ('email_confirm_required', '"false"', '이메일 인증 필수 여부 (true/false)'),
  ('smtp_host', '""', 'SMTP 호스트 (비어있으면 Supabase 기본 메일 사용)'),
  ('smtp_port', '"587"', 'SMTP 포트'),
  ('smtp_user', '""', 'SMTP 사용자명'),
  ('smtp_pass', '""', 'SMTP 비밀번호 또는 API Key'),
  ('smtp_sender_name', '""', '발신자 이름'),
  ('smtp_sender_email', '""', '발신자 이메일'),
  -- 무통장입금 설정
  ('bank_transfer_enabled', '"false"', '무통장입금 사용 여부'),
  ('bank_transfer_bank_name', '""', '은행명'),
  ('bank_transfer_account_number', '""', '계좌번호'),
  ('bank_transfer_account_holder', '""', '예금주'),
  ('bank_transfer_deadline_hours', '"24"', '입금 기한 (시간)'),
  ('resend_api_key',             '""',                   'Resend API Key (이메일 발송용)'),
  ('notification_from_email',    '"noreply@example.com"','알림 발신 이메일 주소'),
  ('notification_from_name',     '"프리카트"',            '알림 발신자 이름'),
  ('notification_email_enabled', '"true"',               '이메일 알림 활성화 여부 (true/false)'),
  ('email_provider',             '"resend"',             '트랜잭션 이메일 발송 방식 (resend | smtp)')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- ADMIN UTILITY FUNCTIONS
-- =============================================================================

-- 관리자 회원 직접 생성 (이메일 발송 없이 auth.users에 직접 삽입)
-- 사용 이유: Supabase 무료 플랜 이메일 rate limit 우회
-- on_auth_user_created 트리거가 public.users 레코드를 자동 생성함
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email       TEXT,
  p_password    TEXT,
  p_name        TEXT,
  p_phone       TEXT DEFAULT NULL,
  p_login_id    TEXT DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
DECLARE
  new_id uuid;
BEGIN
  new_id := gen_random_uuid();

  INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    aud,
    role,
    created_at,
    updated_at
  ) VALUES (
    new_id,
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    jsonb_build_object('name', p_name, 'phone', COALESCE(p_phone, '')),
    'authenticated',
    'authenticated',
    now(),
    now()
  );

  -- joy: login_id가 전달된 경우 users 테이블에 반영
  IF p_login_id IS NOT NULL AND p_login_id != '' THEN
    UPDATE public.users SET login_id = p_login_id WHERE id = new_id;
  END IF;

  RETURN new_id;
END;
$$;

-- =============================================================================
-- AUTH USERS SYNC
-- auth.users에 이미 존재하는 유저를 public.users에 동기화
-- (DB 초기화 후 기존 계정 복구용 - on_auth_user_created 트리거 미실행 보완)
-- =============================================================================

INSERT INTO public.users (id, email, name, role, level_id, created_at, updated_at)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
  COALESCE(au.raw_user_meta_data->>'role', 'user'),
  (SELECT id FROM public.user_levels ORDER BY level ASC LIMIT 1),
  au.created_at,
  NOW()
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- joy: 자동 super_admin 승격 블록은 is_approved 컬럼이 추가된 뒤 실행되어야 하므로
-- 스키마 끝부분(joy 권한 블록 뒤)으로 이동했습니다.

-- joy: 전체 회원을 user로 강등한 뒤 원하는 계정만 super_admin으로 재지정하고 싶을 때 사용.
-- 운영 중 자동 실행되지 않도록 주석 상태로 유지. 필요 시 아래 블록의 주석을 풀고 이메일만 변경해 실행.
-- /*
-- UPDATE public.users SET role = 'user';
-- UPDATE auth.users
-- SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role":"user"}'::jsonb;
--
-- UPDATE public.users
-- SET role = 'super_admin', is_approved = true
-- WHERE email = 'joy@lob.kr';
--
-- UPDATE auth.users
-- SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role":"super_admin"}'::jsonb
-- WHERE email = 'joy@lob.kr';
-- */

-- =============================================================================
-- STORAGE BUCKETS
-- =============================================================================

-- 상품 이미지 버킷 (공개)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'products',
  'products',
  true,
  10485760,  -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 상품 이미지 버킷 RLS: 누구나 조회 가능
DROP POLICY IF EXISTS "products_storage_select" ON storage.objects;
CREATE POLICY "products_storage_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'products');

-- 상품 이미지 버킷 RLS: 인증된 사용자만 업로드/삭제
DROP POLICY IF EXISTS "products_storage_insert" ON storage.objects;
CREATE POLICY "products_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'products' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "products_storage_delete" ON storage.objects;
CREATE POLICY "products_storage_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'products' AND auth.role() = 'authenticated');

-- 테마 에셋 버킷 (CSS, 썸네일, 스킨 CSS 등 — 공개)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'themes',
  'themes',
  true,
  5242880,  -- 5MB
  ARRAY['text/css', 'image/jpeg', 'image/png', 'image/webp', 'application/zip']
)
ON CONFLICT (id) DO NOTHING;

-- 테마 버킷 RLS: 누구나 조회 (CSS, 썸네일 공개 접근)
DROP POLICY IF EXISTS "themes_storage_select" ON storage.objects;
CREATE POLICY "themes_storage_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'themes');

-- 테마 버킷 RLS: 인증된 사용자만 업로드 (관리자 업로드)
DROP POLICY IF EXISTS "themes_storage_insert" ON storage.objects;
CREATE POLICY "themes_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'themes' AND auth.role() = 'authenticated');

-- 테마 버킷 RLS: 인증된 사용자만 업데이트
DROP POLICY IF EXISTS "themes_storage_update" ON storage.objects;
CREATE POLICY "themes_storage_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'themes' AND auth.role() = 'authenticated');

-- 테마 버킷 RLS: 인증된 사용자만 삭제
DROP POLICY IF EXISTS "themes_storage_delete" ON storage.objects;
CREATE POLICY "themes_storage_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'themes' AND auth.role() = 'authenticated');

-- 팝업 이미지 버킷 (공개)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'popups',
  'popups',
  true,
  5242880,  -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 팝업 이미지 버킷 RLS: 누구나 조회 가능
DROP POLICY IF EXISTS "popups_storage_select" ON storage.objects;
CREATE POLICY "popups_storage_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'popups');

-- 팝업 이미지 버킷 RLS: 인증된 사용자만 업로드/삭제
DROP POLICY IF EXISTS "popups_storage_insert" ON storage.objects;
CREATE POLICY "popups_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'popups' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "popups_storage_delete" ON storage.objects;
CREATE POLICY "popups_storage_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'popups' AND auth.role() = 'authenticated');

-- =============================================================================
-- SEED DATA: 기본 카테고리 / 브랜드 / 상품
-- =============================================================================

-- 상위 카테고리
INSERT INTO product_categories (id, parent_id, name, slug, description, depth, sort_order, is_visible) VALUES
  ('00000000-0000-0000-0000-000000000101', NULL, '의류',     'clothing',     '남성/여성 의류 전체',    0, 1, true),
  ('00000000-0000-0000-0000-000000000102', NULL, '식품',     'food',          '신선식품·가공식품',     0, 2, true),
  ('00000000-0000-0000-0000-000000000103', NULL, '전자제품', 'electronics',  '스마트폰·노트북·가전', 0, 3, true),
  ('00000000-0000-0000-0000-000000000104', NULL, '생활용품', 'living',       '홈·주방·욕실 용품',    0, 4, true),
  ('00000000-0000-0000-0000-000000000105', NULL, '스포츠',   'sports',       '운동·레저 용품',        0, 5, true)
ON CONFLICT (id) DO NOTHING;

-- 하위 카테고리
INSERT INTO product_categories (id, parent_id, name, slug, description, depth, sort_order, is_visible) VALUES
  -- 의류
  ('00000000-0000-0000-0000-000000000111', '00000000-0000-0000-0000-000000000101', '남성 의류', 'clothing-men',      '남성 티셔츠·바지·아우터',    1, 1, true),
  ('00000000-0000-0000-0000-000000000112', '00000000-0000-0000-0000-000000000101', '여성 의류', 'clothing-women',    '여성 원피스·블라우스·재킷', 1, 2, true),
  -- 식품
  ('00000000-0000-0000-0000-000000000121', '00000000-0000-0000-0000-000000000102', '신선식품', 'food-fresh',         '채소·과일·수산물',           1, 1, true),
  ('00000000-0000-0000-0000-000000000122', '00000000-0000-0000-0000-000000000102', '건강식품', 'food-health',        '비타민·홍삼·프로틴',         1, 2, true),
  -- 전자제품
  ('00000000-0000-0000-0000-000000000131', '00000000-0000-0000-0000-000000000103', '스마트폰·태블릿', 'electronics-mobile', '최신 모바일 기기',     1, 1, true),
  ('00000000-0000-0000-0000-000000000132', '00000000-0000-0000-0000-000000000103', '노트북·PC',       'electronics-laptop', '노트북·데스크탑',      1, 2, true),
  ('00000000-0000-0000-0000-000000000133', '00000000-0000-0000-0000-000000000103', '음향·영상',       'electronics-av',     '이어폰·스피커·TV',     1, 3, true),
  -- 생활용품
  ('00000000-0000-0000-0000-000000000141', '00000000-0000-0000-0000-000000000104', '주방용품', 'living-kitchen',     '조리도구·식기',              1, 1, true),
  ('00000000-0000-0000-0000-000000000142', '00000000-0000-0000-0000-000000000104', '청소·세탁', 'living-cleaning',   '세제·청소기·걸레',           1, 2, true),
  -- 스포츠
  ('00000000-0000-0000-0000-000000000151', '00000000-0000-0000-0000-000000000105', '헬스·요가', 'sports-fitness',    '운동기구·요가매트',          1, 1, true),
  ('00000000-0000-0000-0000-000000000152', '00000000-0000-0000-0000-000000000105', '아웃도어',  'sports-outdoor',    '등산·캠핑 장비',             1, 2, true)
ON CONFLICT (id) DO NOTHING;

-- 브랜드
INSERT INTO product_brands (id, name, slug, description, is_visible) VALUES
  ('00000000-0000-0000-0000-000000000201', '프리카트 오리지널', 'freecart-original', '프리카트 자체 브랜드',       true),
  ('00000000-0000-0000-0000-000000000202', '네이처핏',          'naturefit',         '친환경 라이프스타일 브랜드', true),
  ('00000000-0000-0000-0000-000000000203', '테크스타',           'techstar',          '혁신적인 전자제품 브랜드',   true),
  ('00000000-0000-0000-0000-000000000204', '홈앤라이프',         'homnlife',          '생활용품 전문 브랜드',       true)
ON CONFLICT (id) DO NOTHING;

-- 샘플 상품 (12개)
INSERT INTO products (
  id, category_id, brand_id, name, slug,
  description, regular_price, sale_price,
  stock_quantity, status,
  is_featured, is_new, is_best, is_sale,
  has_options, shipping_type
) VALUES
  -- 의류 > 남성
  ('00000000-0000-0000-0000-000000000301',
   '00000000-0000-0000-0000-000000000111', '00000000-0000-0000-0000-000000000201',
   '베이직 크루넥 티셔츠', 'basic-crewneck-tshirt',
   '사계절 활용 가능한 기본 크루넥 티셔츠입니다. 부드러운 면 소재로 편안한 착용감을 드립니다.',
   29000, 19900, 100, 'active', true, true, false, true, true, 'standard'),

  ('00000000-0000-0000-0000-000000000302',
   '00000000-0000-0000-0000-000000000111', '00000000-0000-0000-0000-000000000201',
   '슬림핏 치노 팬츠', 'slim-chino-pants',
   '깔끔한 슬림핏 치노 팬츠. 오피스룩부터 캐주얼까지 다양하게 매칭 가능합니다.',
   59000, 49000, 80, 'active', false, true, false, true, true, 'standard'),

  -- 의류 > 여성
  ('00000000-0000-0000-0000-000000000303',
   '00000000-0000-0000-0000-000000000112', '00000000-0000-0000-0000-000000000201',
   '플로럴 미디 원피스', 'floral-midi-dress',
   '화사한 플로럴 패턴의 미디 원피스. 봄·여름 데이리룩으로 완벽합니다.',
   79000, 65000, 60, 'active', true, true, true, true, true, 'standard'),

  -- 식품 > 신선
  ('00000000-0000-0000-0000-000000000304',
   '00000000-0000-0000-0000-000000000121', '00000000-0000-0000-0000-000000000202',
   '유기농 제주 감귤 2kg', 'organic-jeju-tangerine-2kg',
   '제주도에서 직배송하는 달콤한 유기농 감귤입니다. 무농약 인증 제품.',
   18000, 18000, 200, 'active', true, false, true, false, false, 'cold_chain'),

  ('00000000-0000-0000-0000-000000000305',
   '00000000-0000-0000-0000-000000000121', '00000000-0000-0000-0000-000000000202',
   '국내산 한우 불고기용 500g', 'korean-beef-bulgogi-500g',
   '1++ 등급 국내산 한우 불고기용. 냉장 상태 직배송.',
   35000, 35000, 50, 'active', false, false, true, false, false, 'cold_chain'),

  -- 식품 > 건강
  ('00000000-0000-0000-0000-000000000306',
   '00000000-0000-0000-0000-000000000122', '00000000-0000-0000-0000-000000000202',
   '6년근 홍삼정 에브리데이 30포', 'red-ginseng-everyday-30p',
   '6년근 홍삼만을 사용한 고농축 홍삼정. 하루 1포로 간편하게 섭취.',
   89000, 69000, 300, 'active', true, false, true, true, false, 'standard'),

  -- 전자제품 > 모바일
  ('00000000-0000-0000-0000-000000000307',
   '00000000-0000-0000-0000-000000000131', '00000000-0000-0000-0000-000000000203',
   '스마트폰 무선충전 패드', 'wireless-charging-pad',
   'Qi 규격 호환 고속 무선충전 패드. 최대 15W 고속충전 지원.',
   35000, 25000, 150, 'active', false, true, false, true, false, 'standard'),

  -- 전자제품 > 음향
  ('00000000-0000-0000-0000-000000000308',
   '00000000-0000-0000-0000-000000000133', '00000000-0000-0000-0000-000000000203',
   '노이즈캔슬링 블루투스 이어폰', 'nc-bluetooth-earphones',
   '능동형 노이즈캔슬링 탑재 무선 이어폰. 최대 30시간 재생 지원.',
   129000, 99000, 75, 'active', true, true, true, true, true, 'standard'),

  -- 전자제품 > 노트북
  ('00000000-0000-0000-0000-000000000309',
   '00000000-0000-0000-0000-000000000132', '00000000-0000-0000-0000-000000000203',
   '울트라북 노트북 스탠드', 'ultrabook-laptop-stand',
   '알루미늄 합금 노트북 스탠드. 높이 6단계 조절 가능, 방열 설계.',
   45000, 38000, 120, 'active', false, true, false, true, false, 'standard'),

  -- 생활용품 > 주방
  ('00000000-0000-0000-0000-000000000310',
   '00000000-0000-0000-0000-000000000141', '00000000-0000-0000-0000-000000000204',
   '스테인리스 3중 바닥 냄비 세트', 'stainless-pot-set-3pcs',
   '고급 스테인리스 3중 바닥 냄비 3종 세트. 인덕션 사용 가능.',
   120000, 89000, 40, 'active', true, false, true, true, false, 'standard'),

  -- 생활용품 > 청소
  ('00000000-0000-0000-0000-000000000311',
   '00000000-0000-0000-0000-000000000142', '00000000-0000-0000-0000-000000000204',
   '천연 유래 주방 세제 1L', 'natural-dish-soap-1l',
   '식물성 원료 100% 천연 유래 주방 세제. 안심하고 사용할 수 있는 친환경 제품.',
   12000, 12000, 500, 'active', false, false, false, false, false, 'standard'),

  -- 스포츠 > 헬스
  ('00000000-0000-0000-0000-000000000312',
   '00000000-0000-0000-0000-000000000151', '00000000-0000-0000-0000-000000000202',
   '프리미엄 TPE 요가매트 6mm', 'premium-tpe-yoga-mat-6mm',
   '미끄럼 방지 TPE 소재 요가매트. 두께 6mm, 183x61cm. 친환경 소재.',
   45000, 35000, 90, 'active', false, true, false, true, false, 'standard')
ON CONFLICT (id) DO NOTHING;

-- 상품 이미지 (대표 이미지 - Unsplash 실제 상품 이미지)
INSERT INTO product_images (id, product_id, url, alt, is_primary, sort_order) VALUES
  ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000301', 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&h=600&fit=crop', '베이직 크루넥 티셔츠',         true, 0),
  ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000302', 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600&h=600&fit=crop', '슬림핏 치노 팬츠',             true, 0),
  ('00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000303', 'https://images.unsplash.com/photo-1568252542512-9fe8fe9c87bb?w=600&h=600&fit=crop', '플로럴 미디 원피스',           true, 0),
  ('00000000-0000-0000-0000-000000000404', '00000000-0000-0000-0000-000000000304', 'https://images.unsplash.com/photo-1547514701-42782101795e?w=600&h=600&fit=crop',    '유기농 제주 감귤',             true, 0),
  ('00000000-0000-0000-0000-000000000405', '00000000-0000-0000-0000-000000000305', 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&h=600&fit=crop',    '국내산 한우 불고기용',         true, 0),
  ('00000000-0000-0000-0000-000000000406', '00000000-0000-0000-0000-000000000306', 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&h=600&fit=crop',    '6년근 홍삼정',                 true, 0),
  ('00000000-0000-0000-0000-000000000407', '00000000-0000-0000-0000-000000000307', 'https://images.unsplash.com/photo-1615526675159-e248c3021d3f?w=600&h=600&fit=crop', '스마트폰 무선충전 패드',       true, 0),
  ('00000000-0000-0000-0000-000000000408', '00000000-0000-0000-0000-000000000308', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=600&fit=crop', '노이즈캔슬링 블루투스 이어폰', true, 0),
  ('00000000-0000-0000-0000-000000000409', '00000000-0000-0000-0000-000000000309', 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=600&h=600&fit=crop', '울트라북 노트북 스탠드',       true, 0),
  ('00000000-0000-0000-0000-000000000410', '00000000-0000-0000-0000-000000000310', 'https://images.unsplash.com/photo-1556909211-36987daf7b4d?w=600&h=600&fit=crop',    '스테인리스 냄비 세트',         true, 0),
  ('00000000-0000-0000-0000-000000000411', '00000000-0000-0000-0000-000000000311', 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=600&h=600&fit=crop', '천연 주방 세제',               true, 0),
  ('00000000-0000-0000-0000-000000000412', '00000000-0000-0000-0000-000000000312', 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&h=600&fit=crop',    '프리미엄 TPE 요가매트',        true, 0)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 권한 체계 / 동적 회원가입 필드 / 담당자 매핑 -- joy 작성
--   1) system_settings           : 전역 설정 (담당자 기능 토글 등)
--   2) permissions               : 시스템에서 정의된 권한 카탈로그
--   3) admin_roles               : super_admin이 만드는 권한 묶음(역할)
--   4) admin_role_permissions    : 역할 ↔ 권한 매핑
--   5) admin_user_roles          : admin 사용자 ↔ 역할 매핑
--   6) user_managers             : 사용자 ↔ 담당 admin 매핑 (N:N)
--   7) users 컬럼 보강            : 가입 승인 플로우 (is_approved 등)
--   8) orders.created_by 추가     : 담당자 대리 등록 추적
--   9) signup_field_definitions  : 회원가입 동적 필드 정의
--  10) user_field_values         : 회원가입 동적 필드 값
--  11) 헬퍼 함수 + RLS 정책
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0) users / orders 컬럼 보강 -- joy 작성
-- ---------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_approved   BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by   UUID REFERENCES users(id) ON DELETE SET NULL;

-- joy: 아이디 기반 로그인을 위한 login_id 컬럼 추가
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS login_id VARCHAR(50) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_users_login_id ON users(login_id);

-- joy: 기존 가입 회원 중 login_id가 없는 경우 email 앞부분 + '0801'로 채움
--   동일 이메일 접두사가 여러 명인 경우 2번째부터 '0801' + 순번을 붙여 충돌 방지
UPDATE users u
SET login_id = sub.new_login_id
FROM (
  SELECT
    id,
    CASE
      WHEN ROW_NUMBER() OVER (PARTITION BY split_part(email, '@', 1) ORDER BY created_at) = 1
        THEN split_part(email, '@', 1) || '0801'
      ELSE split_part(email, '@', 1) || '0801' ||
           ROW_NUMBER() OVER (PARTITION BY split_part(email, '@', 1) ORDER BY created_at)::text
    END AS new_login_id
  FROM users
  WHERE login_id IS NULL
) sub
WHERE u.id = sub.id;

-- joy0801, lob0801 계정을 super_admin으로 설정
UPDATE public.users
SET role = 'super_admin', is_approved = true
WHERE login_id IN ('joy0801', 'lob0801');

UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role":"super_admin"}'::jsonb
WHERE id IN (
  SELECT id FROM public.users WHERE login_id IN ('joy0801', 'lob0801')
);

-- role 값 표준화: super_admin / admin / user
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('super_admin', 'admin', 'user'));

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 1) system_settings : 전역 설정 (담당자 기능 토글 등) -- joy 작성
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_settings (
  key         VARCHAR(100) PRIMARY KEY,
  value       JSONB        NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TRIGGER trg_system_settings_updated_at
  BEFORE UPDATE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO system_settings (key, value, description) VALUES
  ('enable_user_assignment', 'false'::jsonb,
   '담당자 기능 활성화 여부. true이면 admin은 본인 담당 사용자만 접근 가능, false이면 모든 admin이 모든 사용자 접근 가능'),
  -- joy: 회원가입 시 관리자 승인이 필요한 사이트와 그렇지 않은 사이트를 토글로 전환하기 위한 설정.
  -- true이면 가입 후 is_approved=true가 되기 전까지 일반 사용자 로그인 차단.
  ('require_signup_approval', 'false'::jsonb,
   '회원가입 시 관리자 승인 필요 여부. true이면 is_approved=false 상태의 일반 사용자는 로그인 불가'),
  -- joy: 회원 등급 기능 사용 여부. false면 관리자 회원 목록/상세에서 등급 UI 숨김
  ('use_user_levels', 'true'::jsonb,
   '회원 등급 기능 사용 여부. false이면 관리자 회원 관리 화면에서 등급 컬럼/변경 UI를 숨김'),
  -- joy: 포인트 기능 사용 여부 + 명칭. false면 회원 목록/상세에서 포인트 UI 숨김
  ('use_points', 'true'::jsonb,
   '포인트 기능 사용 여부. false이면 관리자 회원 관리 화면에서 포인트 컬럼/조정 UI를 숨김'),
  ('point_label', '"포인트"'::jsonb,
   '포인트 명칭(예: 포인트, 적립금, 마일리지). UI 라벨에 사용됨'),
  ('enable_user_tags', 'false'::jsonb,
   '사용자 태그 기능 ON/OFF. true이면 회원 관리에서 태그 사이드바/태그 관리 탭이 표시됨'),
  ('allow_customer_return', 'true'::jsonb,
   '고객이 마이페이지에서 직접 반품 신청 가능 여부. false이면 반품 신청 폼 대신 고객센터 안내 메시지 표시'),
  ('allow_customer_exchange', 'true'::jsonb,
   '고객이 마이페이지에서 직접 교환 신청 가능 여부. false이면 교환 신청 폼 대신 고객센터 안내 메시지 표시')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2) permissions : 시스템 권한 카탈로그 (코드에서 사용) -- joy 작성
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS permissions (
  permission_key       VARCHAR(100) PRIMARY KEY,    -- 예: orders.cancel
  module               VARCHAR(50)  NOT NULL,        -- 예: orders
  action               VARCHAR(50)  NOT NULL,        -- 예: cancel
  description          TEXT,
  is_super_admin_only  BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO permissions (permission_key, module, action, description, is_super_admin_only) VALUES
  ('users.read',            'users',         'read',    '사용자 조회',                  false),
  ('users.write',           'users',         'write',   '사용자 수정',                  false),
  ('users.approve',         'users',         'approve', '가입 승인',                    false),
  ('users.assign_manager',  'users',         'assign',  '담당자 배정',                  true),
  ('orders.read',           'orders',        'read',    '주문 조회',                    false),
  ('orders.write',          'orders',        'write',   '주문 등록/수정',               false),
  ('orders.cancel',         'orders',        'cancel',  '주문 취소/환불',               false),
  ('orders.export',         'orders',        'export',  '주문 내보내기',                false),
  ('products.read',         'products',      'read',    '상품 조회',                    false),
  ('products.write',        'products',      'write',   '상품 등록/수정',               false),
  ('products.delete',       'products',      'delete',  '상품 삭제',                    false),
  ('inventory.write',       'inventory',     'write',   '재고 조정',                    false),
  ('coupons.write',         'coupons',       'write',   '쿠폰 관리',                    false),
  ('points.adjust',         'points',        'adjust',  '포인트 수동 지급/차감',        false),
  ('boards.write',          'boards',        'write',   '게시판 관리',                  false),
  ('settings.read',         'settings',      'read',    '시스템 설정 조회',             false),
  ('settings.write',        'settings',      'write',   '시스템 설정 변경',             true),
  ('signup_fields.manage',  'signup_fields', 'manage',  '회원가입 필드 빌더',           false),
  ('admins.manage',         'admins',        'manage',  '관리자 계정/권한/역할 관리',   true)
ON CONFLICT (permission_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3) admin_roles : super_admin이 만드는 역할(권한 묶음) -- joy 작성
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_system   BOOLEAN NOT NULL DEFAULT false,        -- 시스템 기본 역할(삭제 불가)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_admin_roles_updated_at
  BEFORE UPDATE ON admin_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4) admin_role_permissions : 역할 ↔ 권한 매핑 -- joy 작성
CREATE TABLE IF NOT EXISTS admin_role_permissions (
  role_id        UUID NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
  permission_key VARCHAR(100) NOT NULL REFERENCES permissions(permission_key) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_key)
);

-- 5) admin_user_roles : admin 사용자 ↔ 역할 매핑 -- joy 작성
CREATE TABLE IF NOT EXISTS admin_user_roles (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id     UUID NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_user_roles_user ON admin_user_roles(user_id);

-- (역할 시드는 제거: super_admin이 관리자 화면에서 직접 생성)

-- ---------------------------------------------------------------------------
-- 6) user_managers : 사용자 ↔ 담당 admin (N:N) -- joy 작성
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_managers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,        -- 담당받는 사용자
  manager_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,        -- 담당 admin
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(user_id, manager_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_managers_manager ON user_managers(manager_user_id);
CREATE INDEX IF NOT EXISTS idx_user_managers_user    ON user_managers(user_id);

-- ---------------------------------------------------------------------------
-- 9) signup_field_definitions : 회원가입 동적 필드 정의 -- joy 작성
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS signup_field_definitions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_key       VARCHAR(100) NOT NULL UNIQUE,                  -- 내부 식별자 (예: company_name)
  label           VARCHAR(200) NOT NULL,                         -- 화면 표시 라벨 (예: 상호명)
  field_type      VARCHAR(30)  NOT NULL CHECK (field_type IN (
                    'text', 'textarea',
                    'select', 'radio', 'checkbox',
                    'url', 'phone',
                    'date', 'time', 'datetime',
                    'address', 'file', 'number', 'email',
                    'terms'
                  )),
  is_required     BOOLEAN NOT NULL DEFAULT false,
  is_active       BOOLEAN NOT NULL DEFAULT true,                 -- 삭제 대신 비활성화
  sort_order      INTEGER NOT NULL DEFAULT 0,
  placeholder     VARCHAR(255),
  help_text       TEXT,
  validation_rule JSONB,                                         -- 정규식/min/max
  default_value   TEXT,
  options         JSONB,                                         -- select/radio/checkbox 선택지
  target_role     VARCHAR(30) DEFAULT 'all',
  is_system       BOOLEAN NOT NULL DEFAULT false,
  terms_id        UUID REFERENCES terms(id) ON DELETE SET NULL,  -- terms 타입일 때 약관 참조
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signup_field_definitions_active
  ON signup_field_definitions(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_signup_field_definitions_target_role
  ON signup_field_definitions(target_role);

CREATE TRIGGER trg_signup_field_definitions_updated_at
  BEFORE UPDATE ON signup_field_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- joy: 기본(시스템) 필드와 커스텀 필드가 값을 어디에 저장하는지 구분하기 위한 컬럼 추가.
--   storage_target: 'auth'(Supabase Auth), 'users'(users 테이블 컬럼), 'custom'(user_field_values)
--   storage_column: storage_target='users'일 때 대응되는 users 컬럼명
ALTER TABLE signup_field_definitions
  ADD COLUMN IF NOT EXISTS storage_target VARCHAR(20) NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS storage_column VARCHAR(50);

ALTER TABLE signup_field_definitions
  ADD COLUMN IF NOT EXISTS is_editable BOOLEAN NOT NULL DEFAULT true;

-- joy: 회원가입 기본 필드 시드. is_system=true로 삭제 방지.
--   이메일/비밀번호는 field_key로 UI에서 비활성화 토글 차단 (항상 필수)
--   순서: 아이디(10) → 비밀번호(20) → 이름(30) → 휴대폰(40) → 이메일(50) → 주소(60) → 동의(70)
INSERT INTO signup_field_definitions
  (field_key, label, field_type, is_required, is_active, sort_order,
   placeholder, help_text, validation_rule, target_role, is_system, storage_target, storage_column)
VALUES
  ('login_id',          '아이디',                 'text',     true, true, 10,
   '영문/숫자 5자 이상', '영문, 숫자만 사용 가능 (5자 이상)',
   '{"pattern": "^[a-zA-Z0-9]{5,}$", "message": "영문, 숫자 5자 이상으로 입력해주세요"}',
   'all', true, 'users', 'login_id'),
  ('email',             '이메일',                 'email',    true, true, 50,
   'example@domain.com', null, null, 'all', true, 'auth',  null),
  ('password',          '비밀번호',               'text',     true, true, 20,
   '비밀번호를 입력하세요', '영문/숫자/특수문자 조합 권장', null, 'all', true, 'auth', null),
  ('name',              '이름',                   'text',     true, true, 30,
   '홍길동', null, null, 'all', true, 'users', 'name'),
  ('phone',             '휴대폰 번호',             'phone',    true, true, 40,
   '010-0000-0000', null, null, 'all', true, 'users', 'phone'),
  ('address',           '주소',                   'address',  false, true, 60,
   null, '다음 우편번호 검색으로 입력됩니다', null, 'all', true, 'users', null),
  ('privacy_agreement', '개인정보 처리 방침 동의', 'checkbox', true, true, 70,
   null, '개인정보 수집·이용에 동의합니다', null, 'all', false, 'users', 'privacy_agreed_at')
ON CONFLICT (field_key) DO NOTHING;

-- joy: 기존 DB에 이미 시드가 들어간 경우를 위한 sort_order 업데이트 + login_id 필드 upsert
UPDATE signup_field_definitions SET sort_order = 50 WHERE field_key = 'email';
UPDATE signup_field_definitions SET sort_order = 20 WHERE field_key = 'password';
UPDATE signup_field_definitions SET sort_order = 30 WHERE field_key = 'name';
UPDATE signup_field_definitions SET sort_order = 40 WHERE field_key = 'phone';
UPDATE signup_field_definitions SET sort_order = 60 WHERE field_key = 'address';
UPDATE signup_field_definitions SET sort_order = 70 WHERE field_key = 'privacy_agreement';

INSERT INTO signup_field_definitions
  (field_key, label, field_type, is_required, is_active, sort_order,
   placeholder, help_text, validation_rule, target_role, is_system, storage_target, storage_column)
VALUES
  ('login_id', '아이디', 'text', true, true, 10,
   '영문/숫자 5자 이상', '영문, 숫자만 사용 가능 (5자 이상)',
   '{"pattern": "^[a-zA-Z0-9]{5,}$", "message": "영문, 숫자 5자 이상으로 입력해주세요"}',
   'all', true, 'users', 'login_id')
ON CONFLICT (field_key) DO UPDATE SET
  label          = EXCLUDED.label,
  sort_order     = EXCLUDED.sort_order,
  placeholder    = EXCLUDED.placeholder,
  help_text      = EXCLUDED.help_text,
  validation_rule = EXCLUDED.validation_rule,
  storage_target = EXCLUDED.storage_target,
  storage_column = EXCLUDED.storage_column,
  is_system      = EXCLUDED.is_system;

-- login_id는 마이페이지에서 수정 불가 고정
UPDATE signup_field_definitions SET is_editable = false WHERE field_key = 'login_id';

-- 10) user_field_values : 회원이 입력한 동적 필드 값 -- joy 작성
CREATE TABLE IF NOT EXISTS user_field_values (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  field_definition_id  UUID NOT NULL REFERENCES signup_field_definitions(id) ON DELETE CASCADE,
  value_text           TEXT,
  value_number         NUMERIC,
  value_date           TIMESTAMPTZ,
  value_json           JSONB,
  value_file_url       TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, field_definition_id)
);

CREATE INDEX IF NOT EXISTS idx_user_field_values_user
  ON user_field_values(user_id);
CREATE INDEX IF NOT EXISTS idx_user_field_values_field
  ON user_field_values(field_definition_id);

CREATE TRIGGER trg_user_field_values_updated_at
  BEFORE UPDATE ON user_field_values
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 11) 헬퍼 함수 (SECURITY DEFINER로 RLS 재귀 회피) -- joy 작성
-- ---------------------------------------------------------------------------

-- joy: 아이디 기반 로그인/비밀번호 찾기용 RPC.
--   익명 사용자가 login_id로 email을 조회할 수 있도록 SECURITY DEFINER로 RLS 우회.
--   이메일만 반환하여 개인정보 노출 최소화.
CREATE OR REPLACE FUNCTION get_email_by_login_id(p_login_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email
  FROM users
  WHERE login_id = p_login_id
  LIMIT 1;
  RETURN v_email;
END;
$$;

CREATE OR REPLACE FUNCTION is_super_admin(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = uid AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION is_admin(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = uid AND role IN ('admin', 'super_admin')
  );
$$;

-- 권한 보유 여부 (super_admin은 모든 권한)
CREATE OR REPLACE FUNCTION has_permission(uid UUID, perm_key VARCHAR)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    is_super_admin(uid)
    OR EXISTS (
      SELECT 1
      FROM admin_user_roles aur
      JOIN admin_role_permissions arp ON arp.role_id = aur.role_id
      WHERE aur.user_id = uid
        AND arp.permission_key = perm_key
    );
$$;

-- 담당자 기능 토글 조회
CREATE OR REPLACE FUNCTION user_assignment_enabled()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    (SELECT (value)::text::boolean FROM system_settings WHERE key = 'enable_user_assignment'),
    false
  );
$$;

-- 특정 사용자 관리 권한
--   1) super_admin → 항상 true
--   2) 토글 OFF + admin → true
--   3) 토글 ON + admin이 user_managers 매핑 보유 → true
CREATE OR REPLACE FUNCTION can_manage_user(uid UUID, target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    is_super_admin(uid)
    OR (
      is_admin(uid)
      AND (
        NOT user_assignment_enabled()
        OR EXISTS (
          SELECT 1 FROM user_managers
          WHERE manager_user_id = uid
            AND user_id = target_user_id
        )
      )
    );
$$;

-- ---------------------------------------------------------------------------
-- 11-1) user_tags + user_tag_members -- joy 작성
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL,
  color      VARCHAR(20)  NOT NULL DEFAULT '#6366f1',
  sort_order INTEGER      NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(name, created_by)
);

CREATE TABLE IF NOT EXISTS user_tag_members (
  tag_id   UUID NOT NULL REFERENCES user_tags(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tag_id, user_id)
);

-- 12) RLS 활성화 + 정책 -- joy 작성
-- ---------------------------------------------------------------------------
ALTER TABLE system_settings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_roles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_role_permissions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_user_roles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_managers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE signup_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_field_values        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tags                ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tag_members         ENABLE ROW LEVEL SECURITY;

-- system_settings: 관리자 조회, super_admin만 수정
CREATE POLICY "system_settings_select_admin" ON system_settings
  FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "system_settings_modify_super" ON system_settings
  FOR ALL USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- permissions: 관리자 조회 가능, 수정 불가 (시드)
CREATE POLICY "permissions_select_admin" ON permissions
  FOR SELECT USING (is_admin(auth.uid()));

-- admin_roles / admin_role_permissions / admin_user_roles: super_admin 전용 관리, admin 조회만
CREATE POLICY "admin_roles_select_admin" ON admin_roles
  FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "admin_roles_modify_super" ON admin_roles
  FOR ALL USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "admin_role_permissions_select_admin" ON admin_role_permissions
  FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "admin_role_permissions_modify_super" ON admin_role_permissions
  FOR ALL USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "admin_user_roles_select_admin" ON admin_user_roles
  FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "admin_user_roles_modify_super" ON admin_user_roles
  FOR ALL USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- user_managers: super_admin 전체, admin은 본인 매핑만 조회
CREATE POLICY "user_managers_select_self_or_super" ON user_managers
  FOR SELECT USING (
    is_super_admin(auth.uid()) OR manager_user_id = auth.uid()
  );
CREATE POLICY "user_managers_modify_super" ON user_managers
  FOR ALL USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- signup_field_definitions: 활성 필드 공개 조회 (회원가입 폼), 관리는 권한 보유자
CREATE POLICY "signup_field_definitions_select_active" ON signup_field_definitions
  FOR SELECT USING (is_active = true OR is_admin(auth.uid()));
CREATE POLICY "signup_field_definitions_modify_perm" ON signup_field_definitions
  FOR ALL USING (has_permission(auth.uid(), 'signup_fields.manage'))
  WITH CHECK (has_permission(auth.uid(), 'signup_fields.manage'));

-- user_tags RLS
DROP POLICY IF EXISTS "user_tags_select_admin" ON user_tags;
CREATE POLICY "user_tags_select_admin" ON user_tags
  FOR SELECT USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "user_tags_insert_admin" ON user_tags;
CREATE POLICY "user_tags_insert_admin" ON user_tags
  FOR INSERT WITH CHECK (is_admin(auth.uid()));
DROP POLICY IF EXISTS "user_tags_update_own_or_super" ON user_tags;
CREATE POLICY "user_tags_update_own_or_super" ON user_tags
  FOR UPDATE USING (is_super_admin(auth.uid()) OR created_by = auth.uid())
  WITH CHECK (is_super_admin(auth.uid()) OR created_by = auth.uid());
DROP POLICY IF EXISTS "user_tags_delete_own_or_super" ON user_tags;
CREATE POLICY "user_tags_delete_own_or_super" ON user_tags
  FOR DELETE USING (is_super_admin(auth.uid()) OR created_by = auth.uid());

-- user_tag_members RLS
DROP POLICY IF EXISTS "user_tag_members_select_admin" ON user_tag_members;
CREATE POLICY "user_tag_members_select_admin" ON user_tag_members
  FOR SELECT USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "user_tag_members_insert_admin" ON user_tag_members;
CREATE POLICY "user_tag_members_insert_admin" ON user_tag_members
  FOR INSERT WITH CHECK (
    is_super_admin(auth.uid()) OR
    EXISTS (SELECT 1 FROM user_tags WHERE id = tag_id AND created_by = auth.uid())
  );
DROP POLICY IF EXISTS "user_tag_members_delete_admin" ON user_tag_members;
CREATE POLICY "user_tag_members_delete_admin" ON user_tag_members
  FOR DELETE USING (
    is_super_admin(auth.uid()) OR
    EXISTS (SELECT 1 FROM user_tags WHERE id = tag_id AND created_by = auth.uid())
  );

-- joy: users 테이블 admin 조회/수정 정책 (can_manage_user 함수가 정의된 이 시점에 생성)
DROP POLICY IF EXISTS "users_select_admin" ON users;
CREATE POLICY "users_select_admin" ON users
  FOR SELECT USING (can_manage_user(auth.uid(), id));

DROP POLICY IF EXISTS "users_update_admin" ON users;
CREATE POLICY "users_update_admin" ON users
  FOR UPDATE USING (can_manage_user(auth.uid(), id));

-- user_field_values: 본인 또는 담당 admin / super_admin
CREATE POLICY "user_field_values_select" ON user_field_values
  FOR SELECT USING (
    user_id = auth.uid() OR can_manage_user(auth.uid(), user_id)
  );
CREATE POLICY "user_field_values_insert" ON user_field_values
  FOR INSERT WITH CHECK (
    user_id = auth.uid() OR can_manage_user(auth.uid(), user_id)
  );
CREATE POLICY "user_field_values_update" ON user_field_values
  FOR UPDATE USING (
    user_id = auth.uid() OR can_manage_user(auth.uid(), user_id)
  );
CREATE POLICY "user_field_values_delete" ON user_field_values
  FOR DELETE USING (
    user_id = auth.uid() OR can_manage_user(auth.uid(), user_id)
  );

-- =============================================================================
-- super_admin 제약 트리거 -- joy 작성
--   super_admin은 최대 2명까지만 허용. 강등/삭제는 자유.
--   2/2 상태에서 새 super_admin을 만들려면 기존 1명을 먼저 강등해야 한다.
-- =============================================================================
CREATE OR REPLACE FUNCTION enforce_super_admin_constraints()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  current_count INT;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.role = 'super_admin' THEN
    SELECT COUNT(*) INTO current_count FROM users WHERE role = 'super_admin';
    IF current_count >= 2 THEN
      RAISE EXCEPTION 'super_admin 계정은 최대 2개까지만 생성할 수 있습니다.';
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.role = 'super_admin' AND OLD.role <> 'super_admin' THEN
    SELECT COUNT(*) INTO current_count FROM users WHERE role = 'super_admin';
    IF current_count >= 2 THEN
      RAISE EXCEPTION 'super_admin 계정은 최대 2개까지만 생성할 수 있습니다.';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_super_admin_check ON users;
CREATE TRIGGER trg_users_super_admin_check
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION enforce_super_admin_constraints();

-- joy: super_admin이 한 명도 없으면 최초 가입 계정을 자동 승격
-- (is_approved 컬럼이 추가된 이후 시점에 실행)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE role = 'super_admin') THEN
    UPDATE public.users
    SET role = 'super_admin', is_approved = true
    WHERE id = (SELECT id FROM public.users ORDER BY created_at ASC LIMIT 1);

    -- auth.users의 메타데이터에도 반영해서 다음 초기화 때도 유지
    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role":"super_admin"}'::jsonb
    WHERE id = (SELECT id FROM public.users WHERE role = 'super_admin' LIMIT 1);
  END IF;
END $$;

-- =============================================================================
-- 재고 차감 RPC 함수 (주문 시 race condition 방지)
-- =============================================================================

CREATE OR REPLACE FUNCTION decrement_variant_stock(p_variant_id UUID, p_quantity INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE product_variants
  SET stock_quantity = GREATEST(0, stock_quantity - p_quantity)
  WHERE id = p_variant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrement_product_stock(p_product_id UUID, p_quantity INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE products
  SET stock_quantity = GREATEST(0, stock_quantity - p_quantity)
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_variant_stock(p_variant_id UUID, p_quantity INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE product_variants
  SET stock_quantity = stock_quantity + p_quantity
  WHERE id = p_variant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_product_stock(p_product_id UUID, p_quantity INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE products
  SET stock_quantity = stock_quantity + p_quantity
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 쿠폰 사용 횟수 증감 (delta 양수=증가, 음수=감소)
CREATE OR REPLACE FUNCTION increment_coupon_used_count(coupon_id_input UUID, delta INTEGER DEFAULT 1)
RETURNS void AS $$
BEGIN
  UPDATE coupons
  SET used_quantity = GREATEST(0, used_quantity + delta)
  WHERE id = coupon_id_input;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 예치금 복구
CREATE OR REPLACE FUNCTION increment_user_deposit(p_user_id UUID, p_amount INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE users
  SET deposit = COALESCE(deposit, 0) + p_amount
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 미입금 자동취소 배치 함수 ─────────────────────────────────────────────────
-- pending 상태이면서 payment_deadline <= NOW() 인 주문을 cancelled 로 전이하고
-- 주문 아이템 재고를 복구합니다. 포인트·쿠폰은 미결제 상태이므로 복구 불필요.
-- 반환값: 취소 처리된 주문 수
CREATE OR REPLACE FUNCTION auto_cancel_pending_orders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r               RECORD;
  item_rec        RECORD;
  cancelled_count INTEGER := 0;
BEGIN
  FOR r IN
    SELECT id
    FROM orders
    WHERE status = 'pending'
      AND payment_deadline IS NOT NULL
      AND payment_deadline <= NOW()
  LOOP
    UPDATE orders
    SET status        = 'cancelled',
        cancelled_at  = NOW(),
        cancel_reason = '미입금 자동취소'
    WHERE id = r.id;

    INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, note)
    VALUES (r.id, 'pending', 'cancelled', 'system', '미입금 자동취소 (입금기한 초과)');

    FOR item_rec IN
      SELECT product_id, variant_id, quantity, item_type
      FROM order_items
      WHERE order_id = r.id
    LOOP
      IF COALESCE(item_rec.item_type, 'purchase') = 'gift' THEN CONTINUE; END IF;
      IF item_rec.variant_id IS NOT NULL THEN
        PERFORM increment_variant_stock(item_rec.variant_id, item_rec.quantity);
      ELSIF item_rec.product_id IS NOT NULL THEN
        PERFORM increment_product_stock(item_rec.product_id, item_rec.quantity);
      END IF;
    END LOOP;

    cancelled_count := cancelled_count + 1;
  END LOOP;
  RETURN cancelled_count;
END;
$$;

-- pg_cron 등록 (Supabase 대시보드 → Database → Extensions 에서 pg_cron 활성화 후 실행):
-- SELECT cron.schedule('auto-cancel-unpaid', '*/30 * * * *', 'SELECT auto_cancel_pending_orders()');

-- ── 자동 구매확정 배치 함수 ───────────────────────────────────────────────────
-- delivered 상태이면서 auto_confirm_at <= NOW() 인 주문을 confirmed 로 전이하고
-- earned_points 를 user 계정에 적립합니다. (중복 적립 방지 포함)
-- 반환값: 처리된 주문 수
CREATE OR REPLACE FUNCTION auto_confirm_orders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r                RECORD;
  confirmed_count  INTEGER := 0;
  current_pts      INTEGER;
  new_balance      INTEGER;
  already_earned   BOOLEAN;
BEGIN
  FOR r IN
    SELECT id, user_id, earned_points
    FROM orders
    WHERE status = 'delivered'
      AND auto_confirm_at IS NOT NULL
      AND auto_confirm_at <= NOW()
  LOOP
    UPDATE orders
    SET status       = 'confirmed',
        confirmed_at = NOW()
    WHERE id = r.id;

    INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, note)
    VALUES (r.id, 'delivered', 'confirmed', 'system', '자동 구매확정 (배송완료 후 7일)');

    IF r.earned_points > 0 AND r.user_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM user_points_history
        WHERE reference_type = 'order'
          AND reference_id   = r.id
          AND type           = 'earn'
      ) INTO already_earned;

      IF NOT already_earned THEN
        SELECT COALESCE(points, 0) INTO current_pts FROM users WHERE id = r.user_id;
        new_balance := current_pts + r.earned_points;
        UPDATE users SET points = new_balance WHERE id = r.user_id;
        INSERT INTO user_points_history
          (user_id, amount, balance, type, description, reference_type, reference_id)
        VALUES
          (r.user_id, r.earned_points, new_balance, 'earn',
           '구매확정 포인트 적립', 'order', r.id);
      END IF;
    END IF;

    confirmed_count := confirmed_count + 1;
  END LOOP;

  RETURN confirmed_count;
END;
$$;

-- pg_cron 등록 (Supabase 대시보드 → Database → Extensions 에서 pg_cron 활성화 후 실행):
-- SELECT cron.schedule('auto-confirm-orders', '0 * * * *', 'SELECT auto_confirm_orders()');

-- 상품명/옵션명으로 주문 ID 목록을 반환하는 RPC (관리자 주문 검색용)
CREATE OR REPLACE FUNCTION public.search_orders_by_product(keyword TEXT)
RETURNS TABLE(order_id UUID) AS $$
  SELECT DISTINCT oi.order_id
  FROM order_items oi
  WHERE oi.product_name ILIKE '%' || keyword || '%'
     OR oi.option_text ILIKE '%' || keyword || '%';
$$ LANGUAGE sql SECURITY DEFINER;

-- =============================================================================
-- freecart-web OAuth 연동 토큰 저장 테이블
-- (freecart 앱이 freecart-web에 연결할 때 사용하는 OAuth 토큰 로컬 캐시)
-- =============================================================================
CREATE TABLE IF NOT EXISTS freecart_integration (
  id                      INTEGER PRIMARY KEY DEFAULT 1, -- 단일 행 강제
  access_token_encrypted  TEXT,
  refresh_token_encrypted TEXT,
  freecart_user_email     TEXT,
  token_expires_at        TIMESTAMPTZ,
  connected_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- =============================================================================
-- 사이트 키-값 설정 (settings 테이블과 유사하나 별도 관리)
-- =============================================================================
CREATE TABLE IF NOT EXISTS site_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 기본 약관 데이터 (최초 설치 시 샘플 약관)
-- =============================================================================
INSERT INTO terms (title, type, content, version, is_required, is_active) VALUES
(
  '이용약관',
  'terms_of_service',
  '제1조 (목적)
본 약관은 서비스 이용 조건 및 절차, 이용자와 운영자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.

제2조 (정의)
"이용자"란 본 약관에 따라 서비스를 이용하는 회원 및 비회원을 말합니다.
"회원"이란 서비스에 개인정보를 제공하여 회원 등록을 한 자를 말합니다.

제3조 (약관의 효력 및 변경)
본 약관은 서비스 화면에 게시하거나 기타 방법으로 공지함으로써 효력이 발생합니다.
운영자는 약관을 변경할 수 있으며, 변경된 약관은 공지 후 7일 이후부터 효력이 발생합니다.

제4조 (서비스 이용)
서비스 이용은 연중무휴 1일 24시간 원칙으로 합니다. 단, 시스템 점검 등의 사유로 일시 중단될 수 있습니다.

제5조 (이용자의 의무)
이용자는 관계 법령, 본 약관의 규정, 운영 정책 등을 준수하여야 하며, 서비스 운영을 방해하는 행위를 해서는 안 됩니다.

제6조 (면책조항)
운영자는 천재지변, 불가항력적 사유로 서비스를 제공하지 못하는 경우 책임이 면제됩니다.',
  '1.0',
  true,
  true
),
(
  '개인정보처리방침',
  'privacy_policy',
  '1. 개인정보의 수집 및 이용 목적
회원 가입, 서비스 제공, 본인 확인, 고객 상담 및 불만 처리를 목적으로 개인정보를 수집합니다.

2. 수집하는 개인정보 항목
필수: 이름, 이메일, 비밀번호, 휴대전화번호
선택: 생년월일, 성별, 주소

3. 개인정보의 보유 및 이용 기간
회원 탈퇴 시까지 보유하며, 탈퇴 후에는 즉시 파기합니다.
단, 관련 법령에 따라 일정 기간 보관이 필요한 정보는 해당 기간 동안 보관합니다.
- 계약 또는 청약 철회 기록: 5년 (전자상거래법)
- 소비자 불만 또는 분쟁 처리 기록: 3년 (전자상거래법)

4. 개인정보의 제3자 제공
원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다. 단, 이용자의 동의가 있거나 법령의 규정에 의한 경우는 예외로 합니다.

5. 이용자의 권리
이용자는 언제든지 자신의 개인정보를 조회, 수정, 삭제, 처리 정지 요청할 수 있습니다.

6. 개인정보 보호책임자
개인정보 관련 문의는 고객센터를 통해 접수 받고 있습니다.',
  '1.0',
  true,
  true
),
(
  '마케팅 정보 수신 동의',
  'marketing',
  '마케팅 정보 수신 동의 (선택)

수집 목적: 이벤트, 신상품, 할인 프로모션 등 마케팅 정보 제공
수집 항목: 이메일, 휴대전화번호
보유 기간: 동의 철회 시까지

이메일, SMS 등을 통해 다양한 혜택 정보를 받아보실 수 있습니다.
동의하지 않아도 기본 서비스 이용에는 제한이 없으며, 동의 후에도 언제든지 철회하실 수 있습니다.',
  '1.0',
  false,
  true
),
(
  '만 14세 이상 확인',
  'age',
  '본인은 만 14세 이상임을 확인합니다.

만 14세 미만 아동의 경우 법정대리인(부모 등)의 동의가 필요합니다.
만 14세 미만인 경우 법정대리인의 동의를 받아 별도 절차를 통해 가입하시기 바랍니다.',
  '1.0',
  true,
  true
),
(
  '환불 정책',
  'refund',
  '1. 청약 철회
전자상거래 등에서의 소비자보호에 관한 법률에 따라 상품 수령 후 7일 이내에 청약 철회(반품)가 가능합니다.

2. 반품이 불가한 경우
- 이용자의 책임으로 상품이 멸실·훼손된 경우
- 이용자의 사용으로 상품 가치가 현저히 감소한 경우
- 시간 경과로 재판매가 곤란한 경우 (식품, 화장품 등)
- 복제 가능한 디지털 콘텐츠의 포장을 훼손한 경우

3. 환불 처리
반품 상품 확인 후 3영업일 이내에 환불 처리됩니다.
카드 결제의 경우 카드사 정책에 따라 최대 5영업일이 소요될 수 있습니다.',
  '1.0',
  true,
  true
)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 기본 메뉴 데이터 (최초 설치 시 샘플 메뉴)
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM menus LIMIT 1) THEN
    INSERT INTO menus (name, url, sort_order, is_visible, position) VALUES
      ('전체 상품',  '/products',  0, true, 'header'),
      ('카테고리',   '/categories', 1, true, 'header'),
      ('커뮤니티',   '/boards',    2, true, 'header'),
      ('공지사항',   '/notices',   3, true, 'header'),
      ('자주 묻는 질문', '/faqs',  4, true, 'header');
  END IF;
END $$;

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
