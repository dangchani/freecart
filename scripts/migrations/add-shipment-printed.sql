-- shipments 테이블에 굿스플로 출력 여부 컬럼 추가
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS gf_printed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS gf_printed_at TIMESTAMPTZ;
