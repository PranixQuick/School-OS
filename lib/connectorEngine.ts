// lib/connectorEngine.ts
//
// Shared data import engine.
// Imported by:
//   - app/api/connectors/import/route.ts  (HTTP handler)
//   - app/api/connectors/sheets/route.ts  (Google Sheets connector)
//
// Keeping this in /lib avoids Next.js Route export validation errors,
// which ban any non-HTTP-verb exports from route.ts files.

import { supabaseAdmin } from './supabaseClient';
import { logActivity } from './logger';

export type DataSource = 'csv' | 'google_sheets' | 'tally' | 'erp_json' | 'api' | 'manual';
export type Entity = 'students' | 'fees' | 'attendance' | 'academic_records' | 'mixed';

// ─── Field normalizers ────────────────────────────────────────────────────────
// Accept any reasonable external field naming convention.

export function normalizeStudent(raw: Record<string, unknown>): Record<string, unknown> | null {
  const name = (raw.name ?? raw.student_name ?? raw.Name ?? raw.StudentName ?? '') as string;
  const cls = String(raw.class ?? raw.Class ?? raw.grade ?? raw.Grade ?? raw.std ?? '');
  if (!name || !cls) return null;
  return {
    name: String(name).trim(),
    class: cls.trim().replace(/^(class|grade|std)\s*/i, ''),
    section: String(raw.section ?? raw.Section ?? raw.div ?? 'A').trim().toUpperCase().charAt(0),
    roll_number: String(raw.roll_number ?? raw.roll ?? raw.RollNo ?? raw.roll_no ?? '') || null,
    admission_number: String(raw.admission_number ?? raw.adm_no ?? raw.AdmNo ?? raw.admission ?? '') || null,
    parent_name: String(raw.parent_name ?? raw.father_name ?? raw.ParentName ?? raw.guardian ?? '') || null,
    phone_parent: String(raw.phone_parent ?? raw.phone ?? raw.mobile ?? raw.Phone ?? raw.parent_phone ?? '') || null,
    erp_id: String(raw.erp_id ?? raw.student_id ?? raw.id ?? raw.ID ?? '') || null,
  };
}

export function normalizeFee(raw: Record<string, unknown>): Record<string, unknown> | null {
  const amount = Number(raw.amount ?? raw.Amount ?? raw.fee_amount ?? raw.total ?? 0);
  const studentRef = String(raw.student_id ?? raw.erp_id ?? raw.StudentID ?? raw.admission_number ?? '');
  if (!amount || !studentRef) return null;
  return {
    _student_ref: studentRef,
    fee_type: String(raw.fee_type ?? raw.type ?? raw.Type ?? raw.head ?? 'tuition').toLowerCase().replace(/\s+/g, '_'),
    amount,
    due_date: String(raw.due_date ?? raw.DueDate ?? raw.due ?? new Date().toISOString().split('T')[0]),
    status: String(raw.status ?? raw.Status ?? 'pending').toLowerCase(),
    description: String(raw.description ?? raw.remarks ?? raw.narration ?? '') || null,
  };
}

export function normalizeAttendance(raw: Record<string, unknown>): Record<string, unknown> | null {
  const studentRef = String(raw.student_id ?? raw.erp_id ?? raw.StudentID ?? raw.admission_number ?? '');
  const date = String(raw.date ?? raw.Date ?? raw.attendance_date ?? '');
  const status = String(raw.status ?? raw.Status ?? raw.attendance ?? 'present').toLowerCase();
  if (!studentRef || !date) return null;
  const mappedStatus =
    status === 'p' || status === '1' || status === 'present' ? 'present'
    : status === 'a' || status === '0' || status === 'absent' ? 'absent'
    : status === 'l' || status === 'late' ? 'late'
    : 'present';
  return { _student_ref: studentRef, date, status: mappedStatus, marked_via: 'import' };
}

export function normalizeAcademicRecord(raw: Record<string, unknown>): Record<string, unknown> | null {
  const studentRef = String(raw.student_id ?? raw.erp_id ?? raw.StudentID ?? raw.admission_number ?? '');
  const subject = String(raw.subject ?? raw.Subject ?? raw.sub ?? '');
  const marks = Number(raw.marks_obtained ?? raw.marks ?? raw.Marks ?? raw.score ?? 0);
  const maxMarks = Number(raw.max_marks ?? raw.maximum ?? raw.MaxMarks ?? raw.out_of ?? 100);
  if (!studentRef || !subject) return null;
  return {
    _student_ref: studentRef,
    subject: subject.trim(),
    term: String(raw.term ?? raw.Term ?? raw.exam ?? 'Term 1 2024-25'),
    marks_obtained: marks,
    max_marks: maxMarks,
    grade: String(raw.grade ?? raw.Grade ?? '') || null,
    remarks: String(raw.remarks ?? raw.teacher_remarks ?? '') || null,
  };
}

// ─── Student ID resolver ──────────────────────────────────────────────────────

const studentRefCache = new Map<string, string | null>();

export async function resolveStudentId(ref: string, schoolId: string): Promise<string | null> {
  if (!ref) return null;
  const cacheKey = `${schoolId}:${ref}`;
  if (studentRefCache.has(cacheKey)) return studentRefCache.get(cacheKey) ?? null;
  const { data } = await supabaseAdmin
    .from('students').select('id')
    .eq('school_id', schoolId)
    .or(`erp_id.eq.${ref},admission_number.eq.${ref},id.eq.${ref}`)
    .limit(1).maybeSingle();
  const id = data?.id ?? null;
  studentRefCache.set(cacheKey, id);
  return id;
}

