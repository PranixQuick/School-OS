// app/api/import/parents/route.ts
// EdProSys — Parent Bulk Importer (Mission 4) — corrected to repo conventions.
// parents(school_id NN, student_id NN, name NN, phone NN, email, language_pref default 'en',
//   data_source NN default 'live', is_active NN default true, import_batch_id)
// UNIQUE (school_id, phone). students UNIQUE (admission_number).
// Linking: admission_number resolved to a student within the caller's school (tenant guard).

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId, getUserRole, MissingSchoolIdError } from '@/lib/getSchoolId';
import { logActivity, logError } from '@/lib/logger';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['owner', 'principal', 'admin', 'admin_staff', 'super_admin'];
const MAX_ROWS = 500;
const ALLOWED_LANGS = ['en', 'te'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+][0-9\s-]{6,19}$/;

type RawRow = Record<string, unknown>;

function parseCSV(text: string): RawRow[] {
  const records: string[][] = []; let field = ''; let record: string[] = []; let inQuotes = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (inQuotes) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; } else field += c; }
    else if (c === '"') inQuotes = true; else if (c === ',') { record.push(field); field = ''; }
    else if (c === '\n') { record.push(field); records.push(record); record = []; field = ''; } else if (c !== '\r') field += c; }
  if (field.length || record.length) { record.push(field); records.push(record); }
  if (records.length < 1) return [];
  const headers = records[0].map((h) => h.trim().toLowerCase());
  return records.slice(1).filter((r) => r.some((c) => c.trim() !== '')).map((r) => { const o: RawRow = {}; headers.forEach((h, idx) => { o[h] = (r[idx] ?? '').trim(); }); return o; });
}

async function readRows(req: NextRequest): Promise<{ rows: RawRow[]; mode: 'skip' | 'error' } | { error: string; status: number }> {
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('multipart/form-data')) {
    const form = await req.formData(); const file = form.get('file');
    if (!(file instanceof File)) return { error: 'CSV file required (form field "file")', status: 400 };
    if (!file.name.toLowerCase().endsWith('.csv')) return { error: 'Only CSV files accepted', status: 400 };
    if (file.size > 2 * 1024 * 1024) return { error: 'File too large. Max 2MB.', status: 400 };
    const m = (form.get('mode') as string) || 'skip';
    return { rows: parseCSV(await file.text()), mode: m === 'error' ? 'error' : 'skip' };
  }
  let body: any; try { body = await req.json(); } catch { return { error: 'Invalid JSON body', status: 400 }; }
  const rows: RawRow[] = Array.isArray(body) ? body : Array.isArray(body?.rows) ? body.rows : [];
  return { rows, mode: body?.mode === 'error' ? 'error' : 'skip' };
}

function requireRole(req: NextRequest): { schoolId: string } | { error: string; status: number } {
  let schoolId: string;
  try { schoolId = getSchoolId(req); } catch (e) { if (e instanceof MissingSchoolIdError) return { error: 'Not authenticated', status: 401 }; throw e; }
  const role = getUserRole(req);
  if (!ALLOWED_ROLES.includes(role)) return { error: `Role '${role || 'unknown'}' is not permitted to import parents`, status: 403 };
  return { schoolId };
}

type ValidRow = { admission_number: string; name: string; phone: string; email: string | null; language_pref: string };
type RowError = { row: number; admission_number?: string; reason: string };
function str(v: unknown): string { return typeof v === 'string' ? v.trim() : (typeof v === 'number' ? String(v) : ''); }

function validateRow(raw: RawRow, index: number): { ok: true; value: ValidRow } | { ok: false; error: RowError } {
  const row = index + 1;
  if (raw == null || typeof raw !== 'object') return { ok: false, error: { row, reason: 'Row is not an object' } };
  const admission_number = str(raw.admission_number); if (!admission_number) return { ok: false, error: { row, reason: 'admission_number is required' } };
  const name = str(raw.name); if (!name) return { ok: false, error: { row, admission_number, reason: 'name is required' } };
  if (name.length > 120) return { ok: false, error: { row, admission_number, reason: 'name exceeds 120 characters' } };
  const phone = str(raw.phone); if (!phone) return { ok: false, error: { row, admission_number, reason: 'phone is required' } };
  if (!PHONE_RE.test(phone)) return { ok: false, error: { row, admission_number, reason: 'phone is not a valid number' } };
  const emailRaw = str(raw.email); let email: string | null = null;
  if (emailRaw) { if (!EMAIL_RE.test(emailRaw)) return { ok: false, error: { row, admission_number, reason: 'email is not a valid address' } }; email = emailRaw.toLowerCase(); }
  let language_pref = str(raw.language_pref).toLowerCase() || 'en';
  if (!ALLOWED_LANGS.includes(language_pref)) language_pref = 'en';
  return { ok: true, value: { admission_number, name, phone, email, language_pref } };
}

