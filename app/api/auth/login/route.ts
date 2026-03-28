import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { encodeSession, SchoolSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json() as { email: string; password: string };

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    // Find user in school_users by email
    const { data: schoolUser, error: userErr } = await supabaseAdmin
      .from('school_users')
      .select('id, school_id, email, name, role, is_active')
      .eq('email', email.toLowerCase().trim())
      .eq('is_active', true)
      .single();

    if (userErr || !schoolUser) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Password: "schoolos" + first 4 chars of school_id (e.g. schoolos0000)
    // Replace with Supabase Auth for production use
    const expectedPassword = `schoolos${schoolUser.school_id.slice(0, 4)}`;
    const isDemoPassword = password === expectedPassword;

    if (!isDemoPassword) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Fetch school details
    const { data: school } = await supabaseAdmin
      .from('schools')
      .select('id, name, slug, plan')
      .eq('id', schoolUser.school_id)
      .single();

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    // Build session
    const session: SchoolSession = {
      schoolId: school.id,
      schoolName: school.name,
      schoolSlug: school.slug ?? school.id,
      plan: school.plan,
      userId: schoolUser.id,
      userEmail: schoolUser.email,
      userRole: schoolUser.role,
      userName: schoolUser.name,
    };

    // Update last login
    await supabaseAdmin
      .from('school_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', schoolUser.id);

    const sessionCookie = encodeSession(session);
    const response = NextResponse.json({ success: true, school: school.name, role: schoolUser.role });

    response.cookies.set('school_session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
