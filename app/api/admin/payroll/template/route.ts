// app/api/admin/payroll/template/route.ts
// Apply a salary structure template to all staff of a given role.
// POST { source_staff_id, target_role, effective_from? }
// Deactivates existing structures for targeted staff and creates new ones.
// Gross = basic + hra + da + conveyance + medical + other (server-calculated).

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  if (!['owner','admin','principal'].includes(ctx.userRole)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  let body: { source_staff_id?: string; target_role?: string; effective_from?: string; };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { source_staff_id, target_role, effective_from } = body;

  if (!source_staff_id) return NextResponse.json({ error: 'source_staff_id required' }, { status: 400 });
  if (!target_role)     return NextResponse.json({ error: 'target_role required (e.g. teacher)' }, { status: 400 });

  // 1. Fetch the source salary structure
  const { data: sourceStructure } = await supabaseAdmin
    .from('payroll_salary_structures')
    .select('basic_salary, hra, da, conveyance, medical_allowance, other_allowance, pf_employer_pct, pf_employee_pct, esi_applicable, pt_state, tds_placeholder, other_deduction')
    .eq('school_id', ctx.schoolId)
    .eq('staff_id', source_staff_id)
    .eq('is_active', true)
    .maybeSingle();

  if (!sourceStructure) {
    return NextResponse.json({ error: 'No active salary structure found for this staff member. Please create one first.' }, { status: 404 });
  }

  // 2. Get all active staff of the target role (excluding the source)
  const { data: targetStaff } = await supabaseAdmin
    .from('staff')
    .select('id, name, role')
    .eq('school_id', ctx.schoolId)
    .eq('role', target_role)
    .eq('is_active', true)
    .neq('id', source_staff_id);

  if (!targetStaff || targetStaff.length === 0) {
    return NextResponse.json({
      message: `No other active staff with role "${target_role}" found.`,
      applied: 0,
    });
  }

  // 3. Server-side gross calculation
  const basic   = Number(sourceStructure.basic_salary) || 0;
  const hra     = Number(sourceStructure.hra) || 0;
  const da      = Number(sourceStructure.da) || 0;
  const conv    = Number(sourceStructure.conveyance) || 0;
  const med     = Number(sourceStructure.medical_allowance) || 0;
  const other   = Number(sourceStructure.other_allowance) || 0;
  const gross   = basic + hra + da + conv + med + other;
  const effDate = effective_from ?? new Date().toISOString().slice(0, 10);

  const results: { staff_id: string; name: string; status: 'created' | 'error'; error?: string }[] = [];

  for (const staff of targetStaff) {
    try {
      // Deactivate existing structure
      await supabaseAdmin.from('payroll_salary_structures')
        .update({ is_active: false })
        .eq('school_id', ctx.schoolId)
        .eq('staff_id', staff.id)
        .eq('is_active', true);

      // Create new structure from template
      const { error } = await supabaseAdmin.from('payroll_salary_structures').insert({
        school_id:         ctx.schoolId,
        staff_id:          staff.id,
        basic_salary:      basic,
        hra,
        da,
        conveyance:        conv,
        medical_allowance: med,
        other_allowance:   other,
        gross_salary:      gross,
        pf_employer_pct:   Number(sourceStructure.pf_employer_pct) ?? 12,
        pf_employee_pct:   Number(sourceStructure.pf_employee_pct) ?? 12,
        esi_applicable:    Boolean(sourceStructure.esi_applicable),
        pt_state:          sourceStructure.pt_state,
        tds_placeholder:   Number(sourceStructure.tds_placeholder) || 0,
        other_deduction:   Number(sourceStructure.other_deduction) || 0,
        effective_from:    effDate,
        is_active:         true,
        created_by:        ctx.userId,
      });

      if (error) {
        results.push({ staff_id: staff.id, name: staff.name, status: 'error', error: error.message });
      } else {
        results.push({ staff_id: staff.id, name: staff.name, status: 'created' });
      }
    } catch (e) {
      results.push({ staff_id: staff.id, name: staff.name, status: 'error', error: String(e) });
    }
  }

  const created = results.filter(r => r.status === 'created').length;
  const failed  = results.filter(r => r.status === 'error').length;

  return NextResponse.json({
    success: true,
    message: `Template applied: ${created} structures created, ${failed} failed`,
    applied: created,
    failed,
    gross_salary: gross,
    results,
  });
}
