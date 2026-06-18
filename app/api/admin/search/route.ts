// app/api/admin/search/route.ts
// ISS-2 (#2) — Role-scoped global search for the shared admin Layout.
// Searches students + staff within the caller's school. Read-only.
// Access is gated by requireAdminSession (viewer = read-only; accountant is
// blocked since this isn't in the fee allowlist; etc.).

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

interface Hit { id: string; label: string; sub: string; href: string }

function dedupe(hits: Hit[]): Hit[] {
  const seen = new Set<string>();
  const out: Hit[] = [];
  for (const h of hits) { if (!seen.has(h.id)) { seen.add(h.id); out.push(h); } }
  return out;
}

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  const raw = (req.nextUrl.searchParams.get('q') ?? '').trim();
  if (raw.length < 2) return NextResponse.json({ query: raw, students: [], staff: [] });

  // Strip SQL-wildcards/escapes so user input is treated literally.
  const q = raw.replace(/[%_\\]/g, '').trim();
  if (q.length < 2) return NextResponse.json({ query: raw, students: [], staff: [] });
  const like = `%${q}%`;

  const sCols = 'id, name, class, section, admission_number';
  const stCols = 'id, name, role, email';

  const [sName, sAdm, stName, stEmail] = await Promise.all([
    supabaseAdmin.from('students').select(sCols).eq('school_id', schoolId).eq('is_active', true).ilike('name', like).order('name').limit(8),
    supabaseAdmin.from('students').select(sCols).eq('school_id', schoolId).eq('is_active', true).ilike('admission_number', like).limit(8),
    supabaseAdmin.from('staff').select(stCols).eq('school_id', schoolId).eq('is_active', true).ilike('name', like).order('name').limit(8),
    supabaseAdmin.from('staff').select(stCols).eq('school_id', schoolId).eq('is_active', true).ilike('email', like).limit(8),
  ]);

  const firstErr = sName.error || sAdm.error || stName.error || stEmail.error;
  if (firstErr) return NextResponse.json({ error: firstErr.message }, { status: 500 });

  type SRow = { id: string; name: string; class: string | null; section: string | null; admission_number: string | null };
  type StRow = { id: string; name: string; role: string | null; email: string | null };

  const students = dedupe([...(sName.data ?? []), ...(sAdm.data ?? [])].map((s: SRow) => ({
    id: s.id,
    label: s.name,
    sub: `Class ${s.class ?? '—'}${s.section ? '-' + s.section : ''}${s.admission_number ? ' · ' + s.admission_number : ''}`,
    href: '/students',
  }))).slice(0, 8);

  const staff = dedupe([...(stName.data ?? []), ...(stEmail.data ?? [])].map((s: StRow) => ({
    id: s.id,
    label: s.name,
    sub: `${s.role ?? 'staff'}${s.email ? ' · ' + s.email : ''}`,
    href: '/admin/staff',
  }))).slice(0, 8);

  return NextResponse.json({ query: raw, students, staff });
}
