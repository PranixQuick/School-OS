import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

function makeSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export async function POST(req: NextRequest) {
  let schoolId: string | null = null;

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
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'A school with this name already exists' }, { status: 409 });
    }

    // Step 1: Create school
    const { data: school, error: schoolErr } = await supabaseAdmin
      .from('schools')
      .insert({
        name: school_name,
        slug,
        plan: 'free',
        board: body.board ?? 'CBSE',
        contact_email: admin_email,
        contact_phone: body.contact_phone ?? null,
        is_active: true,
        onboarded_at: new Date().toISOString(),
      })
      .select('id, name, slug, plan')
      .single();

    if (schoolErr || !school) throw new Error(schoolErr?.message ?? 'Failed to create school');

    // Track school ID for rollback if subsequent steps fail
    schoolId = school.id;

    // Step 2: Create admin user
    // If this fails, we delete the school so the slug is freed (no orphan)
    const { error: userErr } = await supabaseAdmin
      .from('school_users')
      .insert({
        school_id: school.id,
        email: admin_email.toLowerCase().trim(),
        name: admin_name,
        role: 'owner',
      });

    if (userErr) {
      // Rollback: delete school — the DB trigger will cascade-delete config + limits
      await supabaseAdmin.from('schools').delete().eq('id', school.id);
      schoolId = null;
      throw new Error(`Failed to create admin user: ${userErr.message}`);
    }

    // Note: school_config and usage_limits are auto-provisioned by the
    // DB trigger trg_provision_school (applied in edge_case_hardening migration).
    // No manual insert needed.

    // Step 3: Seed a welcome event
    await supabaseAdmin.from('events').insert({
      school_id: school.id,
      title: 'Welcome to School OS!',
      description: 'Your school is now onboarded. Start by adding students and staff.',
      event_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      is_holiday: false,
    });

    const initialPassword = `schoolos${school.id.slice(0, 4)}`;
    return NextResponse.json({
      success: true,
      school: { id: school.id, name: school.name, slug: school.slug, plan: school.plan },
      login: { email: admin_email, password: initialPassword },
      message: `School created successfully. Login with your email and password: ${initialPassword}`,
    });

  } catch (err) {
    console.error('School create error:', err);
    // Safety net rollback: if school was created but something after it failed
    if (schoolId) {
      try {
        await supabaseAdmin.from('schools').delete().eq('id', schoolId);
      } catch (rollbackErr) {
        console.error('Rollback failed:', rollbackErr);
      }
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
