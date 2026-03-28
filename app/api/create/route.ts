import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

function makeSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      school_name: string;
      admin_email: string;
      admin_name: string;
      board?: string;
      contact_phone?: string;
    };

    const { school_name, admin_email, admin_name } = body;

    if (!school_name || !admin_email || !admin_name) {
      return NextResponse.json({ error: 'school_name, admin_email, admin_name required' }, { status: 400 });
    }

    const slug = makeSlug(school_name);

    // Check slug uniqueness
    const { data: existing } = await supabaseAdmin
      .from('schools')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'A school with this name already exists' }, { status: 409 });
    }

    // Create school
    const { data: school, error: schoolErr } = await supabaseAdmin
      .from('schools')
      .insert({
        name: school_name,
        slug,
        plan: 'starter',
        board: body.board ?? 'CBSE',
        contact_email: admin_email,
        contact_phone: body.contact_phone ?? null,
        is_active: true,
        onboarded_at: new Date().toISOString(),
      })
      .select('id, name, slug, plan')
      .single();

    if (schoolErr || !school) throw new Error(schoolErr?.message ?? 'Failed to create school');

    // Create admin user
    const { error: userErr } = await supabaseAdmin
      .from('school_users')
      .insert({
        school_id: school.id,
        email: admin_email.toLowerCase().trim(),
        name: admin_name,
        role: 'owner',
      });

    if (userErr) throw new Error(userErr.message);

    // Seed usage limits for starter plan
    await supabaseAdmin.from('usage_limits').insert({
      school_id: school.id,
      plan: 'starter',
      max_reports_per_month: 20,
      max_evaluations_per_month: 5,
      max_broadcasts_per_month: 10,
      max_leads_per_month: 50,
      max_students: 100,
      max_staff: 10,
    });

    // Seed a demo event
    await supabaseAdmin.from('events').insert({
      school_id: school.id,
      title: 'Welcome to School OS!',
      description: 'Your school is now onboarded. Start by adding students and staff.',
      event_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      is_holiday: false,
    });

    return NextResponse.json({
      success: true,
      school: { id: school.id, name: school.name, slug: school.slug, plan: school.plan },
      login: { email: admin_email, password: 'admin@123' },
      message: 'School created. Use email + password "admin@123" to login.',
    });

  } catch (err) {
    console.error('School create error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
