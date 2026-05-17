import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

function makeSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export async function POST(req: NextRequest) {
  let schoolId: string | null = null;
  let institutionId: string | null = null;

  try {
    const body = await req.json() as {
      school_name: string;
      admin_email: string;
      admin_name: string;
      board?: string;
      contact_phone?: string;
      institution_type?: string;
      ownership_type?: string;
    };

    const { school_name, admin_email, admin_name } = body;

    if (!school_name || !admin_email || !admin_name) {
      return NextResponse.json(
        { error: 'school_name, admin_email, admin_name required' },
        { status: 400 }
      );
    }

    const slug = makeSlug(school_name);

    // Check slug uniqueness
    const { data: existing } = await supabaseAdmin
      .from('schools')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'A school with this name already exists. Please use a different name.' },
        { status: 409 }
      );
    }

    // Step 1: Create institutions row
    // This captures the institution_type + ownership_type selected during registration.
    // Previously this was silently dropped because the provisioning trigger
    // (trg_provision_school) only creates school_config + usage_limits, not institutions.
    const instType = body.institution_type ?? 'school_k10';
    const ownType = body.ownership_type ?? 'private';

    // Determine feature flags from institution type at registration time
    const isGovt = ['govt_school', 'govt_aided_school', 'welfare_school'].includes(instType);
    const isPrivateOrFranchise = ['private', 'franchise'].includes(ownType);
    const isAided = ownType === 'aided';

    const { data: institution, error: instErr } = await supabaseAdmin
      .from('institutions')
      .insert({
        name: school_name,
        institution_type: instType,
        ownership_type: ownType,
        is_demo: false,
        feature_flags: {
          fee_module_enabled: isPrivateOrFranchise || isAided,
          meal_tracking_enabled: isGovt,
          rte_mode_enabled: isGovt || isAided,
          scholarship_tracking_enabled: isGovt || isAided,
          online_payment_enabled: false,
        },
      })
      .select('id')
      .single();

    if (instErr || !institution) {
      throw new Error(instErr?.message ?? 'Failed to create institution');
    }
    institutionId = institution.id;

    // Step 2: Create school — linked to the institutions row
    // IMPORTANT: onboarded_at is NOT set here.
    // It is set only when the owner completes the onboarding wizard
    // and clicks Activate at step 7. Setting it here would bypass the
    // OPS-5 activation guard (staff/class/student/subject preconditions).
    const { data: school, error: schoolErr } = await supabaseAdmin
      .from('schools')
      .insert({
        name: school_name,
        slug,
        plan: 'free',
        board: body.board ?? 'CBSE',
        contact_email: admin_email,
        contact_phone: body.contact_phone ?? null,
        institution_id: institutionId,
        is_active: true,
        // onboarded_at deliberately omitted — set only at wizard activation
      })
      .select('id, name, slug, plan')
      .single();

    if (schoolErr || !school) {
      throw new Error(schoolErr?.message ?? 'Failed to create school');
    }
    schoolId = school.id;

    // Step 3: Create admin/owner user
    const { error: userErr } = await supabaseAdmin
      .from('school_users')
      .insert({
        school_id: school.id,
        email: admin_email.toLowerCase().trim(),
        name: admin_name,
        role: 'owner',
      });

    if (userErr) {
      // Rollback: delete school and institution
      await supabaseAdmin.from('schools').delete().eq('id', school.id);
      await supabaseAdmin.from('institutions').delete().eq('id', institutionId);
      schoolId = null;
      institutionId = null;
      throw new Error(`Failed to create admin user: ${userErr.message}`);
    }

    // Step 4: Seed a welcome event
    await supabaseAdmin.from('events').insert({
      school_id: school.id,
      title: 'Welcome to EdProSys!',
      description: 'Your school is now registered. Complete the setup wizard to activate your school.',
      event_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      is_holiday: false,
    });

    // Initial password: edprosys + first-4-chars of school UUID
    // This is shown to the owner on the success screen.
    // Staff added later share this same password for first login.
    const initialPassword = `edprosys${school.id.slice(0, 4)}`;

    return NextResponse.json({
      success: true,
      school: {
        id: school.id,
        name: school.name,
        slug: school.slug,
        plan: school.plan,
        institution_type: instType,
        ownership_type: ownType,
      },
      login: {
        email: admin_email,
        password: initialPassword,
      },
      next_step: '/onboarding',
      message: `Account created. Your initial password is shown below. Complete the setup wizard to activate your school.`,
    });

  } catch (err) {
    console.error('School create error:', err);
    // Safety net rollback
    if (schoolId) {
      try { await supabaseAdmin.from('schools').delete().eq('id', schoolId); } catch { /* ignore */ }
    }
    if (institutionId && !schoolId) {
      // Only delete institution if school creation failed — if school was created,
      // its cascade delete (or institution cleanup) should handle it
      try { await supabaseAdmin.from('institutions').delete().eq('id', institutionId); } catch { /* ignore */ }
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
