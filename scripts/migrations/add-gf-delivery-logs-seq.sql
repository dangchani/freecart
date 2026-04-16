-- =============================================================================
-- gf_delivery_logs seq 컬럼 추가 + 중복 방지 unique index
-- 기존 데이터는 seq = NULL 허용 → 제약 대상 외
-- 신규 데이터부터 (gf_service_id, seq) 쌍 중복 방지
-- =============================================================================

ALTER TABLE gf_delivery_logs
  ADD COLUMN IF NOT EXISTS seq INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS gf_delivery_logs_service_seq_unique
  ON gf_delivery_logs (gf_service_id, seq)
  WHERE seq IS NOT NULL;
