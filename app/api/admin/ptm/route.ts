// app/api/admin/ptm/route.ts
// Batch 7 — PTM session management.
// GET: list all sessions with slot counts.
// POST: create a new PTM session.
// Schema: ptm_sessions.date (not session_date); status: scheduled/in_progress/completed/cancelled
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { requirePrincipalSession, PrincipalAuthError } from '@/lib/principal-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

async function resolveSession(req: NextRequest) {
  try { return { schoolId: (await requireAdminSession(req)).schoolId }; }
  catch (e) {
    if (!(e instanceof AdminAuthError)) throw e;
    try { return { schoolId: (await requirePrincipalSession(req)).schoolId }; }
    catch (pe) { if (pe instanceof PrincipalAuthError) return null; throw pe; }
  }
}

export async function GET(req: NextRequest) {
  const ctx = await resolveSession(req);
  if (!ctx) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { schoolId } = ctx;

  // Fetch sessions with slot counts
  const { data: sessions, error } = await supabaseAdmin
    .from('ptm_sessions')
    .select('id, title, date, start_time, end_time, slot_duration_minutes, status, created_at')
    .eq('school_id', schoolId)
    .order('date', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with slot counts
  const sessionIds = (sessions ?? []).map(s => s.id);
  const { data: slots } = sessionIds.length
    ? await supabaseAdmin.from('ptm_slots').select('session_id, parent_confirmed')
        .eq('school_id', schoolId).in('session_id', sessionIds)
    : { data: [] };

  const slotMap = new Map<string, { total: number; confirmed: number }>();
  for (const sl of slots ?? []) {
    const cur = slotMap.get(sl.session_id) ?? { total: 0, confirmed: 0 };
    cur.total++;
    if (sl.parent_confirmed) cur.confirmed++;
    slotMap.set(sl.session_id, cur);
  }

  const enriched = (sessions ?? []).map(s => ({
    ...s,
    total_slots: slotMap.get(s.id)?.total ?? 0,
    confirmed_slots: slotMap.get(s.id)?.confirmed ?? 0,
  }));

  return NextResponse.json({ sessions: enriched });
}

export async function POST(req: NextRequest) {
  const ctx = await resolveSession(req);
  if (!ctx) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { schoolId } = ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { title, session_date, start_time, end_time, slot_duration_minutes } = body as {
    title?: string; session_date?: string; start_time?: string;
    end_time?: string; slot_duration_minutes?: number;
  };

  if (!title || !session_date || !start_time || !end_time)
    return NextResponse.json({ error: 'title, session_date, start_time, end_time required' }, { status: 400 });

  const today = new Date().toISOString().slice(0, 10);
  if (session_date < today)
    return NextResponse.json({ error: 'session_date must be today or in the future' }, { status: 400 });

  if (end_time <= start_time)
    return NextResponse.json({ error: 'end_time must be after start_time' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('ptm_sessions')
    .insert({
      school_id: schoolId,
      title,
      date: session_date,          // actual column name
      start_time,
      end_time,
      slot_duration_minutes: slot_duration_minutes ?? 10,
      status: 'scheduled',         // actual status value
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ session: data }, { status: 201 });
}
