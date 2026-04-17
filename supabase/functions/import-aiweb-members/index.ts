import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 아임웹 회원 한 건의 데이터 구조 (프론트에서 파싱해서 전달)
interface AiwebMember {
  email:           string;
  loginId:         string;
  name:            string;
  phone:           string;
  group:           string;      // 그룹값 (복수 가능, 콤마 구분)
  companyName:     string;      // 상호
  bizNum:          string;      // 사업자번호
  ceoName:         string;      // 대표자명
  sector:          string;      // 종목
  bizType:         string;      // 업태
  managerName:     string;      // 담당자명
  zipCode:         string;      // 우편번호
  address1:        string;      // 사업장주소
  address2:        string;      // 상세주소
  marketingAgreed: boolean;     // 메시지수신동의
  joinDate:        string;      // 가입일 (ISO or 'YYYY-MM-DD')
  lastLoginDate:   string;      // 마지막로그인
  adminMemo:       string;      // 관리자 메모
}

interface ImportResult {
  email:        string;
  loginId:      string;
  name:         string;
  tempPassword: string;
}

interface ImportError {
  email: string;
  error: string;
}

/** 임시 비밀번호 생성: 영문(대소) + 숫자 8자리 */
function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pw = '';
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  for (const n of arr) pw += chars[n % chars.length];
  return pw;
}

/** users.memo 조합: 담당자 / 그룹 / 관리자메모 */
function buildMemo(member: AiwebMember): string | null {
  const parts: string[] = [];
  if (member.managerName?.trim()) parts.push(`담당자: ${member.managerName.trim()}`);
  if (member.group?.trim())       parts.push(`그룹: ${member.group.trim()}`);
  if (member.adminMemo?.trim())   parts.push(member.adminMemo.trim());
  return parts.length > 0 ? parts.join('\n') : null;
}

