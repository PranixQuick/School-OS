// app/api/admin/fees/students/route.ts
// ISS-10 (#10 / P4.1c) — Student lookup for the accountant fee ledger picker.
// Lives under the /api/admin/fees prefix so the accountant role (scoped to
// fee-domain routes via ACCOUNTANT_ROUTE_ALLOWLIST) can reach it. Read-only.
//
// GET /api/admin/fees/students?q=<name|admission_number>  -> { students: [...] }

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { isFeeModuleEnabled } from '@/lib/institution-flags';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

interface Row {
  id: string;
  name: string;
  class: string | null;
  section: string | null;
  admission_number: string | null;
}

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId } = ctx;

  const feeEnabled = await isFeeModuleEnabled(schoolId);
  if (!feeEnabled) return NextResponse.json({ error: 'fee_module_disabled' }, { status: 403 });

  const raw = (req.nextUrl.searchParams.get('q') ?? '').trim();
  if (raw.length < 2) return NextResponse.json({ students: [] });

  // Strip SQL-wildcards/escapes so user input is treated literally.
  const q = raw.replace(/[%_\\]/g, '').trim();
  if (q.length < 2) return NextResponse.json({ students: [] });
  const like = `%${q}%`;

  const cols = 'id, name, class, section, admission_number';
  const [byName, byAdm] = await Promise.all([
    supabaseAdmin.from('students').select(cols).eq('school_id', schoolId).eq('is_active', true).ilike('name', like).order('name').limit(10),
    supabaseAdmin.from('students').select(cols).eq('school_id', schoolId).eq('is_active', true).ilike('admission_number', like).limit(10),
  ]);

  const err = byName.error || byAdm.error;
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  const seen = new Set<string>();
  const students = [...(byName.data ?? []), ...(byAdm.data ?? [])].filter((s: Row) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  }).slice(0, 10);

  return NextResponse.json({ students });
}
