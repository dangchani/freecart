-- shipments 테이블에 굿스플로 전용 컬럼 추가
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS gf_service_id  VARCHAR(30),   -- 굿스플로 서비스 ID
  ADD COLUMN IF NOT EXISTS gf_invoice_url TEXT;           -- 송장 출력 URL (참조용)

CREATE INDEX IF NOT EXISTS idx_shipments_gf_service_id ON shipments(gf_service_id);

-- 굿스플로 배송 이벤트 로그
CREATE TABLE IF NOT EXISTS gf_delivery_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID        REFERENCES orders(id) ON DELETE SET NULL,
  gf_service_id   VARCHAR(30) NOT NULL,
  delivery_status VARCHAR(30),
  raw_payload     JSONB       NOT NULL DEFAULT '{}',
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gf_delivery_logs_gf_service_id ON gf_delivery_logs(gf_service_id);
CREATE INDEX IF NOT EXISTS idx_gf_delivery_logs_received_at   ON gf_delivery_logs(received_at DESC);

-- 굿스플로 캐시 설정값 (운영/테스트 분리)
INSERT INTO system_settings (key, value, description) VALUES
  ('gf_centers_prod',   '[]', '굿스플로 운영 출고지 목록'),
  ('gf_centers_test',   '[]', '굿스플로 테스트 출고지 목록'),
  ('gf_contracts_prod', '[]', '굿스플로 운영 계약 목록 (APPROVED)'),
  ('gf_contracts_test', '[]', '굿스플로 테스트 계약 목록 (APPROVED)'),
  ('gf_last_sync_at',   '""', '굿스플로 마지막 동기화 시각')
ON CONFLICT (key) DO NOTHING;
