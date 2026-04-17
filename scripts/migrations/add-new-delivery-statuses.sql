-- =============================================================================
-- 신규 배송 상태 추가: transferred / picked_up / out_for_delivery
-- orders.status, shipments.status CHECK 제약 업데이트
-- =============================================================================

-- orders.status CHECK 제약 업데이트
ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_status_check CHECK (status IN (
    'pending', 'paid', 'processing',
    'shipped', 'transferred', 'picked_up', 'out_for_delivery',
    'delivered', 'confirmed',
    'cancelled', 'return_requested', 'returned'
  ));

-- shipments.status CHECK 제약 업데이트
ALTER TABLE shipments
  DROP CONSTRAINT IF EXISTS shipments_status_check;

ALTER TABLE shipments
  ADD CONSTRAINT shipments_status_check CHECK (status IN (
    'pending', 'shipped',
    'transferred', 'picked_up', 'out_for_delivery',
    'delivered', 'cancelled'
  ));
