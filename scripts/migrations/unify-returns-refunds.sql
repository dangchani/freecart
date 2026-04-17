-- ============================================================
-- returns → refunds 통합 마이그레이션
-- 반품(return) 프로세스를 refunds 테이블로 통합하고
-- 픽업 요청 / GoodFlow 반품 연동 컬럼을 추가합니다.
-- ============================================================

-- 1. refunds 테이블에 반품 프로세스 컬럼 추가
ALTER TABLE refunds
  ADD COLUMN IF NOT EXISTS return_tracking_number  VARCHAR(50),
  ADD COLUMN IF NOT EXISTS return_company_id        UUID REFERENCES shipping_companies(id),
  ADD COLUMN IF NOT EXISTS gf_return_service_id     VARCHAR(30),
  ADD COLUMN IF NOT EXISTS pickup_requested_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pickup_scheduled_date    DATE,
  ADD COLUMN IF NOT EXISTS collected_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS initiated_by             VARCHAR(20) DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS refund_method            VARCHAR(30),
  ADD COLUMN IF NOT EXISTS user_id                  UUID REFERENCES users(id);

-- status COMMENT 갱신 (참고용)
-- pending → approved → pickup_requested → collected → completed | rejected

-- 2. gf_delivery_logs에 refund / exchange 연결 컬럼 추가
ALTER TABLE gf_delivery_logs
  ADD COLUMN IF NOT EXISTS refund_id   UUID REFERENCES refunds(id),
  ADD COLUMN IF NOT EXISTS exchange_id UUID REFERENCES exchanges(id);

-- 3. exchanges 테이블에 픽업 / GoodFlow 컬럼 추가
ALTER TABLE exchanges
  ADD COLUMN IF NOT EXISTS gf_return_service_id     VARCHAR(30),
  ADD COLUMN IF NOT EXISTS pickup_requested_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pickup_scheduled_date    DATE,
  ADD COLUMN IF NOT EXISTS exchange_product_id      UUID REFERENCES products(id),
  ADD COLUMN IF NOT EXISTS exchange_product_name    VARCHAR(200),
  ADD COLUMN IF NOT EXISTS exchange_variant_attrs   JSONB;

-- 4. 기존 returns 데이터를 refunds로 이관 (있는 경우)
INSERT INTO refunds (
  order_id, user_id, type, items, reason, reason_detail,
  amount, refund_method, bank_name, bank_account, account_holder,
  initiated_by, admin_memo,
  return_tracking_number, return_company_id,
  collected_at, approved_at, completed_at,
  status, created_at
)
SELECT
  r.order_id,
  r.user_id,
  'return'::VARCHAR(20)       AS type,
  r.items,
  r.reason,
  r.description               AS reason_detail,
  r.refund_amount             AS amount,
  r.refund_method,
  r.bank_name,
  r.bank_account,
  r.account_holder,
  r.initiated_by,
  r.admin_memo,
  r.tracking_number           AS return_tracking_number,
  r.tracking_company_id       AS return_company_id,
  r.collected_at,
  r.approved_at,
  r.completed_at,
  CASE r.status
    WHEN 'collected' THEN 'collected'
    ELSE r.status
  END                         AS status,
  r.created_at
FROM returns r
ON CONFLICT DO NOTHING;

-- 5. returns 테이블 삭제
DROP TABLE IF EXISTS returns;

-- 6. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_refunds_gf_return_service_id
  ON refunds(gf_return_service_id) WHERE gf_return_service_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_exchanges_gf_return_service_id
  ON exchanges(gf_return_service_id) WHERE gf_return_service_id IS NOT NULL;
