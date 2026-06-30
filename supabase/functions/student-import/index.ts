// OPS-8: Student CSV bulk import Edge Function
// POST /functions/v1/student-import
// Accepts multipart/form-data with 'file' (CSV) and optional 'dry_run=true'
// Writes to import_jobs table, inserts students with data_source='import'
// Handles: duplicate admission_number skip, row limit, concurrent guard,
//          phone validation, class existence check, partial_failure status
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DISPATCH_SECRET = Deno.env.get('DISPATCH_SECRET')!;

const MAX_ROWS = 1000;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const PHONE_RE = /^\+?\d{10,15}$/;

interface CSVRow {
  name: string; class: string; section: string;
  roll_number?: string; admission_number?: string;
  date_of_birth?: string; parent_name?: string;
  phone_parent?: string; language_pref?: string;
  blood_group?: string; emergency_contact_phone?: string;
}

function parseCSV(text: string): { rows: CSVRow[]; parseErrors: string[] } {
  // Handle BOM, CRLF, varying separators
  const clean = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = clean.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return { rows: [], parseErrors: ['CSV has no data rows'] };

  // Detect separator (comma or semicolon)
  const sep = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/"/g, '').replace(/\s+/g,'_'));

  const required = ['name','class'];
  const missing = required.filter(r => !headers.includes(r));
  if (missing.length) return { rows: [], parseErrors: [`Missing required columns: ${missing.join(', ')}`] };

  const rows: CSVRow[] = [];
  const parseErrors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(sep).map(v => v.trim().replace(/"/g, ''));
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = values[idx] ?? ''; });

    if (!obj['name']?.trim() || !obj['class']?.trim()) {
      parseErrors.push(`Row ${i+1}: name and class are required`);
      continue;
    }

    rows.push({
      name: obj['name'],
      class: obj['class'],
      section: obj['section'] || 'A',
      roll_number: obj['roll_number'] || undefined,
      admission_number: obj['admission_number'] || undefined,
      date_of_birth: obj['date_of_birth'] || undefined,
      parent_name: obj['parent_name'] || undefined,
      phone_parent: obj['phone_parent'] || obj['phone'] || undefined,
      language_pref: obj['language_pref'] || 'en',
      blood_group: obj['blood_group'] || undefined,
      emergency_contact_phone: obj['emergency_contact_phone'] || undefined,
    });
  }

  return { rows, parseErrors };
}

Deno.serve(async (req: Request) => {
  const secret = req.headers.get('x-dispatch-secret');
  if (secret !== DISPATCH_SECRET) return json({ error: 'unauthorized' }, 401);
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Parse multipart form
  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return json({ error: 'Invalid multipart form data' }, 400); }

  const file = formData.get('file') as File | null;
  const schoolId = formData.get('school_id') as string | null;
  const dryRun = formData.get('dry_run') === 'true';

  if (!file) return json({ error: 'file required' }, 400);
  if (!schoolId) return json({ error: 'school_id required' }, 400);
  if (!file.name.endsWith('.csv')) return json({ error: 'Only .csv files accepted' }, 400);
  if (file.size > MAX_FILE_BYTES) return json({ error: 'File too large (max 2MB)' }, 400);

  const text = await file.text();
  const { rows, parseErrors } = parseCSV(text);

  if (parseErrors.length && !rows.length) {
    return json({ error: 'CSV parse failed', parse_errors: parseErrors }, 400);
  }
  if (rows.length > MAX_ROWS) {
    return json({ error: `Too many rows. Max ${MAX_ROWS}, got ${rows.length}` }, 400);
  }

  // Concurrent import guard
  const { data: running } = await supabase.from('import_jobs')
    .select('id').eq('school_id', schoolId).eq('type', 'students').eq('status', 'processing').limit(1);
  if (running?.length) {
    return json({ error: 'An import is already running for this school. Wait for it to complete.' }, 409);
  }

  if (dryRun) {
    // Validate only — no writes
    const errors: { row: number; error: string }[] = [];
    const { data: classes } = await supabase.from('classes').select('grade_level, section').eq('school_id', schoolId);
    const classSet = new Set((classes ?? []).map((c: any) => `${c.grade_level}|${c.section ?? 'A'}`.toLowerCase()));
    const admissionSet = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      if (row.phone_parent && !PHONE_RE.test(row.phone_parent))
        errors.push({ row: rowNum, error: `phone_parent '${row.phone_parent}' invalid format` });
      if (classes?.length && !classSet.has(`${row.class}|${row.section ?? 'A'}`.toLowerCase()))
        errors.push({ row: rowNum, error: `class '${row.class}' section '${row.section}' not found in school` });
      if (row.admission_number) {
        if (admissionSet.has(row.admission_number))
          errors.push({ row: rowNum, error: `duplicate admission_number '${row.admission_number}' in CSV` });
        admissionSet.add(row.admission_number);
      }
    }
    return json({ dry_run: true, total: rows.length, valid: rows.length - errors.length, errors, parse_errors: parseErrors });
  }

  // Real import
  const { data: job, error: jobErr } = await supabase.from('import_jobs').insert({
    school_id: schoolId, type: 'students', filename: file.name,
    total_rows: rows.length, status: 'processing',
  }).select('id').single();
  if (jobErr || !job) return json({ error: 'Failed to create import job' }, 500);

  // Resolve institution context
  const { data: school } = await supabase.from('schools')
    .select('institution_id').eq('id', schoolId).maybeSingle();

  let imported = 0;
  const failed: { row: number; name: string; error: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    // Phone validation
    if (row.phone_parent && !PHONE_RE.test(row.phone_parent)) {
      failed.push({ row: rowNum, name: row.name, error: `phone_parent '${row.phone_parent}' invalid format` });
      continue;
    }

    const student: Record<string, unknown> = {
      school_id: schoolId,
      institution_id: school?.institution_id ?? null,
      name: row.name, class: row.class,
      section: row.section ?? 'A',
      phone_parent: row.phone_parent ?? null,
      parent_name: row.parent_name ?? null,
      roll_number: row.roll_number ?? null,
      admission_number: row.admission_number ?? null,
      date_of_birth: row.date_of_birth ?? null,
      language_pref: row.language_pref ?? 'en',
      blood_group: row.blood_group ?? null,
      emergency_contact_phone: row.emergency_contact_phone ?? null,
      is_active: true,
      data_source: 'import',
    };

    // Skip on admission_number conflict
    if (row.admission_number) {
      const { data: existing } = await supabase.from('students')
        .select('id').eq('school_id', schoolId).eq('admission_number', row.admission_number).limit(1);
      if (existing?.length) {
        failed.push({ row: rowNum, name: row.name, error: `admission_number '${row.admission_number}' already exists — skipped` });
        continue;
      }
    }

    const { error: insertErr } = await supabase.from('students').insert(student);
    if (insertErr) {
      failed.push({ row: rowNum, name: row.name, error: insertErr.message });
    } else {
      imported++;
    }
  }

  const finalStatus = failed.length === 0 ? 'done'
    : imported === 0 ? 'failed'
    : 'partial_failure';

  await supabase.from('import_jobs').update({
    imported_rows: imported, failed_rows: failed.length,
    errors: failed, status: finalStatus,
    completed_at: new Date().toISOString(),
  }).eq('id', job.id);

  return json({
    success: finalStatus !== 'failed',
    job_id: job.id, dry_run: false,
    total: rows.length, imported, failed: failed.length,
    status: finalStatus,
    errors: failed.slice(0, 20),
    parse_errors: parseErrors,
  });
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
