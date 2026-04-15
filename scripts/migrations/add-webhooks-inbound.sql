-- webhook_logs에 duration_ms 컬럼 추가
ALTER TABLE webhook_logs ADD COLUMN IF NOT EXISTS duration_ms INTEGER;

-- 수신 웹훅 엔드포인트 (PG사, 외부 서비스 등에서 Freecart로 들어오는 웹훅)
CREATE TABLE IF NOT EXISTS inbound_webhooks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source      VARCHAR(50) NOT NULL UNIQUE,  -- 'toss', 'goodsflow', 'custom' 등
  label       VARCHAR(100) NOT NULL,         -- 사람이 읽기 좋은 이름
  secret_key  VARCHAR(128),                  -- 검증용 시크릿 (HMAC 또는 단순 비교)
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_inbound_webhooks_updated_at ON inbound_webhooks;
CREATE TRIGGER trg_inbound_webhooks_updated_at
  BEFORE UPDATE ON inbound_webhooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 수신 웹훅 로그
CREATE TABLE IF NOT EXISTS inbound_webhook_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source      VARCHAR(50) NOT NULL,
  event_type  VARCHAR(100),
  payload     JSONB       NOT NULL DEFAULT '{}',
  is_verified BOOLEAN     NOT NULL DEFAULT false,  -- 서명 검증 통과 여부
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbound_webhook_logs_source      ON inbound_webhook_logs(source);
CREATE INDEX IF NOT EXISTS idx_inbound_webhook_logs_received_at ON inbound_webhook_logs(received_at DESC);

-- 기본 수신 웹훅 소스 등록 (토스페이먼츠)
INSERT INTO inbound_webhooks (source, label, is_active)
VALUES ('toss', '토스페이먼츠', true)
ON CONFLICT (source) DO NOTHING;
