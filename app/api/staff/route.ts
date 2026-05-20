import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId, MissingSchoolIdError } from '@/lib/getSchoolId';

export async function GET(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);

    // Fetch staff with invite status from school_users
    const { data: staffRows, error } = await supabaseAdmin
      .from('staff')
      .select(`
        id, name, role, subject, email, phone, is_active,
        designation, created_at,
        school_users!school_users_staff_id_fkey (
          invite_status, auth_verified, first_login_at, last_login
        )
      `)
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('name');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Flatten school_users join into staff row
    const staff = (staffRows ?? []).map((s) => {
      const su = Array.isArray(s.school_users) ? s.school_users[0] : s.school_users;
      return {
        id:             s.id,
        name:           s.name,
        role:           s.role,
        subject:        s.subject,
        email:          s.email,
        phone:          s.phone,
        is_active:      s.is_active,
        designation:    s.designation,
        created_at:     s.created_at,
        invite_status:  (su as { invite_status?: string } | null)?.invite_status ?? 'pending',
        auth_verified:  (su as { auth_verified?: boolean } | null)?.auth_verified ?? false,
        first_login_at: (su as { first_login_at?: string } | null)?.first_login_at ?? null,
        last_login:     (su as { last_login?: string } | null)?.last_login ?? null,
      };
    });

    return NextResponse.json({ staff, count: staff.length });
  } catch (err) {
    if (err instanceof MissingSchoolIdError) return NextResponse.json({ error: 'No session' }, { status: 401 });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
