import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateNotificationSettingsSchema = z.object({
  email_order: z.boolean().optional(),
  email_shipping: z.boolean().optional(),
  email_marketing: z.boolean().optional(),
  sms_order: z.boolean().optional(),
  sms_shipping: z.boolean().optional(),
  sms_marketing: z.boolean().optional(),
  push_enabled: z.boolean().optional(),
});

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('notification_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      // Return default settings if not found
      const defaultSettings = {
        user_id: user.id,
        email_order: true,
        email_shipping: true,
        email_marketing: false,
        sms_order: true,
        sms_shipping: true,
        sms_marketing: false,
        push_enabled: true,
      };

      // Create default settings record
      const { data: created, error: createError } = await supabase
        .from('notification_settings')
        .insert(defaultSettings)
        .select()
        .single();

      if (createError) {
        // Return defaults even if insert fails
        return NextResponse.json({ success: true, data: defaultSettings });
      }

      return NextResponse.json({ success: true, data: created });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('GET /users/me/notification-settings error:', error);
    return NextResponse.json(
      { success: false, error: '알림 설정을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const updates = updateNotificationSettingsSchema.parse(body);

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: '변경할 내용이 없습니다.' },
        { status: 400 }
      );
    }

    // Upsert notification settings
    const { data, error } = await supabase
      .from('notification_settings')
      .upsert(
        {
          user_id: user.id,
          ...updates,
        },
        {
          onConflict: 'user_id',
        }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: '알림 설정 업데이트 중 오류가 발생했습니다.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0]?.message ?? '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }
    console.error('PATCH /users/me/notification-settings error:', error);
    return NextResponse.json(
      { success: false, error: '알림 설정 업데이트 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
