// app/api/parent/payment-modes/route.ts
// Parent-facing "ways to pay your school". Read-only, parent-session gated, scoped to
// the parent's own school. Returns only the modes the school has ENABLED, plus whether
// in-app online payment (the school's own gateway account) is available.
// EdProSys never holds funds — these are the institution's own acceptance details.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getParentSession } from '@/lib/parent-auth';
import { getInstitutionFlags } from '@/lib/institution-flags';

export const runtime = 'nodejs';

interface ModeBlock { [k: string]: unknown; enabled?: boolean }

export async function GET(req: NextRequest) {
  const session = await getParentSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: school } = await supabaseAdmin
    .from('schools').select('name, settings').eq('id', session.schoolId).maybeSingle();

  const settings = (school?.settings ?? {}) as Record<string, unknown>;
  const pm = (settings.payment_modes ?? {}) as Record<string, ModeBlock>;
  const on = (m?: ModeBlock) => !!m && m.enabled === true;

  const flags = await getInstitutionFlags(session.schoolId);

  // Only surface enabled, non-empty modes (drop the editing scaffolding).
  const modes: Record<string, unknown> = {};
  if (on(pm.upi) && pm.upi.vpa) modes.upi = { vpa: pm.upi.vpa, payee_name: pm.upi.payee_name ?? null };
  if (on(pm.bank) && pm.bank.account_number) {
    modes.bank = {
      account_name: pm.bank.account_name ?? null, account_number: pm.bank.account_number,
      ifsc: pm.bank.ifsc ?? null, bank_name: pm.bank.bank_name ?? null, branch: pm.bank.branch ?? null,
    };
  }
  if (on(pm.cash)) modes.cash = { instructions: pm.cash.instructions ?? null };
  if (on(pm.cheque)) modes.cheque = { payable_to: pm.cheque.payable_to ?? null, instructions: pm.cheque.instructions ?? null };

  return NextResponse.json({
    school_name: school?.name ?? 'your school',
    online_enabled: flags.online_payment_enabled === true,
    note: (pm.note as string) || null,
    modes,
  });
}
