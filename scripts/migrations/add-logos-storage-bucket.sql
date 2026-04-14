-- 로고 이미지 스토리지 버킷 생성
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  true,
  2097152, -- 2MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- 공개 읽기 정책
CREATE POLICY "logos_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'logos');

-- 관리자만 업로드/수정/삭제 가능
CREATE POLICY "logos_insert_admin"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'logos' AND is_admin(auth.uid()));

CREATE POLICY "logos_update_admin"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'logos' AND is_admin(auth.uid()));

CREATE POLICY "logos_delete_admin"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'logos' AND is_admin(auth.uid()));
