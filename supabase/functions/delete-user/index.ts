import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // 호출자 권한 확인 (admin / super_admin 만 허용)
    const authHeader = req.headers.get('Authorization') ?? '';
    const caller = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: callerUser } } = await caller.auth.getUser();
    if (!callerUser) return json({ ok: false, error: '인증이 필요합니다.' }, 401);

    const { data: callerProfile } = await supabase
      .from('users').select('role').eq('id', callerUser.id).maybeSingle();
    if (!callerProfile || (callerProfile.role !== 'admin' && callerProfile.role !== 'super_admin')) {
      return json({ ok: false, error: '관리자 권한이 필요합니다.' }, 403);
    }

    const { targetUserId } = await req.json() as { targetUserId: string };
    if (!targetUserId) return json({ ok: false, error: 'targetUserId 가 필요합니다.' }, 400);

    // 자기 자신은 삭제 불가
    if (targetUserId === callerUser.id) {
      return json({ ok: false, error: '자기 자신은 삭제할 수 없습니다.' }, 400);
    }

    // super_admin 계정은 삭제 불가
    const { data: targetProfile } = await supabase
      .from('users').select('role').eq('id', targetUserId).maybeSingle();
    if (targetProfile?.role === 'super_admin') {
      return json({ ok: false, error: 'super_admin 계정은 삭제할 수 없습니다.' }, 403);
    }

    // GoTrue Admin API로 삭제 시도
    const { error: deleteError } = await supabase.auth.admin.deleteUser(targetUserId);

    if (deleteError) {
      // auth.identities 없는 관리자 직접 생성 회원의 경우 "User not found" 발생
      // → delete_auth_user_direct RPC로 auth.users 직접 삭제
      if (deleteError.message?.toLowerCase().includes('user not found')) {
        const { error: rpcErr } = await supabase.rpc('delete_auth_user_direct', { p_user_id: targetUserId });
        if (rpcErr && !rpcErr.message?.toLowerCase().includes('not found')) {
          throw rpcErr;
        }
      } else {
        throw deleteError;
      }
    }

    // auth 삭제 성공(또는 fallback) 후 public.users 명시적 삭제
    // (CASCADE 미설정 시에도 리스트에서 제거되도록)
    const { error: pubErr } = await supabase
      .from('users')
      .delete()
      .eq('id', targetUserId);
    if (pubErr) throw pubErr;

    return json({ ok: true });
  } catch (err: any) {
    return json({ ok: false, error: err?.message ?? 'Internal error' }, 500);
  }
});
