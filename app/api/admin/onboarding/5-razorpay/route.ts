// app/api/admin/onboarding/5-razorpay/route.ts
// Onboarding Step 5: Razorpay config → stored in institutions.feature_flags
// Body: { razorpay_key_id, razorpay_key_secret, online_payment_enabled: bool }
// TODO(item-15): migrate to supabaseForUser
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  let ctx; try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;
  let body: Record<string, unknown>; try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { razorpay_key_id, razorpay_key_secret, online_payment_enabled } = body as Record<string, unknown>;
  // Resolve institution_id
  const { data: school } = await supabaseAdmin.from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  if (!school?.institution_id) return NextResponse.json({ error: 'School has no institution configured' }, { status: 400 });
  // Merge into existing feature_flags (preserve other flags)
  const { data: inst } = await supabaseAdmin.from('institutions').select('feature_flags').eq('id', school.institution_id).maybeSingle();
  const existing = (inst?.feature_flags ?? {}) as Record<string, unknown>;
  const updated: Record<string, unknown> = {
    ...existing,
    fee_module_enabled: true,
    online_payment_enabled: online_payment_enabled === true,
    payment_provider: 'razorpay',
    ...(razorpay_key_id ? { razorpay_key_id: String(razorpay_key_id).trim() } : {}),
    ...(razorpay_key_secret ? { razorpay_key_secret: String(razorpay_key_secret).trim() } : {}),
  };
  const { error } = await supabaseAdmin.from('institutions').update({ feature_flags: updated }).eq('id', school.institution_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, step: 5, online_payment_enabled: updated.online_payment_enabled });
}
