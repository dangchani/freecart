-- Migration: 사용자 태그 기능 추가

-- 1) 시스템 설정 추가
INSERT INTO system_settings (key, value, description)
VALUES ('enable_user_tags', 'false'::jsonb, '사용자 태그 기능 ON/OFF. true이면 회원 관리에서 태그 사이드바/태그 관리 탭이 표시됨')
ON CONFLICT (key) DO NOTHING;

-- 2) user_tags 테이블
CREATE TABLE IF NOT EXISTS user_tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL,
  color      VARCHAR(20)  NOT NULL DEFAULT '#6366f1',
  sort_order INTEGER      NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(name, created_by)
);

-- 3) user_tag_members 테이블
CREATE TABLE IF NOT EXISTS user_tag_members (
  tag_id   UUID NOT NULL REFERENCES user_tags(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tag_id, user_id)
);

-- 4) RLS
ALTER TABLE user_tags        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tag_members ENABLE ROW LEVEL SECURITY;

-- user_tags: 어드민은 본인 태그만, 슈퍼어드민은 전체 조회/수정/삭제
DROP POLICY IF EXISTS "user_tags_select_admin" ON user_tags;
CREATE POLICY "user_tags_select_admin" ON user_tags
  FOR SELECT USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "user_tags_insert_admin" ON user_tags;
CREATE POLICY "user_tags_insert_admin" ON user_tags
  FOR INSERT WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "user_tags_update_own_or_super" ON user_tags;
CREATE POLICY "user_tags_update_own_or_super" ON user_tags
  FOR UPDATE USING (is_super_admin(auth.uid()) OR created_by = auth.uid())
  WITH CHECK (is_super_admin(auth.uid()) OR created_by = auth.uid());

DROP POLICY IF EXISTS "user_tags_delete_own_or_super" ON user_tags;
CREATE POLICY "user_tags_delete_own_or_super" ON user_tags
  FOR DELETE USING (is_super_admin(auth.uid()) OR created_by = auth.uid());

-- user_tag_members: 어드민 조회, 본인 태그에만 추가/제거 (슈퍼어드민 전체)
DROP POLICY IF EXISTS "user_tag_members_select_admin" ON user_tag_members;
CREATE POLICY "user_tag_members_select_admin" ON user_tag_members
  FOR SELECT USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "user_tag_members_insert_admin" ON user_tag_members;
CREATE POLICY "user_tag_members_insert_admin" ON user_tag_members
  FOR INSERT WITH CHECK (
    is_super_admin(auth.uid()) OR
    EXISTS (SELECT 1 FROM user_tags WHERE id = tag_id AND created_by = auth.uid())
  );

DROP POLICY IF EXISTS "user_tag_members_delete_admin" ON user_tag_members;
CREATE POLICY "user_tag_members_delete_admin" ON user_tag_members
  FOR DELETE USING (
    is_super_admin(auth.uid()) OR
    EXISTS (SELECT 1 FROM user_tags WHERE id = tag_id AND created_by = auth.uid())
  );
