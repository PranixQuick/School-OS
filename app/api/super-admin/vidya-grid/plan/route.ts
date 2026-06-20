// app/api/super-admin/vidya-grid/plan/route.ts
// VG-2 — super-admin Vidya Grid plan management.
//
// GET  -> list schools with their current VG plan (resolved from the owning
//         institution's feature_flags).
// PATCH { school_id, vidya_grid_plan?, vidya_grid_paid_until?, vidya_grid_seat_cap? }
//         -> read-modify-write merge of ONLY the 3 VG keys onto
//            institutions.feature_flags (never overwrites the whole jsonb).
//
// Flag-only (founder decision 2026-06-20): no online payment here — the school
// pays out-of-band, bundled into the EdProSys renewal; super-admin sets the flag
// + paid_until. Razorpay is for parent top-up (PR3).
//
// Super-admin only: getSession + isSuperAdmin (email-suffix gate). Additive.

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/authz';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { mergeVgPlanIntoFlags, type VgPlan } from '@/lib/vidya-grid-entitlement';

export const runtime = 'nodejs';

const PLANS = new Set<VgPlan>(['none', 'free', 'paid']);

async function requireSuper(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return { res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!isSuperAdmin(session.userEmail)) return { res: NextResponse.json({ error: 'Super-admin only' }, { status: 403 }) };
  return { session };
}

export async function GET(req: NextRequest) {
  const gate = await requireSuper(req);
  if (gate.res) return gate.res;

  const { data: schools, error } = await supabaseAdmin
    .from('schools').select('id, name, institution_id').order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const instIds = Array.from(new Set((schools ?? []).map((s) => s.institution_id).filter(Boolean)));
  const flagsById = new Map<string, Record<string, unknown>>();
  if (instIds.length) {
    const { data: insts } = await supabaseAdmin.from('institutions').select('id, feature_flags').in('id', instIds);
    for (const i of insts ?? []) {
      flagsById.set(i.id, (i.feature_flags && typeof i.feature_flags === 'object' ? i.feature_flags : {}) as Record<string, unknown>);
    }
  }

  const rows = (schools ?? []).map((s) => {
    const ff = (s.institution_id ? flagsById.get(s.institution_id) : null) ?? {};
    return {
      school_id: s.id,
      name: s.name,
      vidya_grid_plan: (ff.vidya_grid_plan as string) ?? 'none',
      vidya_grid_paid_until: (ff.vidya_grid_paid_until as string) ?? null,
      vidya_grid_seat_cap: (ff.vidya_grid_seat_cap as number) ?? null,
    };
  });

  return NextResponse.json({ schools: rows });
}

export async function PATCH(req: NextRequest) {
  const gate = await requireSuper(req);
  if (gate.res) return gate.res;

  let body: { school_id?: string; vidya_grid_plan?: VgPlan; vidya_grid_paid_until?: string | null; vidya_grid_seat_cap?: number | null };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const schoolId = (body.school_id ?? '').trim();
  if (!schoolId) return NextResponse.json({ error: 'school_id required' }, { status: 400 });
  if (body.vidya_grid_plan !== undefined && !PLANS.has(body.vidya_grid_plan)) {
    return NextResponse.json({ error: "vidya_grid_plan must be 'none' | 'free' | 'paid'" }, { status: 400 });
  }
  if (body.vidya_grid_paid_until !== undefined && body.vidya_grid_paid_until !== null && Number.isNaN(Date.parse(body.vidya_grid_paid_until))) {
    return NextResponse.json({ error: 'vidya_grid_paid_until must be an ISO date or null' }, { status: 400 });
  }
  if (body.vidya_grid_seat_cap !== undefined && body.vidya_grid_seat_cap !== null && (typeof body.vidya_grid_seat_cap !== 'number' || body.vidya_grid_seat_cap < 0)) {
    return NextResponse.json({ error: 'vidya_grid_seat_cap must be a non-negative number or null' }, { status: 400 });
  }

  // Resolve the owning institution.
  const { data: school } = await supabaseAdmin.from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  if (!school?.institution_id) return NextResponse.json({ error: 'School or institution not found' }, { status: 404 });

  const { data: inst } = await supabaseAdmin.from('institutions').select('feature_flags').eq('id', school.institution_id).maybeSingle();
  if (!inst) return NextResponse.json({ error: 'Institution not found' }, { status: 404 });

  const current = (inst.feature_flags && typeof inst.feature_flags === 'object' ? inst.feature_flags : {}) as Record<string, unknown>;
  const merged = mergeVgPlanIntoFlags(current, {
    vidya_grid_plan: body.vidya_grid_plan,
    vidya_grid_paid_until: body.vidya_grid_paid_until,
    vidya_grid_seat_cap: body.vidya_grid_seat_cap,
  });

  const { error: updErr } = await supabaseAdmin.from('institutions').update({ feature_flags: merged }).eq('id', school.institution_id);
  if (updErr) return NextResponse.json({ error: 'Could not update plan. Please try again.' }, { status: 500 });

  return NextResponse.json({
    success: true,
    vidya_grid_plan: (merged.vidya_grid_plan as string) ?? 'none',
    vidya_grid_paid_until: (merged.vidya_grid_paid_until as string) ?? null,
    vidya_grid_seat_cap: (merged.vidya_grid_seat_cap as number) ?? null,
  });
}
