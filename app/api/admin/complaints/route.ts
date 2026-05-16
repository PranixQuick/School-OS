import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

// PR-2 Task A: Admin complaint list endpoint.
// Returns complaints for the caller's school, with optional status/type filters.
// Tenant boundary enforced via session.schoolId (NOT request body).
//
// GET /api/admin/complaints?status=open&type=safety&limit=100
//   status: optional, one of open|under_review|escalated|resolved|closed
//   type:   optional, one of the 10 complaint_types
//   limit:  optional, 1..200 (default 100)

export const runtime = 'nodejs';

const ALLOWED_STATUSES = new Set(['open','under_review','escalated','resolved','closed']);
const ALLOWED_TYPES = new Set([
  'academic','teacher_conduct','bullying','safety',
  'infrastructure','fee','transport','food','vendor','general',
]);

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get('status');
  const typeFilter = url.searchParams.get('type');
  const limitParam = url.searchParams.get('limit');
  const limit = Math.min(Math.max(parseInt(limitParam ?? '100', 10) || 100, 1), 200);

  if (statusFilter && !ALLOWED_STATUSES.has(statusFilter)) {
    return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 });
  }
  if (typeFilter && !ALLOWED_TYPES.has(typeFilter)) {
    return NextResponse.json({ error: 'Invalid type filter' }, { status: 400 });
  }

  let query = supabaseAdmin
    .from('parent_complaints')
    .select(`
      id, complaint_type, subject, description, status, resolution,
      parent_phone, student_id, assigned_to,
      created_at, updated_at, resolved_at, closed_at,
      student:students(id, name, class, section)
    `)
    .eq('school_id', ctx.schoolId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (statusFilter) query = query.eq('status', statusFilter);
  if (typeFilter) query = query.eq('complaint_type', typeFilter);

  const { data, error } = await query;

  if (error) {
    console.error('Admin complaints list error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Counts by status for the dashboard pill row.
  const { data: counts } = await supabaseAdmin
    .from('parent_complaints')
    .select('status')
    .eq('school_id', ctx.schoolId);

  const byStatus: Record<string, number> = {
    open: 0, under_review: 0, escalated: 0, resolved: 0, closed: 0,
  };
  for (const row of counts ?? []) {
    if (row.status in byStatus) byStatus[row.status]++;
  }

  return NextResponse.json({
    success: true,
    total: data?.length ?? 0,
    complaints: data ?? [],
    stats: { by_status: byStatus },
  });
}
