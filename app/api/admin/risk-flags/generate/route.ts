// app/api/admin/risk-flags/generate/route.ts
// Batch 5 — Generate student risk flags via rule-based scoring.
// No AI needed — pure logic: absence rate + unpaid fees.
// Schema: risk_factors column (not risk_reasons as in directive).
// student_risk_flags.UNIQUE(school_id, student_id) confirmed.
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

function maxRisk(a: string, b: string): string {
  const order: Record<string, number> = { high: 3, medium: 2, low: 1 };
  return (order[a] ?? 0) >= (order[b] ?? 0) ? a : b;
}

export async function POST(req: NextRequest) {
  const ctx = await resolveSession(req);
  if (!ctx) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { schoolId } = ctx;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  // ── Step 1: Aggregate per-student attendance + fees (last 30 days) ──────────
  const { data: students, error: sErr } = await supabaseAdmin
    .from('students').select('id, name, class, section')
    .eq('school_id', schoolId).eq('is_active', true);
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
  if (!students || students.length === 0) return NextResponse.json({ flagged: 0, high_risk: 0, medium_risk: 0 });

  const studentIds = students.map(s => s.id);

  const [attRes, feesRes] = await Promise.all([
    supabaseAdmin.from('attendance').select('student_id, status')
      .eq('school_id', schoolId).in('student_id', studentIds)
      .gte('created_at', thirtyDaysAgo),
    supabaseAdmin.from('fees').select('student_id, status')
      .eq('school_id', schoolId).in('student_id', studentIds)
      .in('status', ['pending', 'overdue']),
  ]);

  // Build maps
  const attMap = new Map<string, { absent: number; total: number }>();
  for (const r of attRes.data ?? []) {
    const cur = attMap.get(r.student_id) ?? { absent: 0, total: 0 };
    cur.total++;
    if (r.status === 'absent') cur.absent++;
    attMap.set(r.student_id, cur);
  }
  const feeMap = new Map<string, number>();
  for (const f of feesRes.data ?? []) {
    feeMap.set(f.student_id, (feeMap.get(f.student_id) ?? 0) + 1);
  }

  // ── Step 2: Apply risk scoring rules ──────────────────────────────────────
  let flagged = 0, highRisk = 0, mediumRisk = 0;

  for (const student of students) {
    const att = attMap.get(student.id);
    const unpaidFees = feeMap.get(student.id) ?? 0;
    let riskLevel = 'low';
    const riskReasons: string[] = [];

    if (att && att.total > 0 && att.absent > 5) {
      const absRate = att.absent / att.total;
      if (absRate > 0.3) {
        riskLevel = maxRisk(riskLevel, 'high');
        riskReasons.push(`High absence rate (${Math.round(absRate * 100)}%)`);
      } else if (absRate > 0.15) {
        riskLevel = maxRisk(riskLevel, 'medium');
        riskReasons.push(`Elevated absences (${Math.round(absRate * 100)}%)`);
      }
    }

    if (unpaidFees >= 4) {
      riskLevel = 'high';
      riskReasons.push(`Significant fee arrears (${unpaidFees} unpaid)`);
    } else if (unpaidFees >= 2) {
      riskLevel = maxRisk(riskLevel, 'medium');
      riskReasons.push(`Multiple unpaid fees (${unpaidFees})`);
    }

    if (riskLevel === 'low') continue;

    // Upsert risk flag
    const { error: upsertErr } = await supabaseAdmin.from('student_risk_flags').upsert({
      school_id: schoolId,
      student_id: student.id,
      risk_level: riskLevel,
      risk_factors: riskReasons,        // actual column name
      fee_overdue: unpaidFees > 0,
      attendance_pct: att ? Math.round((1 - att.absent / att.total) * 100) : null,
      flagged_at: new Date().toISOString(),
      reviewed: false,
      auto_generated: true,
    }, { onConflict: 'school_id,student_id' });

    if (!upsertErr) {
      flagged++;
      if (riskLevel === 'high') highRisk++;
      else if (riskLevel === 'medium') mediumRisk++;
    }
  }

  return NextResponse.json({ flagged, high_risk: highRisk, medium_risk: mediumRisk, students_analyzed: students.length });
}
