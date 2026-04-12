-- =============================================================================
-- Phase 1: Order Schema Extension
-- 주문 프로세스 구현을 위한 DB 스키마 확장
-- =============================================================================

-- 1. orders 테이블 보완
--    - payment_deadline : 무통장/가상계좌 입금 마감 시각 (자동취소 기준)
--    - auto_confirm_at  : 자동 구매확정 예정 시각 (배송완료 후 N일)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_deadline  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_confirm_at   TIMESTAMPTZ;

-- 2. cash_receipts (현금영수증)
CREATE TABLE IF NOT EXISTS cash_receipts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id         UUID        REFERENCES users(id) ON DELETE SET NULL,

  -- 발급 유형
  receipt_type    VARCHAR(20) NOT NULL
                  CHECK (receipt_type IN ('income_deduction', 'business_expense')),
  -- income_deduction : 소득공제 (개인 — 휴대폰번호)
  -- business_expense : 지출증빙 (사업자 — 사업자등록번호)

  identifier_type VARCHAR(20) NOT NULL
                  CHECK (identifier_type IN ('phone', 'business_number', 'card')),
  identifier      VARCHAR(30) NOT NULL,   -- 전화번호 / 사업자번호 / 현금영수증카드번호

  amount          INTEGER     NOT NULL,

  -- PG사 발급 정보 (토스페이먼츠)
  pg_provider     VARCHAR(30),
  pg_receipt_id   VARCHAR(100),           -- 토스페이먼츠 현금영수증 ID
  issued_at       TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,

  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'issued', 'cancelled', 'failed')),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_receipts_order_id ON cash_receipts(order_id);
CREATE INDEX IF NOT EXISTS idx_cash_receipts_status   ON cash_receipts(status);

DROP TRIGGER IF EXISTS trg_cash_receipts_updated_at ON cash_receipts;
CREATE TRIGGER trg_cash_receipts_updated_at
  BEFORE UPDATE ON cash_receipts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. tax_invoices (세금계산서)
CREATE TABLE IF NOT EXISTS tax_invoices (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id           UUID        REFERENCES users(id) ON DELETE SET NULL,

  -- 공급받는자 사업자 정보
  business_name     VARCHAR(100) NOT NULL,   -- 상호
  business_number   VARCHAR(20)  NOT NULL,   -- 사업자등록번호 (000-00-00000)
  ceo_name          VARCHAR(50),             -- 대표자명
  business_address  VARCHAR(255),
  business_type     VARCHAR(50),             -- 업태
  business_item     VARCHAR(50),             -- 종목
  manager_name      VARCHAR(50),             -- 담당자
  manager_email     VARCHAR(100),            -- 담당자 이메일 (전송 대상)

  -- 금액
  supply_amount     INTEGER     NOT NULL,    -- 공급가액
  tax_amount        INTEGER     NOT NULL,    -- 세액
  total_amount      INTEGER     NOT NULL,    -- 합계금액

  -- 국세청 전송 정보
  nts_result_code   VARCHAR(10),             -- 국세청 처리 결과 코드
  nts_issued_at     TIMESTAMPTZ,             -- 국세청 발행일시
  invoice_number    VARCHAR(50),             -- 세금계산서 승인번호

  issue_type        VARCHAR(20) NOT NULL DEFAULT 'electronic'
                    CHECK (issue_type IN ('electronic', 'manual')),

  status            VARCHAR(20) NOT NULL DEFAULT 'requested'
                    CHECK (status IN ('requested', 'issued', 'cancelled', 'failed')),

  admin_memo        TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tax_invoices_order_id        ON tax_invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_tax_invoices_business_number ON tax_invoices(business_number);
CREATE INDEX IF NOT EXISTS idx_tax_invoices_status          ON tax_invoices(status);

DROP TRIGGER IF EXISTS trg_tax_invoices_updated_at ON tax_invoices;
CREATE TRIGGER trg_tax_invoices_updated_at
  BEFORE UPDATE ON tax_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- RLS 정책
-- =============================================================================

ALTER TABLE cash_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_receipts_user_select" ON cash_receipts;
CREATE POLICY "cash_receipts_user_select" ON cash_receipts
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "cash_receipts_user_insert" ON cash_receipts;
CREATE POLICY "cash_receipts_user_insert" ON cash_receipts
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "cash_receipts_admin" ON cash_receipts;
CREATE POLICY "cash_receipts_admin" ON cash_receipts
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

ALTER TABLE tax_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tax_invoices_user_select" ON tax_invoices;
CREATE POLICY "tax_invoices_user_select" ON tax_invoices
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "tax_invoices_user_insert" ON tax_invoices;
CREATE POLICY "tax_invoices_user_insert" ON tax_invoices
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "tax_invoices_admin" ON tax_invoices;
CREATE POLICY "tax_invoices_admin" ON tax_invoices
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );
