-- Phase 10: 자동 구매확정 + 포인트 적립

-- ── 1. settings에 auto_confirm_days 키 추가 ────────────────────────
INSERT INTO settings (id, key, value, description)
VALUES (gen_random_uuid(), 'auto_confirm_days', '7', '배송완료 후 자동 구매확정까지 일수')
ON CONFLICT (key) DO NOTHING;

-- ── 2. auto_confirm_orders() DB 함수 ──────────────────────────────
-- 매 실행 시 아래를 처리:
--   - delivered 상태이면서 auto_confirm_at <= NOW() 인 주문 → confirmed 전이
--   - order_status_history 이력 기록
--   - earned_points > 0 이고 아직 미적립이면 포인트 적립
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
    -- 주문 상태 confirmed 으로 업데이트
    UPDATE orders
    SET status       = 'confirmed',
        confirmed_at = NOW()
    WHERE id = r.id;

    -- 상태 이력 기록
    INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, note)
    VALUES (r.id, 'delivered', 'confirmed', 'system', '자동 구매확정 (배송완료 후 7일)');

    -- 포인트 적립 (earned_points > 0 이고, 아직 적립된 이력이 없을 때만)
    IF r.earned_points > 0 AND r.user_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM user_points_history
        WHERE reference_type = 'order'
          AND reference_id   = r.id
          AND type           = 'earn'
      ) INTO already_earned;

      IF NOT already_earned THEN
        SELECT COALESCE(points, 0) INTO current_pts
        FROM users WHERE id = r.user_id;

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

-- ── 3. pg_cron 스케줄 등록 (매시간 정각) ──────────────────────────
-- pg_cron 익스텐션이 활성화된 경우에만 동작합니다.
-- Supabase 프로젝트에서 pg_cron 활성화 후 아래 실행:
--
-- SELECT cron.schedule(
--   'auto-confirm-orders',
--   '0 * * * *',
--   'SELECT auto_confirm_orders()'
-- );
