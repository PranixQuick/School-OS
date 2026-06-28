// app/api/admin/settings/payment-modes/route.ts
// Institution-direct payment acceptance modes. EdProSys never holds funds — this
// config simply publishes HOW a parent can pay the school directly: UPI, bank
// transfer, cash, cheque. Online (Razorpay) settles to the school's own gateway
// account and is governed separately by feature_flags.online_payment_enabled.
//
// GET  /api/admin/settings/payment-modes  -> { payment_modes, online_enabled }
// POST /api/admin/settings/payment-modes  body: { payment_modes }
//
// Auth: requireAdminSession. Read: any admin role. Write: owner/principal/admin/admin_staff.
// Stored in schools.settings.payment_modes (jsonb) — no schema change.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { getInstitutionFlags } from '@/lib/institution-flags';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

const WRITE_ROLES = new Set(['owner', 'principal', 'admin', 'admin_staff']);

interface UpiMode { enabled: boolean; vpa: string; payee_name?: string }
interface BankMode { enabled: boolean; account_name: string; account_number: string; ifsc: string; bank_name?: string; branch?: string }
interface CashMode { enabled: boolean; instructions?: string }
interface ChequeMode { enabled: boolean; payable_to?: string; instructions?: string }
interface PaymentModes { upi?: UpiMode; bank?: BankMode; cash?: CashMode; cheque?: ChequeMode; note?: string }

const EMPTY: PaymentModes = {
  upi: { enabled: false, vpa: '', payee_name: '' },
  bank: { enabled: false, account_name: '', account_number: '', ifsc: '', bank_name: '', branch: '' },
  cash: { enabled: false, instructions: '' },
  cheque: { enabled: false, payable_to: '', instructions: '' },
  note: '',
};

const str = (v: unknown, max = 200): string => (typeof v === 'string' ? v.slice(0, max).trim() : '');
const bool = (v: unknown): boolean => v === true;

// Normalise + bound the incoming config; ignores unknown keys.
function clean(input: unknown): PaymentModes {
  const o = (input ?? {}) as Record<string, Record<string, unknown>>;
  const u = o.upi ?? {}, b = o.bank ?? {}, c = o.cash ?? {}, q = o.cheque ?? {};
  return {
    upi: { enabled: bool(u.enabled), vpa: str(u.vpa, 120), payee_name: str(u.payee_name, 120) },
    bank: {
      enabled: bool(b.enabled), account_name: str(b.account_name, 140), account_number: str(b.account_number, 40),
      ifsc: str(b.ifsc, 20).toUpperCase(), bank_name: str(b.bank_name, 140), branch: str(b.branch, 140),
    },
    cash: { enabled: bool(c.enabled), instructions: str(c.instructions, 300) },
    cheque: { enabled: bool(q.enabled), payable_to: str(q.payable_to, 140), instructions: str(q.instructions, 300) },
    note: str((o as Record<string, unknown>).note, 400),
  };
}

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const { data: school } = await supabaseAdmin
    .from('schools').select('settings').eq('id', ctx.schoolId).maybeSingle();
  const settings = (school?.settings ?? {}) as Record<string, unknown>;
  const payment_modes = { ...EMPTY, ...((settings.payment_modes as PaymentModes) ?? {}) };

  const flags = await getInstitutionFlags(ctx.schoolId);
  return NextResponse.json({ payment_modes, online_enabled: flags.online_payment_enabled === true });
}

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  if (!WRITE_ROLES.has(ctx.userRole)) {
    return NextResponse.json({ error: 'Only an owner, principal or admin can change payment acceptance details' }, { status: 403 });
  }

  let body: { payment_modes?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const payment_modes = clean(body.payment_modes);

  // Validate enabled modes have the fields they need.
  if (payment_modes.upi?.enabled && !payment_modes.upi.vpa) {
    return NextResponse.json({ error: 'UPI is enabled but no UPI ID (VPA) was provided' }, { status: 400 });
  }
  if (payment_modes.bank?.enabled && (!payment_modes.bank.account_number || !payment_modes.bank.ifsc)) {
    return NextResponse.json({ error: 'Bank transfer is enabled but account number / IFSC is missing' }, { status: 400 });
  }

  // Merge into settings jsonb without clobbering other keys.
  const { data: school } = await supabaseAdmin
    .from('schools').select('settings').eq('id', ctx.schoolId).maybeSingle();
  const settings = { ...((school?.settings ?? {}) as Record<string, unknown>), payment_modes };

  const { error } = await supabaseAdmin
    .from('schools').update({ settings }).eq('id', ctx.schoolId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, payment_modes });
}