// ─── Core import runner ───────────────────────────────────────────────────────

export interface ImportParams {
  schoolId: string;
  source: DataSource;
  entity: Entity;
  rows: Record<string, unknown>[];
  filename?: string;
  sheet_url?: string;
  dry_run?: boolean;
  triggered_by?: string;
}

export interface ImportResult {
  success: boolean;
  run_id: string | null;
  dry_run: boolean;
  source: DataSource;
  entity: Entity;
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: { row: number; ref: string; error: string }[];
}

export async function runImport(params: ImportParams): Promise<ImportResult> {
  const {
    schoolId, source, entity, rows,
    filename, sheet_url, dry_run = false, triggered_by = 'api',
  } = params;

  studentRefCache.clear();

  const { data: runRecord } = await supabaseAdmin
    .from('connector_runs')
    .insert({
      school_id: schoolId, source, entity,
      filename: filename ?? null, sheet_url: sheet_url ?? null,
      total_rows: rows.length, status: 'processing', triggered_by,
    })
    .select('id').single();
  const runId = runRecord?.id ?? null;

  let inserted = 0, updated = 0, skipped = 0, failed = 0;
  const errors: { row: number; ref: string; error: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    try {
      if (entity === 'students') {
        const n = normalizeStudent(raw);
        if (!n) { skipped++; continue; }
        if (dry_run) { inserted++; continue; }
        const matchField = n.erp_id ? 'erp_id' : n.admission_number ? 'admission_number' : null;
        if (matchField) {
          const { data: ex } = await supabaseAdmin.from('students').select('id')
            .eq('school_id', schoolId).eq(matchField, n[matchField] as string).maybeSingle();
          if (ex) {
            await supabaseAdmin.from('students').update({ ...n, data_source: source }).eq('id', ex.id);
            updated++;
          } else {
            await supabaseAdmin.from('students').insert({ school_id: schoolId, ...n, data_source: source, is_active: true });
            inserted++;
          }
        } else {
          await supabaseAdmin.from('students').insert({ school_id: schoolId, ...n, data_source: source, is_active: true });
          inserted++;
        }

      } else if (entity === 'fees') {
        const n = normalizeFee(raw);
        if (!n) { skipped++; continue; }
        const sid = await resolveStudentId(n._student_ref as string, schoolId);
        if (!sid) { failed++; errors.push({ row: i + 1, ref: String(n._student_ref), error: 'Student not found' }); continue; }
        if (dry_run) { inserted++; continue; }
        const { error } = await supabaseAdmin.from('fees').insert({
          school_id: schoolId, student_id: sid,
          fee_type: n.fee_type, amount: n.amount, due_date: n.due_date,
          status: n.status, description: n.description, data_source: source,
        });
        if (error) { failed++; errors.push({ row: i + 1, ref: String(n._student_ref), error: error.message }); }
        else inserted++;

      } else if (entity === 'attendance') {
        const n = normalizeAttendance(raw);
        if (!n) { skipped++; continue; }
        const sid = await resolveStudentId(n._student_ref as string, schoolId);
        if (!sid) { failed++; errors.push({ row: i + 1, ref: String(n._student_ref), error: 'Student not found' }); continue; }
        if (dry_run) { inserted++; continue; }
        const { error } = await supabaseAdmin.from('attendance').upsert({
          school_id: schoolId, student_id: sid,
          date: n.date, status: n.status,
          marked_via: n.marked_via, data_source: source,
        }, { onConflict: 'school_id,student_id,date', ignoreDuplicates: false });
        if (error) { failed++; errors.push({ row: i + 1, ref: String(n._student_ref), error: error.message }); }
        else inserted++;

      } else if (entity === 'academic_records') {
        const n = normalizeAcademicRecord(raw);
        if (!n) { skipped++; continue; }
        const sid = await resolveStudentId(n._student_ref as string, schoolId);
        if (!sid) { failed++; errors.push({ row: i + 1, ref: String(n._student_ref), error: 'Student not found' }); continue; }
        if (dry_run) { inserted++; continue; }
        const { error } = await supabaseAdmin.from('academic_records').upsert({
          school_id: schoolId, student_id: sid,
          subject: n.subject, term: n.term,
          marks_obtained: n.marks_obtained, max_marks: n.max_marks,
          grade: n.grade, remarks: n.remarks, data_source: source,
        }, { onConflict: 'school_id,student_id,subject,term' });
        if (error) { failed++; errors.push({ row: i + 1, ref: String(n._student_ref), error: error.message }); }
        else inserted++;
      }

    } catch (rowErr) {
      failed++;
      errors.push({ row: i + 1, ref: String(raw.id ?? raw.student_id ?? i), error: String(rowErr) });
    }
  }

  if (runId) {
    await supabaseAdmin.from('connector_runs').update({
      inserted, updated, skipped, failed,
      errors: errors.slice(0, 50),
      status: failed > 0 && inserted === 0 && updated === 0 ? 'failed' : 'done',
      completed_at: new Date().toISOString(),
    }).eq('id', runId);
  }

  if (!dry_run) {
    await logActivity({
      schoolId,
      action: `Data import: ${inserted + updated} ${entity} records from ${source}`,
      module: 'import',
      details: { source, entity, inserted, updated, skipped, failed },
    });
  }

  return {
    success: true, run_id: runId, dry_run, source, entity,
    total: rows.length, inserted, updated, skipped, failed,
    errors: errors.slice(0, 20),
  };
}
