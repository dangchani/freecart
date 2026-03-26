-- Migration: Add theme storage fields
-- 테마 시스템에 Supabase Storage 지원을 위한 필드 추가
-- 실행: Supabase SQL Editor에서 실행하세요

-- installed_themes 테이블에 새 컬럼 추가
ALTER TABLE installed_themes
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS css_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS thumbnail_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}';

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_installed_themes_slug ON installed_themes(slug);

-- Supabase Storage 버킷 생성 (Supabase Dashboard에서 수동 생성 또는 아래 SQL 실행)
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('themes', 'themes', true)
-- ON CONFLICT (id) DO NOTHING;

-- Storage 정책 설정 (인증된 사용자만 업로드 가능, 읽기는 모두 가능)
-- CREATE POLICY "Public read access" ON storage.objects FOR SELECT USING (bucket_id = 'themes');
-- CREATE POLICY "Authenticated upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'themes' AND auth.role() = 'authenticated');
-- CREATE POLICY "Owner delete" ON storage.objects FOR DELETE USING (bucket_id = 'themes' AND auth.uid()::text = owner);

COMMENT ON COLUMN installed_themes.css_url IS 'Supabase Storage에 저장된 테마 CSS 파일 URL';
COMMENT ON COLUMN installed_themes.thumbnail_url IS 'Supabase Storage에 저장된 테마 썸네일 URL';
COMMENT ON COLUMN installed_themes.config IS '테마 설정 (색상, 레이아웃 등) JSON';
