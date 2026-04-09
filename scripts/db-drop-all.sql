-- =============================================================================
-- DROP ALL TABLES (기존 DB 완전 초기화)
-- 주의: 모든 데이터가 삭제됩니다. 실행 전 반드시 백업하세요.
-- 사용법: 이 파일 실행 후 db-schema-full.sql 실행
-- =============================================================================

-- Storage 정책 삭제
DROP POLICY IF EXISTS "products_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "products_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "products_storage_delete" ON storage.objects;
DROP POLICY IF EXISTS "popups_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "popups_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "popups_storage_delete" ON storage.objects;
-- ※ 버킷 삭제는 Supabase 대시보드 → Storage에서 직접 삭제

-- 함수 삭제
DROP FUNCTION IF EXISTS public.admin_create_user CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;
DROP FUNCTION IF EXISTS public.auto_confirm_user CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column CASCADE;

-- 2026.04.07 윌리엄 추가 (joy) — 권한/담당자/동적 필드 관련 함수/트리거
DROP TRIGGER IF EXISTS trg_users_super_admin_check ON public.users;
DROP FUNCTION IF EXISTS public.enforce_super_admin_constraints() CASCADE;
DROP FUNCTION IF EXISTS public.can_manage_user(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.user_assignment_enabled() CASCADE;
DROP FUNCTION IF EXISTS public.has_permission(UUID, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS public.is_admin(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_super_admin(UUID) CASCADE;
-- main의 인자 없는 버전 (주석 처리되어 있지만 혹시 과거 실행분이 있을 수 있어 함께 정리)
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;

-- 외래키 의존성 역순으로 테이블 삭제 (CASCADE로 한번에)
DROP TABLE IF EXISTS
  -- 2026.04.07 윌리엄 추가 (joy) — 권한/담당자/동적 필드 테이블 (users 앞에 배치)
  user_field_values,
  signup_field_definitions,
  user_managers,
  admin_user_roles,
  admin_role_permissions,
  admin_roles,
  permissions,
  system_settings,
  user_preferences,
  shipping_notifications,
  coupon_usages,
  order_virtual_accounts,
  order_payments,
  payment_gateways,
  deployment_logs,
  deployment_settings,
  sms_logs,
  email_logs,
  notifications,
  user_search_history,
  search_keywords,
  webhook_logs,
  webhook_configs,
  installed_skins,
  installed_themes,
  stock_history,
  price_history,
  sync_logs,
  external_connections,
  tax_invoices,
  cash_receipts,
  subscription_deliveries,
  user_subscriptions,
  category_skin_settings,
  board_skin_settings,
  skins,
  visitor_logs,
  ip_blocks,
  admin_logs,
  main_sections,
  content_pages,
  terms,
  menus,
  settings,
  events,
  popups,
  banners,
  notices,
  faqs,
  inquiry_attachments,
  inquiries,
  post_likes,
  comments,
  post_attachments,
  post_images,
  posts,
  board_categories,
  boards,
  review_reports,
  review_likes,
  review_videos,
  review_images,
  reviews,
  refunds,
  exchanges,
  returns,
  shipments,
  shipping_zones,
  shipping_settings,
  shipping_companies,
  payments,
  order_memos,
  order_status_history,
  order_items,
  orders,
  cart_items,
  carts,
  user_coupons,
  coupons,
  user_recently_viewed,
  user_wishlist,
  product_subscriptions,
  product_qna,
  product_quantity_discounts,
  product_level_prices,
  product_discounts,
  product_stock_alerts,
  product_gifts,
  product_sets,
  product_related,
  product_attribute_values,
  product_attributes,
  product_tag_map,
  product_tags,
  product_images,
  product_variants,
  product_option_values,
  product_options,
  products,
  product_brands,
  product_categories,
  notification_settings,
  user_messages,
  user_attendance,
  user_deposits_history,
  user_points_history,
  user_addresses,
  user_social_accounts,
  users,
  user_levels
CASCADE;
