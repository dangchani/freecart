// joy: signup-attachments 버킷에 파일 업로드 후 Public URL 반환
import { createClient } from '@/lib/supabase/client';

const BUCKET = 'signup-attachments';

export async function uploadSignupFile(userId: string, fieldKey: string, file: File): Promise<string> {
  const supabase = createClient();
  const safeName = file.name.replace(/[^\w.-]/g, '_');
  const path = `${userId}/${fieldKey}/${Date.now()}_${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