export async function POST(req: NextRequest) {
  const gate = requireRole(req);
  if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { schoolId } = gate;
  try {
    const r = await readRows(req);
    if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
    const { rows, mode } = r;
    if (rows.length === 0) return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
    if (rows.length > MAX_ROWS) return NextResponse.json({ error: `Too many rows in one import (max ${MAX_ROWS})` }, { status: 400 });

    const valid: ValidRow[] = []; const validationErrors: RowError[] = [];
    rows.forEach((row, i) => { const v = validateRow(row, i); if (v.ok) valid.push(v.value); else validationErrors.push(v.error); });

    const seenPhone = new Set<string>(); const duplicatesInBatch: RowError[] = []; const deduped: ValidRow[] = [];
    valid.forEach((v, i) => { if (seenPhone.has(v.phone)) duplicatesInBatch.push({ row: i + 1, admission_number: v.admission_number, reason: 'duplicate phone within this import' }); else { seenPhone.add(v.phone); deduped.push(v); } });

    if (validationErrors.length && mode === 'error') return NextResponse.json({ error: 'Validation failed', validation_errors: validationErrors, duplicates_in_batch: duplicatesInBatch }, { status: 422 });

    // Resolve students by admission_number WITHIN the caller's school (tenant guard)
    const admissionNumbers = Array.from(new Set(deduped.map((v) => v.admission_number)));
    const { data: students, error: stuErr } = await supabaseAdmin.from('students').select('id, admission_number').eq('school_id', schoolId).in('admission_number', admissionNumbers);
    if (stuErr) throw new Error(`student lookup failed: ${stuErr.message}`);
    const studentByAdm = new Map<string, string>();
    (students ?? []).forEach((s: any) => studentByAdm.set(String(s.admission_number), s.id));

    const unmatched: RowError[] = [];
    const linkable = deduped.filter((v, i) => { if (!studentByAdm.has(v.admission_number)) { unmatched.push({ row: i + 1, admission_number: v.admission_number, reason: 'no student with this admission_number in your school' }); return false; } return true; });
    if (unmatched.length && mode === 'error') return NextResponse.json({ error: 'Unmatched students', unmatched }, { status: 422 });

    const phones = linkable.map((v) => v.phone);
    const existingSet = new Set<string>();
    if (phones.length) {
      const { data: existing, error: exErr } = await supabaseAdmin.from('parents').select('phone').eq('school_id', schoolId).in('phone', phones);
      if (exErr) throw new Error(`existing-check failed: ${exErr.message}`);
      (existing ?? []).forEach((x: any) => existingSet.add(String(x.phone)));
    }
    const duplicatesInDb: string[] = [];
    const toInsert = linkable.filter((v) => { if (existingSet.has(v.phone)) { duplicatesInDb.push(v.phone); return false; } return true; });
    if (duplicatesInDb.length && mode === 'error') return NextResponse.json({ error: 'Duplicate parent phones already exist', duplicates_in_db: duplicatesInDb }, { status: 409 });

    if (toInsert.length === 0) return NextResponse.json({ import_batch_id: null, summary: { received: rows.length, inserted: 0, unmatched_students: unmatched.length, skipped_existing: duplicatesInDb.length, duplicates_in_batch: duplicatesInBatch.length, validation_failed: validationErrors.length }, unmatched, duplicates_in_db: duplicatesInDb, duplicates_in_batch: duplicatesInBatch, validation_errors: validationErrors });

    const importBatchId = randomUUID();
    const payload = toInsert.map((v) => ({ school_id: schoolId, student_id: studentByAdm.get(v.admission_number)!, name: v.name, phone: v.phone, email: v.email, language_pref: v.language_pref, is_active: true, data_source: 'live', import_batch_id: importBatchId }));
    const { data: inserted, error: insErr } = await supabaseAdmin.from('parents').insert(payload).select('id, name, student_id');
    if (insErr) throw new Error(`insert failed: ${insErr.message}`);

    await logActivity({ schoolId, action: `Imported ${inserted?.length ?? 0} parents`, module: 'import', details: { import_batch_id: importBatchId, inserted: inserted?.length ?? 0, unmatched: unmatched.length, mode } });

    return NextResponse.json({
      import_batch_id: importBatchId,
      rollback: { method: 'DELETE', endpoint: '/api/import/parents', body: { import_batch_id: importBatchId } },
      summary: { received: rows.length, inserted: inserted?.length ?? 0, unmatched_students: unmatched.length, skipped_existing: duplicatesInDb.length, duplicates_in_batch: duplicatesInBatch.length, validation_failed: validationErrors.length },
      inserted: (inserted ?? []).map((x: any) => ({ id: x.id, name: x.name, student_id: x.student_id })),
      unmatched, duplicates_in_db: duplicatesInDb, duplicates_in_batch: duplicatesInBatch, validation_errors: validationErrors,
    });
  } catch (err) {
    await logError({ route: '/api/import/parents', error: String(err), schoolId });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const gate = requireRole(req);
  if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { schoolId } = gate;
  try {
    let body: any = {}; try { body = await req.json(); } catch {}
    const importBatchId: string | null = (typeof body?.import_batch_id === 'string' ? body.import_batch_id : null) ?? req.nextUrl.searchParams.get('import_batch_id');
    if (!importBatchId) return NextResponse.json({ error: 'import_batch_id is required' }, { status: 400 });
    const { data: deleted, error: delErr } = await supabaseAdmin.from('parents').delete().eq('import_batch_id', importBatchId).eq('school_id', schoolId).select('id, name');
    if (delErr) throw new Error(`rollback failed: ${delErr.message}`);
    await logActivity({ schoolId, action: `Rolled back parent import ${importBatchId}`, module: 'import', details: { import_batch_id: importBatchId, deleted: deleted?.length ?? 0 } });
    return NextResponse.json({ import_batch_id: importBatchId, rolled_back: deleted?.length ?? 0, deleted: deleted ?? [] });
  } catch (err) {
    await logError({ route: '/api/import/parents', error: String(err), schoolId });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    resource: 'parents', methods: ['POST (CSV multipart or JSON)', 'DELETE (rollback)'],
    fields: { admission_number: 'required — links to an existing student in your school', name: 'required <=120', phone: 'required, unique per school', email: 'optional validated', language_pref: 'optional en|te (default en)' },
    duplicate_handling: 'by phone within school (UNIQUE school_id, phone); unmatched admission_numbers reported',
    rollback: 'DELETE /api/import/parents with { import_batch_id }',
  });
}
