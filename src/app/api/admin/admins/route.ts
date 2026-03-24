import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'edge';

const createAdminSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.enum(['admin', 'super_admin']),
  password: z.string().min(8).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search');
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('users')
      .select('id, email, name, role, is_active, created_at, last_sign_in_at', { count: 'exact' })
      .in('role', ['admin', 'super_admin'])
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: '관리자 목록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const body = await request.json();
    const adminData = createAdminSchema.parse(body);

    // Check if user with this email already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, role')
      .eq('email', adminData.email)
      .single();

    if (existingUser) {
      // If user exists but is not admin, promote to admin
      if (existingUser.role !== 'admin' && existingUser.role !== 'super_admin') {
        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update({ role: adminData.role, name: adminData.name })
          .eq('id', existingUser.id)
          .select('id, email, name, role, is_active, created_at')
          .single();

        if (updateError) {
          return NextResponse.json({ success: false, error: updateError.message }, { status: 400 });
        }

        return NextResponse.json({
          success: true,
          data: updatedUser,
          message: '기존 사용자에게 관리자 권한이 부여되었습니다.',
        });
      }

      return NextResponse.json(
        { success: false, error: '이미 관리자 계정이 존재합니다.' },
        { status: 409 }
      );
    }

    // Create new user in auth
    const temporaryPassword = adminData.password || `Temp${Math.random().toString(36).slice(2, 10)}!`;

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: adminData.email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        name: adminData.name,
        role: adminData.role,
      },
    });

    if (authError) {
      return NextResponse.json({ success: false, error: authError.message }, { status: 400 });
    }

    // Set role in users table
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .upsert({
        id: authData.user.id,
        email: adminData.email,
        name: adminData.name,
        role: adminData.role,
        is_active: true,
      })
      .select('id, email, name, role, is_active, created_at')
      .single();

    if (userError) {
      return NextResponse.json({ success: false, error: userError.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        success: true,
        data: newUser,
        message: '관리자 계정이 생성되었습니다.',
        temporary_password: adminData.password ? undefined : temporaryPassword,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: '입력값이 올바르지 않습니다.', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: '관리자 계정 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
