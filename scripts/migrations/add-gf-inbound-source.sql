-- 굿스플로 수신 웹훅 소스 등록
INSERT INTO inbound_webhooks (source, label, is_active)
VALUES ('goodsflow', '굿스플로', true)
ON CONFLICT (source) DO NOTHING;
