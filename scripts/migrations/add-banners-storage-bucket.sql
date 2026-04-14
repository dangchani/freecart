-- 배너 이미지 스토리지 버킷 추가

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'banners',
  'banners',
  true,
  10485760,  -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 누구나 조회 가능
DROP POLICY IF EXISTS "banners_storage_select" ON storage.objects;
CREATE POLICY "banners_storage_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'banners');

-- 인증된 사용자만 업로드
DROP POLICY IF EXISTS "banners_storage_insert" ON storage.objects;
CREATE POLICY "banners_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'banners' AND auth.role() = 'authenticated');

-- 인증된 사용자만 삭제
DROP POLICY IF EXISTS "banners_storage_delete" ON storage.objects;
CREATE POLICY "banners_storage_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'banners' AND auth.role() = 'authenticated');