/** 날짜 문자열 → ISO 변환 (실패 시 null) */
function toIso(dateStr: string): string | null {
  if (!dateStr?.trim()) return null;
  try {
    const d = new Date(dateStr.trim());
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl  = Deno.env.get('SUPABASE_URL')!;
    const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase     = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // 호출자가 admin/super_admin 인지 확인
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace('Bearer ', '');
    if (jwt) {
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const caller  = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false },
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await caller.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('users').select('role').eq('id', user.id).maybeSingle();
        if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
          return new Response(
            JSON.stringify({ ok: false, error: '관리자 권한이 필요합니다.' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
      }
    }

    const body = await req.json() as { members: AiwebMember[] };
    const members: AiwebMember[] = body.members ?? [];

    // 기본 등급 조회 (is_default=true 우선, 없으면 level 가장 낮은 것)
    let defaultLevelId: string;
    {
      const { data: byDefault } = await supabase
        .from('user_levels')
        .select('id')
        .eq('is_default', true)
        .limit(1)
        .maybeSingle();

      if (byDefault) {
        defaultLevelId = byDefault.id;
      } else {
        const { data: byLevel } = await supabase
          .from('user_levels')
          .select('id')
          .order('level', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (byLevel) {
          defaultLevelId = byLevel.id;
        } else {
          // 등급 미사용 환경 — 숨김 기본 등급 자동 생성
          const { data: created, error: createErr } = await supabase
            .from('user_levels')
            .insert({ level: 0, name: '기본', is_default: true })
            .select('id')
            .single();
          if (createErr || !created) {
            return new Response(
              JSON.stringify({ ok: false, error: `등급 자동 생성 실패: ${createErr?.message ?? '알 수 없는 오류'}` }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
          }
          defaultLevelId = created.id;
        }
      }
    }

    // signup_field_definitions 에서 B2B 필드 ID 조회
    const { data: fieldDefs } = await supabase
      .from('signup_field_definitions')
      .select('id, field_key')
      .in('field_key', ['company_name', 'business_number', 'ceo_name', 'business_sector', 'business_type']);

    const fieldIdMap: Record<string, string> = {};
    for (const d of (fieldDefs as any[]) ?? []) fieldIdMap[d.field_key] = d.id;

    const results:  ImportResult[] = [];
    const errors:   ImportError[]  = [];
    let   skipped   = 0;

    for (const member of members) {
      const email = member.email?.trim();

      // 이메일 없으면 스킵
      if (!email) {
        skipped++;
        continue;
      }

      const tempPassword = generateTempPassword();

      try {
        // 1. Supabase Auth 계정 생성
        const { data: authData, error: authError } =
          await supabase.auth.admin.createUser({
            email,
            password:      tempPassword,
            email_confirm: true,
          });

        if (authError) {
          // 이미 존재하는 이메일이면 조회
          if (authError.message?.includes('already registered') ||
              authError.message?.includes('already been registered') ||
              authError.code === 'email_exists') {
            errors.push({ email, error: '이미 존재하는 이메일입니다.' });
            continue;
          }
          throw authError;
        }

        const userId = authData.user!.id;

        // 2. users 테이블 upsert
        const memo      = buildMemo(member);
        const joinedAt  = toIso(member.joinDate);
        const lastLogin = toIso(member.lastLoginDate);

        // 기본 필드로 먼저 upsert 시도
        const userPayload: Record<string, unknown> = {
          id:               userId,
          email,
          level_id:         defaultLevelId,
          login_id:         member.loginId?.trim() || null,
          name:             member.name?.trim() || email.split('@')[0],
          phone:            member.phone?.trim() || null,
          memo:             memo,
          marketing_agreed: member.marketingAgreed ?? false,
          is_approved:      true,
          ...(joinedAt  ? { created_at:    joinedAt  } : {}),
          ...(lastLogin ? { last_login_at: lastLogin } : {}),
        };

        // must_change_password 컬럼이 있으면 포함 (마이그레이션 적용 여부 무관하게 동작)
        const { error: userError } = await supabase
          .from('users')
          .upsert({ ...userPayload, must_change_password: true }, { onConflict: 'id' });

        if (userError) {
          // must_change_password 컬럼 없음 → 해당 필드 제외하고 재시도
          if (userError.message?.includes('must_change_password') || userError.code === '42703') {
            const { error: retryError } = await supabase
              .from('users')
              .upsert(userPayload, { onConflict: 'id' });
            if (retryError) throw retryError;
          } else {
            throw userError;
          }
        }

        // 3. user_addresses insert (주소 있을 때)
        if (member.address1?.trim()) {
          await supabase.from('user_addresses').insert({
            user_id:        userId,
            name:           member.name?.trim() || '기본배송지',
            recipient_name: member.name?.trim() || '',
            recipient_phone: member.phone?.trim() || '',
            postal_code:    member.zipCode?.trim() || '',
            address1:       member.address1?.trim(),
            address2:       member.address2?.trim() || null,
            is_default:     true,
          });
        }

        // 4. user_field_values insert (B2B 필드)
        const fieldValues: { user_id: string; field_definition_id: string; value_text: string }[] = [];

        const b2bFields: [string, string][] = [
          ['company_name',    member.companyName],
          ['business_number', member.bizNum],
          ['ceo_name',        member.ceoName],
          ['business_sector', member.sector],
          ['business_type',   member.bizType],
        ];
        for (const [key, val] of b2bFields) {
          if (val?.trim() && fieldIdMap[key]) {
            fieldValues.push({
              user_id:              userId,
              field_definition_id:  fieldIdMap[key],
              value_text:           val.trim(),
            });
          }
        }
        if (fieldValues.length > 0) {
          await supabase.from('user_field_values').insert(fieldValues);
        }

        results.push({
          email,
          loginId:      member.loginId?.trim() || '',
          name:         member.name?.trim() || '',
          tempPassword,
        });
      } catch (err: any) {
        errors.push({ email, error: err?.message ?? String(err) });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        summary: {
          total:   members.length,
          success: results.length,
          skipped,
          failed:  errors.length,
        },
        results,
        errors,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err?.message ?? 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
