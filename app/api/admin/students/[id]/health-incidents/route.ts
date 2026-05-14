// app/api/admin/students/[id]/health-incidents/route.ts
// Batch 4E — Log a health incident for a student.
// Queues WhatsApp notification if parent_notified=true and parent phone exists.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { requireTeacherSession, TeacherAuthError } from '@/lib/teacher-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

async function resolveSession(req: NextRequest) {
  try { return await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError && e.status === 403) {
      try {
        const t = await requireTeacherSession(req);
        return { schoolId: t.schoolId, staffId: t.staffId, userRole: 'teacher' };
      } catch {}
    }
    throw e;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try { ctx = await resolveSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof TeacherAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId, staffId } = ctx;
  const { id: studentId } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { incident_date, incident_type, description, first_aid_given, referred_to_hospital, parent_notified } = body as {
    incident_date?: string; incident_type?: string; description?: string;
    first_aid_given?: string; referred_to_hospital?: boolean; parent_notified?: boolean;
  };
  if (!incident_type || !description) {
    return NextResponse.json({ error: 'incident_type and description required' }, { status: 400 });
  }

  const notifiedAt = parent_notified ? new Date().toISOString() : null;

  const { data: incident, error } = await supabaseAdmin
    .from('health_incidents')
    .insert({
      school_id: schoolId,
      student_id: studentId,
      incident_date: incident_date ?? new Date().toISOString().slice(0, 10),
      incident_type,
      description,
      first_aid_given: first_aid_given ?? null,
      referred_to_hospital: referred_to_hospital ?? false,
      parent_notified: parent_notified ?? false,
      notified_at: notifiedAt,
      recorded_by: staffId ?? null,
    })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Queue WhatsApp notification if parent_notified=true
  if (parent_notified) {
    try {
      const { data: student } = await supabaseAdmin
        .from('students').select('name, phone_parent').eq('id', studentId).maybeSingle();
      if (student?.phone_parent) {
        await supabaseAdmin.from('notifications').insert({
          school_id: schoolId,
          type: 'alert',
          title: `${student.name} — health incident recorded`,
          message: `${incident_type} on ${incident.incident_date}. ${first_aid_given ?? 'First aid provided.'}`,
          target_count: 1,
          module: 'health',
          reference_id: incident.id,
          status: 'pending',
          channel: 'whatsapp',
          attempts: 0,
        });
      }
    } catch (_e) { /* non-fatal */ }
  }

  return NextResponse.json({ incident }, { status: 201 });
}
