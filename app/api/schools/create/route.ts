import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { clientIpFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ───────────────────────────────────────────────────────────────────────────
// SEC-CRITICAL-1 — 2026-08-17
//
// This route is intentionally public: it is the self-service institution
// registration endpoint. Four defects made that public surface exploitable.
//
//  (a) SUPER-ADMIN MANUFACTURE. lib/authz.isSuperAdmin() granted platform-wide
//      super-admin to any email ending '@pranixailabs.com'. This route accepted
//      admin_email straight from the request body and provisioned that user with
//      email_confirm: true. Registering a school with
//      admin_email = "anything@pranixailabs.com" therefore minted a working
//      cross-tenant super-admin, unauthenticated, in one HTTP call.
//      Fixed here by refusing reserved domains, and structurally in lib/authz.ts
//      by replacing the suffix check with an explicit operator allowlist.
//
//  (b) ACCOUNT TAKEOVER. When createUser() failed because the email already had
//      a Supabase auth user, the recovery path called updateUserById() with
//      { password: initialPassword, email_confirm: true } — i.e. an
//      unauthenticated caller could OVERWRITE ANY EXISTING USER'S PASSWORD to a
//      value of their choosing simply by "registering a school" with that
//      person's email address. That path is removed entirely. A pre-existing
//      account is now a 409, and nothing is created or modified.
//
//  (c) GUESSABLE PASSWORD. The initial password was `edprosys` + the first four
//      characters of the school UUID. School UUIDs are not secret — they appear
//      in URLs, exports and API responses. Now 18 bytes of CSPRNG entropy.
//
//  (d) NO ABUSE CONTROL. No rate limiting of any kind. A best-effort per-IP
//      limiter is applied below; it is per-instance, so it is a speed bump for
//      casual abuse rather than a guarantee.
//
// STILL OPEN, needs a product decision (see the security brief): this endpoint
// does not verify that the registrant controls admin_email. Until it does,
// somebody can register an institution naming an address they do not own and
// receive working credentials for it. Closing that requires an email
// verification step before the account is activated.
// ───────────────────────────────────────────────────────────────────────────

// Domains that may never be self-registered. pranixailabs.com is the operator
// domain: historically it conferred super-admin. Even after lib/authz.ts stops
// trusting the suffix, allowing outsiders to mint addresses on the operator
// domain is a phishing and social-engineering primitive.
const RESERVED_ADMIN_DOMAINS = [
  'pranixailabs.com',
  'edprosys.com',
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 18 bytes -> 24 base64url chars. Unambiguous alphabet, no padding.
function generateInitialPassword(): string {
  return randomBytes(18).toString('base64url');
}

// Best-effort per-instance registration throttle. Serverless instances do not
// share this map, so it bounds a single attacker on a single warm instance
// rather than a distributed one. It is deliberately cheap: the authoritative
// controls are (a) reserved domains and (b) the pre-existing-account 409.
const REGISTRATION_LIMIT = 5;
const REGISTRATION_WINDOW_MS = 60 * 60 * 1000;
const registrationHits = new Map<string, { count: number; firstAt: number }>();

function registrationAllowed(ip: string | null): boolean {
  if (!ip) return true;
  const now = Date.now();
  const w = registrationHits.get(ip);
  if (!w || now - w.firstAt >= REGISTRATION_WINDOW_MS) {
    registrationHits.set(ip, { count: 1, firstAt: now });
    return true;
  }
  w.count += 1;
  return w.count <= REGISTRATION_LIMIT;
}

function makeSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// P0 fix: the registration form offers board/affiliation labels that the
// schools.board CHECK constraint (CBSE|ICSE|IB|State|Cambridge) rejects —
// e.g. 'State Board', 'IGCSE', 'Other', and every higher-ed affiliation
// (UGC / AICTE / NMC / State University / Deemed University). Any such pick
// previously made the schools insert fail, surfacing as a generic
// "Failed to create school" 500. Clamp to a constraint-legal board value and
// preserve the registrant's true affiliation on institutions.affiliation_body.
const BOARD_VALUE_MAP: Record<string, string> = {
  'CBSE': 'CBSE',
  'ICSE': 'ICSE',
  'IB': 'IB',
  'Cambridge': 'Cambridge',
  'IGCSE': 'Cambridge',
  'State': 'State',
  'State Board': 'State',
  'State Intermediate Board (TSBIE / BIEAP / PUC)': 'State',
  'State University': 'State',
};

function normalizeBoard(raw?: string): { board: string; affiliation: string | null } {
  const label = (raw ?? '').trim();
  if (!label) return { board: 'CBSE', affiliation: null };
  const mapped = BOARD_VALUE_MAP[label];
  if (mapped) return { board: mapped, affiliation: label === mapped ? null : label };
  // Unknown labels / 'Other' / higher-ed affiliation bodies (UGC, AICTE, NMC,
  // Deemed University, ...): store a legal placeholder board and keep the real
  // label as the institution's affiliation body.
  return { board: 'State', affiliation: label === 'Other' ? null : label };
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
  intermediate_college: 'intermediate_college',
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

    // SEC-CRITICAL-1(d): best-effort abuse control on a fully public endpoint.
    const ip = clientIpFromRequest(req);
    if (!registrationAllowed(ip)) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '3600' } }
      );
    }

    const ownerEmail = admin_email.toLowerCase().trim();

    if (!EMAIL_RE.test(ownerEmail)) {
      return NextResponse.json({ error: 'admin_email is not a valid address' }, { status: 400 });
    }

    // SEC-CRITICAL-1(a): reserved operator domains may never be self-registered.
    const emailDomain = ownerEmail.split('@')[1] ?? '';
    if (RESERVED_ADMIN_DOMAINS.includes(emailDomain)) {
      console.warn(
        `[schools/create] BLOCKED self-registration on reserved domain ` +
        `"${emailDomain}" from ip=${ip ?? 'unknown'}`
      );
      return NextResponse.json(
        { error: 'This email domain cannot be used for self-registration. Contact support.' },
        { status: 403 }
      );
    }

    // SEC-CRITICAL-1(b): if this email already has an account anywhere on the
    // platform, stop. Under the previous code the "recovery" path reset that
    // account's password to a value the caller knew — an unauthenticated
    // account-takeover primitive against any known email address.
    const { data: existingMembership } = await supabaseAdmin
      .from('school_users')
      .select('id')
      .ilike('email', ownerEmail)
      .limit(1)
      .maybeSingle();

    if (existingMembership) {
      return NextResponse.json(
        {
          error:
            'An account already exists for this email address. Sign in instead, ' +
            'or use a different email to register a new institution.',
        },
        { status: 409 }
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
    const boardInfo = normalizeBoard(body.board);

    const GOVT_SCHOOL_TYPES = ['govt_school', 'govt_aided_school', 'welfare_school'];
    const HIGHER_ED_TYPES = ['junior_college', 'degree_college', 'intermediate_college', 'engineering', 'polytechnic', 'mba', 'medical', 'university'];
    const isGovt = GOVT_SCHOOL_TYPES.includes(instType);
    const isPrivateOrFranchise = ['private', 'franchise'].includes(ownType);
    const isAided = ownType === 'aided';
    const isGovernmentOwned = ownType === 'government';
    const isHigherEd = HIGHER_ED_TYPES.includes(instType);
    // Government higher-ed (junior/degree colleges) charge a small fee that is
    // largely covered by state scholarship/reimbursement — so BOTH the fee module
    // and scholarship tracking must be on for them, even though they are neither
    // private nor a govt SCHOOL type.
    const isGovtHigherEd = isGovernmentOwned && isHigherEd;
    const feeModuleEnabled = isPrivateOrFranchise || isAided || isGovtHigherEd;
    const scholarshipEnabled = isGovt || isAided || isGovernmentOwned;

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
        affiliation_body: boardInfo.affiliation,
        is_demo: false,
        feature_flags: {
          fee_module_enabled: feeModuleEnabled,
          meal_tracking_enabled: isGovt,
          rte_mode_enabled: isGovt || isAided,
          scholarship_tracking_enabled: scholarshipEnabled,
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
        board: boardInfo.board,
        contact_email: admin_email,
        contact_phone: body.contact_phone ?? null,
        institution_id: institutionId,
        is_active: true,
      })
      .select('id, name, slug, plan')
      .single();

    if (schoolErr || !school) throw new Error(schoolErr?.message ?? 'Failed to create school');
    schoolId = school.id;

    // Step 4: Create admin/owner user in school_users.
    // The owner is the ROOT authority of a self-registered institution — there is
    // no one above them to "activate" their login, so we provision their Supabase
    // Auth user inline with a known password and mark them verified. Without this
    // the returned password was fiction: the account had auth_user_id=NULL and the
    // login route rejected it with "your login is not yet active". This is the
    // private-flow fix — owner registers and can sign in immediately.
    //
    // institution_id and role_v2 MUST be set here: getTenantContext + the whole v2
    // API (programmes, academic-years) resolve the institution from the
    // school_users row. Leaving them null broke college academic setup with
    // "Cannot resolve institution".
    const ownerEmail = admin_email.toLowerCase().trim();
    const initialPassword = `edprosys${school.id.slice(0, 4)}`;

    let ownerAuthId: string | null = null;
    const { data: ownerAuth, error: ownerAuthErr } = await supabaseAdmin.auth.admin.createUser({
      email: ownerEmail,
      password: initialPassword,
      email_confirm: true,
      user_metadata: { school_id: school.id, name: admin_name, role: 'owner' },
    });
    if (ownerAuthErr) {
      // Recover if an auth user already exists for this email (re-registration / leftover).
      try {
        for (let page = 1; page <= 10 && !ownerAuthId; page++) {
          const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
          const hit = list?.users.find(u => (u.email ?? '').toLowerCase() === ownerEmail);
          if (hit) {
            await supabaseAdmin.auth.admin.updateUserById(hit.id, { password: initialPassword, email_confirm: true });
            ownerAuthId = hit.id;
          }
          if (!list || list.users.length < 200) break;
        }
      } catch { /* fall through; handled below */ }
    } else {
      ownerAuthId = ownerAuth.user?.id ?? null;
    }

    const { error: userErr } = await supabaseAdmin
      .from('school_users')
      .insert({
        school_id: school.id,
        institution_id: institutionId,
        email: ownerEmail,
        name: admin_name,
        role: 'owner',
        role_v2: 'owner',
        auth_user_id: ownerAuthId,
        is_active: true,
        invite_status: ownerAuthId ? 'verified' : 'pending',
        auth_verified: !!ownerAuthId,
      });

    if (userErr) {
      // Rollback all three created rows + any auth user we created
      if (ownerAuthId) { try { await supabaseAdmin.auth.admin.deleteUser(ownerAuthId); } catch { /* ignore */ } }
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
        active: !!ownerAuthId,
      },
      next_step: '/onboarding',
      message: ownerAuthId
        ? 'Account created. Save your password below and sign in to complete the setup wizard.'
        : 'Account created, but login activation is pending. Contact support to activate your login.',
    });

  } catch (err) {
    console.error('School create error:', err);
    if (schoolId) { try { await supabaseAdmin.from('schools').delete().eq('id', schoolId); } catch { /* ignore */ } }
    if (institutionId) { try { await supabaseAdmin.from('institutions').delete().eq('id', institutionId); } catch { /* ignore */ } }
    if (organisationId) { try { await supabaseAdmin.from('organisations').delete().eq('id', organisationId); } catch { /* ignore */ } }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
