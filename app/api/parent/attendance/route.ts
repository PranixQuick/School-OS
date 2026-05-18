import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getParentSession } from '@/lib/parent-auth';
import bcrypt from 'bcryptjs';

async function resolveParent(req: NextRequest) {
  // Try cookie-based session first (new UI)
  const session = await getParentSession(req);
  if (session) {
    return { schoolId: session.schoolId, studentId: session.studentId };
  }

  // Fallback: phone+PIN in body (legacy)
  let body: { phone?: string; pin?: string } = {};
  try { body = await req.json(); } catch { return null; }
  const { phone, pin } = body;
  if (!phone || !pin) return null;

  const { data: parents } = await supabaseAdmin.from('parents')
    .select('id, school_id, student_id, access_pin, access_pin_hashed')
    .eq('phone', phone);
  if (!parents || parents.length !== 1) return null;
  const p = parents[0];

  let valid = false;
  if (p.access_pin_hashed) valid = await bcrypt.compare(pin, p.access_pin_hashed);
  else if (p.access_pin) valid = p.access_pin === pin;
  if (!valid) return null;

  return { schoolId: p.school_id, studentId: p.student_id };
}

export async function GET(req: NextRequest) {
  const parent = await resolveParent(req);
  if (!parent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '90');
  const fromDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

  const { data, error } = await supabaseAdmin
    .from('attendance')
    .select('date, status, note')
    .eq('school_id', parent.schoolId)
    .eq('student_id', parent.studentId)
    .gte('date', fromDate)
    .order('date', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ attendance: data ?? [] });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
