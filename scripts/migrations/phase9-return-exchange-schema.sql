-- Phase 9: Returns & Exchanges Schema Extension
-- 반품/교환 상태 흐름 추가 및 운송장 추적 컬럼 확장

-- ── returns 테이블 컬럼 추가 ────────────────────────────────────────
ALTER TABLE returns
  ADD COLUMN IF NOT EXISTS tracking_number      VARCHAR(50),
  ADD COLUMN IF NOT EXISTS tracking_company_id  UUID REFERENCES shipping_companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS collected_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at         TIMESTAMPTZ;

-- 상태값: pending → approved → collected → completed | rejected

-- ── exchanges 테이블 컬럼 추가 ──────────────────────────────────────
ALTER TABLE exchanges
  ADD COLUMN IF NOT EXISTS tracking_number          VARCHAR(50),
  ADD COLUMN IF NOT EXISTS tracking_company_id      UUID REFERENCES shipping_companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reship_tracking_number   VARCHAR(50),
  ADD COLUMN IF NOT EXISTS reship_company_id        UUID REFERENCES shipping_companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS collected_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reshipped_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at             TIMESTAMPTZ;

-- 상태값: pending → approved → collected → reshipped → completed | rejected
