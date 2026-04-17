-- =============================================================================
-- 배송 출발(out_for_delivery) 고객 알림 토글 설정 추가
-- 기본값: true (알림 발송)
-- =============================================================================

INSERT INTO system_settings (key, value, description)
VALUES ('notify_out_for_delivery', 'true', '배송 출발 시 고객 알림 발송 여부')
ON CONFLICT (key) DO NOTHING;
