import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
import { getInstitutionForSchool } from '@/lib/tenant-lookup';
import { logActivity, logError } from '@/lib/logger';
import { validateId, dedupBatch, type DedupRecord, type ReasonCode } from '@/lib/csv-id-validation';

interface StudentCSVRow {
  name: string;
  class: string;
  section?: string;
  phone_parent?: string;
  parent_name?: string;
  roll_number?: string;
  admission_number?: string;
}

function parseCSV(text: string): StudentCSVRow[] {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
  const rows: StudentCSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ''; });

    if (!row['name'] || !row['class']) continue;

    rows.push({
      name: row['name'],
      class: row['class'],
      section: row['section'] || 'A',
      phone_parent: row['phone_parent'] || row['phone'] || null!,
      parent_name: row['parent_name'] || null!,
      roll_number: row['roll_number'] || null!,
      admission_number: row['admission_number'] || null!,
    });
  }

  return rows;
}

interface RowError { row: number; name: string; error: string; codes?: ReasonCode[] }

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No session' }, { status: 401 });
  const schoolId = session.schoolId;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'CSV file required' }, { status: 400 });
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'Only CSV files accepted' }, { status: 400 });
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 2MB.' }, { status: 400 });
    }

    const text = await file.text();
    const rows = parseCSV(text);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No valid rows found. CSV must have "name" and "class" columns.' }, { status: 400 });
    }

    // Create import job
    const { data: job, error: jobErr } = await supabaseAdmin
      .from('import_jobs')
      .insert({
        school_id: schoolId,
        type: 'students',
        filename: file.name,
        total_rows: rows.length,
        status: 'processing',
      })
      .select('id')
      .single();

    if (jobErr || !job) throw new Error('Failed to create import job');

    // Phase 1 Task 1.4 — resolve institution context once per import; reused
    // on every students.insert below.
    const instCtx = await getInstitutionForSchool(schoolId);
    const academicYear = instCtx.academic_year_id ?? null;

    const failed: RowError[] = [];

    // ── ISS-12 (App. C): validate + dedup admission_number before insert ──
    // admission_number is optional; blank stays NULL. Hard-invalid rows and
    // in-file hard/critical duplicates are quarantined (not inserted). Soft
    // re-admissions (same number, different academic year) are allowed.
    const normalizedAdmno: (string | null)[] = rows.map(() => null);
    const quarantined: boolean[] = rows.map(() => false);
    const dedupRecords: DedupRecord[] = [];

    rows.forEach((row, i) => {
      const rawAdm = row.admission_number ?? '';
      if (!rawAdm) return; // optional — leave NULL
      const v = validateId(rawAdm, 'admission');
      if (v.severity === 'error') {
        failed.push({
          row: i + 2,
          name: row.name,
          error: `Invalid admission number "${rawAdm}" (${v.codes.join(', ')})`,
          codes: v.codes,
        });
        quarantined[i] = true;
        return;
      }
      normalizedAdmno[i] = v.value;
      dedupRecords.push({ rowIndex: i, bareKey: v.bareKey, schoolId, year: academicYear, name: row.name });
    });

    for (const verdict of dedupBatch(dedupRecords)) {
      if (verdict.code === 'DUP_HARD' || verdict.code === 'DUP_CRITICAL_NAME_MISMATCH') {
        const i = verdict.rowIndex;
        const conflictRow = (verdict.conflictRow ?? 0) + 2;
        failed.push({
          row: i + 2,
          name: rows[i].name,
          error: `Duplicate admission number "${normalizedAdmno[i]}" in file (${verdict.code}; conflicts with row ${conflictRow})`,
          codes: [verdict.code],
        });
        quarantined[i] = true;
      }
      // DUP_SOFT_READMISSION (different academic year) is allowed through.
    }

    // ── Insert the surviving rows ──
    const imported: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      if (quarantined[i]) continue;
      const row = rows[i];
      try {
        const { error: insertErr } = await supabaseAdmin.from('students').insert({
          school_id: schoolId,
          institution_id: instCtx.institution_id,
          academic_year_id: instCtx.academic_year_id,
          name: row.name,
          class: row.class,
          section: row.section ?? 'A',
          phone_parent: row.phone_parent ?? null,
          parent_name: row.parent_name ?? null,
          roll_number: row.roll_number ?? null,
          admission_number: normalizedAdmno[i],
          is_active: true,
        });

        if (insertErr) {
          failed.push({ row: i + 2, name: row.name, error: insertErr.message });
        } else {
          imported.push(row.name);
        }
      } catch (e) {
        failed.push({ row: i + 2, name: row.name, error: String(e) });
      }
    }

    failed.sort((a, b) => a.row - b.row);

    // Update import job
    await supabaseAdmin.from('import_jobs').update({
      imported_rows: imported.length,
      failed_rows: failed.length,
      errors: failed,
      status: 'done',
      completed_at: new Date().toISOString(),
    }).eq('id', job.id);

    await logActivity({
      schoolId,
      action: `Imported ${imported.length} students from ${file.name}`,
      module: 'import',
      details: { file: file.name, imported: imported.length, failed: failed.length },
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      total: rows.length,
      imported: imported.length,
      failed: failed.length,
      errors: failed.slice(0, 20),
    });

  } catch (err) {
    await logError({ route: '/api/import/students', error: String(err), schoolId });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
