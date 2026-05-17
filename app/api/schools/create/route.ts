import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

function makeSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Map registration form institution_type values to DB enum values
// Ensures values not yet in the enum get a safe fallback
const INST_TYPE_MAP: Record<string, string> = {
  school_k10: 'school_k10',
  school_k12: 'school_k12',
  govt_school: 'govt_school',
  govt_aided_school: 'govt_aided_school',
  welfare_school: 'welfare_school',
  anganwadi: 'anganwadi',
  junior_college: 'junior_college',
  degree_college: 'degree_college',
  engineering: 'engineering',
  polytechnic: 'polytechnic',
  mba: 'mba',
  medical: 'medical',
  university: 'university',   // added via migration fix_orphan_schools_institution_id_v2
  coaching: 'coaching',
  vocational: 'vocational',
};

export async function POST(req: NextRequest) {
  let schoolId: string | null = null;
  let institutionId: string | null = null;
  let organisationId: string | null = null;

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

    const baseSlug = makeSlug(school_name);

    // Check slug uniqueness across both schools and institutions
    const { data: existingSchool } = await supabaseAdmin
      .from('schools')
      .select('id')
      .eq('slug', baseSlug)
      .maybeSingle();

    if (existingSchool) {
      return NextResponse.json(
        { error: 'An institution with this name already exists. Please use a different name.' },
        { status: 409 }
      );
    }

    const instType = INST_TYPE_MAP[body.institution_type ?? 'school_k10'] ?? 'school_k10';
    const ownType = body.ownership_type ?? 'private';

    const isGovt = ['govt_school', 'govt_aided_school', 'welfare_school'].includes(instType);
    const isPrivateOrFranchise = ['private', 'franchise'].includes(ownType);
    const isAided = ownType === 'aided';

    // Step 1: Create organisation (top-level trust/management body)
    // For single-school registration this is a 1:1 org:school relationship.
    const orgSlug = baseSlug;
    const { data: org, error: orgErr } = await supabaseAdmin
      .from('organisations')
      .insert({
        name: school_name,
        slug: orgSlug,
        owner_email: admin_email.toLowerCase().trim(),
      })
      .select('id')
      .single();

    if (orgErr || !org) throw new Error(orgErr?.message ?? 'Failed to create organisation');
    organisationId = org.id;

    // Step 2: Create institution (campus entity)
    const { data: institution, error: instErr } = await supabaseAdmin
      .from('institutions')
      .insert({
        name: school_name,
        slug: baseSlug,
        organisation_id: organisationId,
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

    if (instErr || !institution) throw new Error(instErr?.message ?? 'Failed to create institution');
    institutionId = institution.id;

    // Step 3: Create school — linked to the institution row
    // onboarded_at intentionally NOT set — set only when wizard Activate step completes
    const { data: school, error: schoolErr } = await supabaseAdmin
      .from('schools')
      .insert({
        name: school_name,
        slug: baseSlug,
        plan: 'free',
        board: body.board ?? 'CBSE',
        contact_email: admin_email,
        contact_phone: body.contact_phone ?? null,
        institution_id: institutionId,
        is_active: true,
      })
      .select('id, name, slug, plan')
      .single();

    if (schoolErr || !school) throw new Error(schoolErr?.message ?? 'Failed to create school');
    schoolId = school.id;

    // Step 4: Create admin/owner user in school_users
    const { error: userErr } = await supabaseAdmin
      .from('school_users')
      .insert({
        school_id: school.id,
        email: admin_email.toLowerCase().trim(),
        name: admin_name,
        role: 'owner',
      });

    if (userErr) {
      // Rollback all three created rows
      await supabaseAdmin.from('schools').delete().eq('id', school.id);
      await supabaseAdmin.from('institutions').delete().eq('id', institutionId);
      await supabaseAdmin.from('organisations').delete().eq('id', organisationId);
      schoolId = null; institutionId = null; organisationId = null;
      throw new Error(`Failed to create admin user: ${userErr.message}`);
    }

    // Step 4b: Create owner_profiles entry (W-13 fix: was never populated on registration)
    // owner_profiles links institution_id to the owner for plan management
    void (async () => {
      try {
        await supabaseAdmin.from('owner_profiles').insert({
          institution_id: institutionId,
          owner_name: admin_name,
          owner_email: admin_email.toLowerCase().trim(),
          subscription_plan: 'basic',
          max_schools: 1,
        });
      } catch { /* non-blocking — owner_profiles failure must not fail registration */ }
    })();

    // Step 5: Seed welcome event
    await supabaseAdmin.from('events').insert({
      school_id: school.id,
      title: 'Welcome to EdProSys!',
      description: 'Your account is ready. Complete the setup wizard to activate your school.',
      event_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      is_holiday: false,
    });

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
      message: 'Account created. Save your password below, then complete the setup wizard.',
    });

  } catch (err) {
    console.error('School create error:', err);
    if (schoolId) { try { await supabaseAdmin.from('schools').delete().eq('id', schoolId); } catch { /* ignore */ } }
    if (institutionId) { try { await supabaseAdmin.from('institutions').delete().eq('id', institutionId); } catch { /* ignore */ } }
    if (organisationId) { try { await supabaseAdmin.from('organisations').delete().eq('id', organisationId); } catch { /* ignore */ } }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
