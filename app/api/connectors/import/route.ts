// PATH: app/api/connectors/import/route.ts
//
// Unified data ingestion endpoint.
// Accepts JSON payloads from any external system:
//   - ERP systems (JSON format)
//   - Tally exports (JSON/XML mapped to standard format)
//   - Google Sheets (via Apps Script webhook)
//   - Manual API pushes
//
// POST /api/connectors/import
// Body: { source, entity, data: [...], school_id? }

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId } from '@/lib/getSchoolId';
import { logActivity } from '@/lib/logger';

type DataSource = 'csv' | 'google_sheets' | 'tally' | 'erp_json' | 'api' | 'manual';
type Entity = 'students' | 'fees' | 'attendance' | 'academic_records' | 'mixed';

// ─── Field normalizers — map any external field naming to our schema ──────────

function normalizeStudent(raw: Record<string, unknown>): Record<string, unknown> | null {
  // Accept any reasonable field naming convention
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

function normalizeFee(raw: Record<string, unknown>): Record<string, unknown> | null {
  const amount = Number(raw.amount ?? raw.Amount ?? raw.fee_amount ?? raw.total ?? 0);
  const studentRef = String(raw.student_id ?? raw.erp_id ?? raw.StudentID ?? raw.admission_number ?? '');
  if (!amount || !studentRef) return null;

  return {
    _student_ref: studentRef,   // used internally to lookup student_id
    fee_type: String(raw.fee_type ?? raw.type ?? raw.Type ?? raw.head ?? 'tuition').toLowerCase().replace(/\s+/g, '_'),
    amount,
    due_date: String(raw.due_date ?? raw.DueDate ?? raw.due ?? new Date().toISOString().split('T')[0]),
    status: String(raw.status ?? raw.Status ?? 'pending').toLowerCase(),
    description: String(raw.description ?? raw.remarks ?? raw.narration ?? '') || null,
  };
}

function normalizeAttendance(raw: Record<string, unknown>): Record<string, unknown> | null {
  const studentRef = String(raw.student_id ?? raw.erp_id ?? raw.StudentID ?? raw.admission_number ?? '');
  const date = String(raw.date ?? raw.Date ?? raw.attendance_date ?? '');
  const status = String(raw.status ?? raw.Status ?? raw.attendance ?? 'present').toLowerCase();
  if (!studentRef || !date) return null;

  const mappedStatus = status === 'p' || status === '1' || status === 'present' ? 'present'
    : status === 'a' || status === '0' || status === 'absent' ? 'absent'
    : status === 'l' || status === 'late' ? 'late'
    : 'present';

  return {
    _student_ref: studentRef,
    date,
    status: mappedStatus,
    marked_via: 'import',
  };
}

function normalizeAcademicRecord(raw: Record<string, unknown>): Record<string, unknown> | null {
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

async function resolveStudentId(ref: string, schoolId: string): Promise<string | null> {
  if (!ref) return null;
  const cacheKey = `${schoolId}:${ref}`;
  if (studentRefCache.has(cacheKey)) return studentRefCache.get(cacheKey) ?? null;

  // Try by erp_id, admission_number, roll_number
  const { data } = await supabaseAdmin
    .from('students')
    .select('id')
    .eq('school_id', schoolId)
    .or(`erp_id.eq.${ref},admission_number.eq.${ref},id.eq.${ref}`)
    .limit(1)
    .maybeSingle();

  const id = data?.id ?? null;
  studentRefCache.set(cacheKey, id);
  return id;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  studentRefCache.clear(); // clear per-request cache

  const schoolId = getSchoolId(req);

  try {
    const body = await req.json() as {
      source: DataSource;
      entity: Entity;
      data: Record<string, unknown>[];
      filename?: string;
      sheet_url?: string;
      dry_run?: boolean; // if true, validate but don't insert
    };

    const { source = 'api', entity, data: rows, filename, sheet_url, dry_run = false } = body;

    if (!entity || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'entity and data[] required' }, { status: 400 });
    }

    // Create connector run record
    const { data: runRecord } = await supabaseAdmin
      .from('connector_runs')
      .insert({
        school_id: schoolId,
        source,
        entity,
        filename: filename ?? null,
        sheet_url: sheet_url ?? null,
        total_rows: rows.length,
        status: 'processing',
        triggered_by: req.headers.get('x-user-email') ?? 'api',
      })
      .select('id')
      .single();

    const runId = runRecord?.id ?? null;

    let inserted = 0, updated = 0, skipped = 0, failed = 0;
    const errors: { row: number; ref: string; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];

      try {
        if (entity === 'students') {
          const normalized = normalizeStudent(raw);
          if (!normalized) { skipped++; continue; }

          if (dry_run) { inserted++; continue; }

          // Upsert by erp_id or admission_number
          const matchField = normalized.erp_id ? 'erp_id'
            : normalized.admission_number ? 'admission_number'
            : null;

          if (matchField) {
            const { data: existing } = await supabaseAdmin
              .from('students')
              .select('id')
              .eq('school_id', schoolId)
              .eq(matchField, normalized[matchField] as string)
              .maybeSingle();

            if (existing) {
              await supabaseAdmin.from('students').update({ ...normalized, data_source: source }).eq('id', existing.id);
              updated++;
            } else {
              await supabaseAdmin.from('students').insert({ school_id: schoolId, ...normalized, data_source: source, is_active: true });
              inserted++;
            }
          } else {
            await supabaseAdmin.from('students').insert({ school_id: schoolId, ...normalized, data_source: source, is_active: true });
            inserted++;
          }

        } else if (entity === 'fees') {
          const normalized = normalizeFee(raw);
          if (!normalized) { skipped++; continue; }

          const studentId = await resolveStudentId(normalized._student_ref as string, schoolId);
          if (!studentId) { failed++; errors.push({ row: i + 1, ref: String(normalized._student_ref), error: 'Student not found' }); continue; }

          if (dry_run) { inserted++; continue; }

          const { error } = await supabaseAdmin.from('fees').insert({
            school_id: schoolId,
            student_id: studentId,
            fee_type: normalized.fee_type,
            amount: normalized.amount,
            due_date: normalized.due_date,
            status: normalized.status,
            description: normalized.description,
            data_source: source,
          });

          if (error) { failed++; errors.push({ row: i + 1, ref: String(normalized._student_ref), error: error.message }); }
          else inserted++;

        } else if (entity === 'attendance') {
          const normalized = normalizeAttendance(raw);
          if (!normalized) { skipped++; continue; }

          const studentId = await resolveStudentId(normalized._student_ref as string, schoolId);
          if (!studentId) { failed++; errors.push({ row: i + 1, ref: String(normalized._student_ref), error: 'Student not found' }); continue; }

          if (dry_run) { inserted++; continue; }

          const { error } = await supabaseAdmin.from('attendance').upsert({
            school_id: schoolId,
            student_id: studentId,
            date: normalized.date,
            status: normalized.status,
            marked_via: normalized.marked_via,
            data_source: source,
          }, { onConflict: 'school_id,student_id,date', ignoreDuplicates: false });

          if (error) { failed++; errors.push({ row: i + 1, ref: String(normalized._student_ref), error: error.message }); }
          else inserted++;

        } else if (entity === 'academic_records') {
          const normalized = normalizeAcademicRecord(raw);
          if (!normalized) { skipped++; continue; }

          const studentId = await resolveStudentId(normalized._student_ref as string, schoolId);
          if (!studentId) { failed++; errors.push({ row: i + 1, ref: String(normalized._student_ref), error: 'Student not found' }); continue; }

          if (dry_run) { inserted++; continue; }

          const { error } = await supabaseAdmin.from('academic_records').upsert({
            school_id: schoolId,
            student_id: studentId,
            subject: normalized.subject,
            term: normalized.term,
            marks_obtained: normalized.marks_obtained,
            max_marks: normalized.max_marks,
            grade: normalized.grade,
            remarks: normalized.remarks,
            data_source: source,
          }, { onConflict: 'school_id,student_id,subject,term' });

          if (error) { failed++; errors.push({ row: i + 1, ref: String(normalized._student_ref), error: error.message }); }
          else inserted++;
        }

      } catch (rowErr) {
        failed++;
        errors.push({ row: i + 1, ref: String(raw.id ?? raw.student_id ?? i), error: String(rowErr) });
      }
    }

    // Update run record
    if (runId) {
      await supabaseAdmin.from('connector_runs').update({
        inserted, updated, skipped, failed,
        errors: errors.slice(0, 50),
        status: failed > 0 && inserted === 0 ? 'failed' : 'done',
        completed_at: new Date().toISOString(),
      }).eq('id', runId);
    }

    if (!dry_run) {
      await logActivity({
        schoolId,
        action: `Data import: ${inserted} ${entity} records from ${source}`,
        module: 'import',
        details: { source, entity, inserted, updated, skipped, failed },
      });
    }

    return NextResponse.json({
      success: true,
      run_id: runId,
      dry_run,
      source,
      entity,
      total: rows.length,
      inserted,
      updated,
      skipped,
      failed,
      errors: errors.slice(0, 20),
    });

  } catch (err) {
    console.error('Connector import error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// GET: return connector run history
export async function GET(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '20');

    const { data, error } = await supabaseAdmin
      .from('connector_runs')
      .select('id, source, entity, filename, total_rows, inserted, updated, failed, status, started_at, completed_at')
      .eq('school_id', schoolId)
      .order('started_at', { ascending: false })
      .limit(Math.min(limit, 100));

    if (error) throw new Error(error.message);
    return NextResponse.json({ runs: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
