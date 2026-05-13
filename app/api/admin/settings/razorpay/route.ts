// app/api/admin/settings/razorpay/route.ts
// Batch 2 — Task 3a: Razorpay payment configuration.
// GET: returns masked status (key_secret NEVER returned).
// POST: saves razorpay_key_id, razorpay_key_secret, online_payment_enabled into
//       institutions.feature_flags via jsonb merge.
// Separate from onboarding/5-razorpay (which is onboarding-only).
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

async function resolveInstitution(schoolId: string) {
  const { data: school } = await supabaseAdmin.from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  if (!school?.institution_id) return null;
  const { data: inst } = await supabaseAdmin.from('institutions').select('id, feature_flags').eq('id', school.institution_id).maybeSingle();
  return inst ? { institutionId: inst.id, featureFlags: (inst.feature_flags ?? {}) as Record<string, unknown> } : null;
}

// ─── GET: return masked config status ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  let ctx; try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const inst = await resolveInstitution(ctx.schoolId);
  if (!inst) return NextResponse.json({ error: 'School has no institution configured' }, { status: 400 });
  const ff = inst.featureFlags;
  const keyId = typeof ff.razorpay_key_id === 'string' ? ff.razorpay_key_id : '';
  const keySecret = typeof ff.razorpay_key_secret === 'string' ? ff.razorpay_key_secret : '';
  return NextResponse.json({
    key_id_configured: keyId.length > 0,
    key_id_last4: keyId.length >= 4 ? keyId.slice(-4) : null,
    key_secret_configured: keySecret.length > 0,
    online_payment_enabled: ff.online_payment_enabled === true,
    payment_provider: typeof ff.payment_provider === 'string' ? ff.payment_provider : null,
    fee_module_enabled: ff.fee_module_enabled === true,
  });
}

// ─── POST: save Razorpay config ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let ctx; try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  let body: unknown; try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { razorpay_key_id, razorpay_key_secret, online_payment_enabled } = body as Record<string, unknown>;
  const enabledFlag = online_payment_enabled === true;
  // Guard: if enabling, both keys required
  if (enabledFlag) {
    if (!razorpay_key_id || typeof razorpay_key_id !== 'string' || !(razorpay_key_id as string).trim())
      return NextResponse.json({ error: 'razorpay_key_id required when enabling online payments' }, { status: 400 });
    if (!razorpay_key_secret || typeof razorpay_key_secret !== 'string' || !(razorpay_key_secret as string).trim())
      return NextResponse.json({ error: 'razorpay_key_secret required when enabling online payments' }, { status: 400 });
  }
  const inst = await resolveInstitution(ctx.schoolId);
  if (!inst) return NextResponse.json({ error: 'School has no institution configured' }, { status: 400 });
  // Build update patch — only overwrite keys that were provided
  const patch: Record<string, unknown> = {
    online_payment_enabled: enabledFlag,
    payment_provider: 'razorpay',
    fee_module_enabled: true,
  };
  if (razorpay_key_id && typeof razorpay_key_id === 'string' && (razorpay_key_id as string).trim())
    patch.razorpay_key_id = (razorpay_key_id as string).trim();
  if (razorpay_key_secret && typeof razorpay_key_secret === 'string' && (razorpay_key_secret as string).trim())
    patch.razorpay_key_secret = (razorpay_key_secret as string).trim();
  const merged = { ...inst.featureFlags, ...patch };
  const { error } = await supabaseAdmin.from('institutions')
    .update({ feature_flags: merged }).eq('id', inst.institutionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ updated: true, online_payment_enabled: enabledFlag });
}
