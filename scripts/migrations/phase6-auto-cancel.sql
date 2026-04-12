-- Phase 6: 미입금 자동취소 배치
-- pending 상태이면서 payment_deadline이 만료된 주문을 자동으로 취소합니다.

-- ── auto_cancel_pending_orders() DB 함수 ──────────────────────────
-- 매 실행 시 아래를 처리:
--   - status = 'pending' AND payment_deadline <= NOW() 인 주문 → cancelled 전이
--   - order_status_history 이력 기록
--   - 주문 아이템별 재고 복구 (increment_variant_stock / increment_product_stock)
-- 반환값: 취소 처리된 주문 수
-- ※ 포인트·쿠폰·예치금은 pending(미결제) 상태에서 소비되지 않으므로 복구 불필요
--   예외 케이스는 관리자 수동 실행 시 JS executeFullCancel() 에서 처리

CREATE OR REPLACE FUNCTION auto_cancel_pending_orders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r              RECORD;
  item_rec       RECORD;
  cancelled_count INTEGER := 0;
BEGIN
  FOR r IN
    SELECT id, status
    FROM orders
    WHERE status = 'pending'
      AND payment_deadline IS NOT NULL
      AND payment_deadline <= NOW()
  LOOP
    -- 주문 상태 cancelled 로 업데이트
    UPDATE orders
    SET status       = 'cancelled',
        cancelled_at = NOW(),
        cancel_reason = '미입금 자동취소'
    WHERE id = r.id;

    -- 상태 이력 기록
    INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, note)
    VALUES (r.id, 'pending', 'cancelled', 'system', '미입금 자동취소 (입금기한 초과)');

    -- 주문 아이템 재고 복구
    FOR item_rec IN
      SELECT product_id, variant_id, quantity, item_type
      FROM order_items
      WHERE order_id = r.id
    LOOP
      -- 사은품은 재고 복구 제외
      IF COALESCE(item_rec.item_type, 'purchase') = 'gift' THEN
        CONTINUE;
      END IF;

      IF item_rec.variant_id IS NOT NULL THEN
        PERFORM increment_variant_stock(item_rec.variant_id, item_rec.quantity);
      ELSIF item_rec.product_id IS NOT NULL THEN
        PERFORM increment_product_stock(item_rec.product_id, item_rec.quantity);
      END IF;
    END LOOP;

    cancelled_count := cancelled_count + 1;
  END LOOP;

  RETURN cancelled_count;
END;
$$;

-- ── pg_cron 스케줄 등록 (매 30분) ─────────────────────────────────
-- Supabase 프로젝트에서 pg_cron 활성화 후 아래 실행:
--
-- SELECT cron.schedule(
--   'auto-cancel-unpaid',
--   '*/30 * * * *',
--   'SELECT auto_cancel_pending_orders()'
-- );
