// OPS-9: Timetable bulk import Edge Function
// POST /functions/v1/timetable-import
// CSV columns: class_grade, class_section, subject_code, staff_email, day_of_week, period, start_time, end_time
// Resolves class_id, subject_id, staff_id by lookup — never requires raw UUIDs from user
// Handles: UNIQUE constraint violations per-row (class clash, teacher clash), dry_run, import_jobs
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DISPATCH_SECRET = Deno.env.get('DISPATCH_SECRET')!;

const MAX_ROWS = 500;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

const DAY_MAP: Record<string, number> = {
  'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4,
  'friday': 5, 'saturday': 6, 'sunday': 0,
  'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6, 'sun': 0,
  '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '0': 0,
};

function parseCSV(text: string): { rows: Record<string, string>[]; error?: string } {
  const clean = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = clean.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return { rows: [], error: 'CSV has no data rows' };
  const sep = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/"/g, '').replace(/\s+/g, '_'));
  const required = ['class_grade', 'subject_code', 'staff_email', 'day_of_week', 'period'];
  const missing = required.filter(r => !headers.includes(r));
  if (missing.length) return { rows: [], error: `Missing required columns: ${missing.join(', ')}` };
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(sep).map(v => v.trim().replace(/"/g, ''));
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = values[idx] ?? ''; });
    rows.push(obj);
  }
  return { rows };
}

Deno.serve(async (req: Request) => {
  const secret = req.headers.get('x-dispatch-secret');
  if (secret !== DISPATCH_SECRET) return json({ error: 'unauthorized' }, 401);
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
  const { rows, error: parseError } = parseCSV(text);
  if (parseError) return json({ error: parseError }, 400);
  if (rows.length > MAX_ROWS) return json({ error: `Too many rows (max ${MAX_ROWS})` }, 400);

  // Pre-load lookup tables for this school
  const [classesRes, subjectsRes, staffRes] = await Promise.all([
    supabase.from('classes').select('id, grade_level, section').eq('school_id', schoolId),
    supabase.from('subjects').select('id, subject_code').eq('school_id', schoolId),
    supabase.from('staff').select('id, email').eq('school_id', schoolId).eq('is_active', true),
  ]);

  const classMap = new Map<string, string>(); // 'grade|section' -> id
  for (const c of classesRes.data ?? []) classMap.set(`${c.grade_level}|${(c.section??'A').toUpperCase()}`, c.id);
  const subjectMap = new Map<string, string>(); // code -> id
  for (const s of subjectsRes.data ?? []) subjectMap.set(s.subject_code?.toUpperCase(), s.id);
  const staffMap = new Map<string, string>(); // email (lower) -> id
  for (const s of staffRes.data ?? []) staffMap.set(s.email?.toLowerCase(), s.id);

  const errors: { row: number; error: string }[] = [];
  const valid: Record<string, unknown>[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const section = (row['class_section'] || 'A').toUpperCase();
    const classId = classMap.get(`${row['class_grade']}|${section}`);
    if (!classId) { errors.push({ row: rowNum, error: `class '${row['class_grade']}' section '${section}' not found` }); continue; }
    const subjectId = subjectMap.get(row['subject_code']?.toUpperCase());
    if (!subjectId) { errors.push({ row: rowNum, error: `subject_code '${row['subject_code']}' not found` }); continue; }
    const staffId = staffMap.get(row['staff_email']?.toLowerCase());
    if (!staffId) { errors.push({ row: rowNum, error: `staff_email '${row['staff_email']}' not found` }); continue; }
    const dayNum = DAY_MAP[row['day_of_week']?.toLowerCase()];
    if (dayNum === undefined) { errors.push({ row: rowNum, error: `day_of_week '${row['day_of_week']}' invalid` }); continue; }
    const period = parseInt(row['period']);
    if (isNaN(period) || period < 1 || period > 12) { errors.push({ row: rowNum, error: `period '${row['period']}' must be 1-12` }); continue; }
    valid.push({
      school_id: schoolId, class_id: classId, subject_id: subjectId, staff_id: staffId,
      day_of_week: dayNum, period,
      start_time: row['start_time'] || null, end_time: row['end_time'] || null,
    });
  }

  if (dryRun) {
    return json({ dry_run: true, total: rows.length, valid: valid.length, errors });
  }

  // Concurrent guard
  const { data: running } = await supabase.from('import_jobs')
    .select('id').eq('school_id', schoolId).eq('type', 'timetable').eq('status', 'processing').limit(1);
  if (running?.length) return json({ error: 'Import already running' }, 409);

  const { data: job, error: jobErr } = await supabase.from('import_jobs').insert({
    school_id: schoolId, type: 'timetable', filename: file.name,
    total_rows: rows.length, status: 'processing',
  }).select('id').single();
  if (jobErr || !job) return json({ error: 'Failed to create import job' }, 500);

  let imported = 0;
  const failed: { row: number; error: string }[] = [...errors];

  for (const entry of valid) {
    const { error: insertErr } = await supabase.from('timetable').insert(entry);
    if (insertErr) {
      const rowHint = insertErr.message.includes('no_class_period_clash') ? 'class period clash'
        : insertErr.message.includes('no_teacher_period_clash') ? 'teacher already scheduled'
        : insertErr.message;
      failed.push({ row: -1, error: `${entry.class_id}/${entry.day_of_week}/${entry.period}: ${rowHint}` });
    } else {
      imported++;
    }
  }

  const finalStatus = failed.length === 0 ? 'done' : imported === 0 ? 'failed' : 'partial_failure';
  await supabase.from('import_jobs').update({
    imported_rows: imported, failed_rows: failed.length,
    errors: failed, status: finalStatus, completed_at: new Date().toISOString(),
  }).eq('id', job.id);

  return json({ success: finalStatus !== 'failed', job_id: job.id, total: rows.length, imported, failed: failed.length, status: finalStatus, errors: failed.slice(0, 20) });
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
