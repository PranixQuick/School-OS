// app/api/import/fees/route.ts
// EdProSys — Fees Bulk Importer (Mission 5) — corrected to repo conventions.
// fees(school_id NN, student_id NN, amount numeric NN, due_date date NN,
//   status default 'pending', fee_type default 'tuition', description,
//   data_source NN default 'live', import_batch_id)  — no DB unique.
// Logical dedupe key: student_id|fee_type|due_date|amount. students UNIQUE (admission_number).

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId, getUserRole, MissingSchoolIdError } from '@/lib/getSchoolId';
import { logActivity, logError } from '@/lib/logger';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['owner', 'principal', 'admin', 'admin_staff', 'accountant', 'super_admin'];
const MAX_ROWS = 1000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_FEE_TYPES = ['tuition', 'transport', 'hostel', 'exam', 'library', 'lab', 'admission', 'uniform', 'books', 'misc', 'other'];

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
  if (!ALLOWED_ROLES.includes(role)) return { error: `Role '${role || 'unknown'}' is not permitted to import fees`, status: 403 };
  return { schoolId };
}

type ValidRow = { admission_number: string; amount: number; due_date: string; fee_type: string; description: string | null };
type RowError = { row: number; admission_number?: string; reason: string };
function str(v: unknown): string { return typeof v === 'string' ? v.trim() : (typeof v === 'number' ? String(v) : ''); }

function validateRow(raw: RawRow, index: number): { ok: true; value: ValidRow } | { ok: false; error: RowError } {
  const row = index + 1;
  if (raw == null || typeof raw !== 'object') return { ok: false, error: { row, reason: 'Row is not an object' } };
  const admission_number = str(raw.admission_number); if (!admission_number) return { ok: false, error: { row, reason: 'admission_number is required' } };
  const amountRaw = typeof raw.amount === 'number' ? raw.amount : Number(str(raw.amount));
  if (!Number.isFinite(amountRaw)) return { ok: false, error: { row, admission_number, reason: 'amount must be a number' } };
  if (amountRaw <= 0) return { ok: false, error: { row, admission_number, reason: 'amount must be greater than 0' } };
  const amount = Math.round(amountRaw * 100) / 100;
  const due_date = str(raw.due_date);
  if (!ISO_DATE.test(due_date) || Number.isNaN(Date.parse(due_date))) return { ok: false, error: { row, admission_number, reason: 'due_date must be a valid YYYY-MM-DD' } };
  const fee_type = (str(raw.fee_type) || 'tuition').toLowerCase();
  if (!ALLOWED_FEE_TYPES.includes(fee_type)) return { ok: false, error: { row, admission_number, reason: `fee_type must be one of: ${ALLOWED_FEE_TYPES.join(', ')}` } };
  return { ok: true, value: { admission_number, amount, due_date, fee_type, description: str(raw.description) || null } };
}

function logicalKey(studentId: string, feeType: string, dueDate: string, amount: number): string { return `${studentId}|${feeType}|${dueDate}|${amount}`; }

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
    if (validationErrors.length && mode === 'error') return NextResponse.json({ error: 'Validation failed', validation_errors: validationErrors }, { status: 422 });

    const admissionNumbers = Array.from(new Set(valid.map((v) => v.admission_number)));
    const { data: students, error: stuErr } = await supabaseAdmin.from('students').select('id, admission_number').eq('school_id', schoolId).in('admission_number', admissionNumbers);
    if (stuErr) throw new Error(`student lookup failed: ${stuErr.message}`);
    const studentByAdm = new Map<string, string>();
    (students ?? []).forEach((s: any) => studentByAdm.set(String(s.admission_number), s.id));

    const unmatched: RowError[] = [];
    const linkable = valid.filter((v, i) => { if (!studentByAdm.has(v.admission_number)) { unmatched.push({ row: i + 1, admission_number: v.admission_number, reason: 'no student with this admission_number in your school' }); return false; } return true; });
    if (unmatched.length && mode === 'error') return NextResponse.json({ error: 'Unmatched students', unmatched }, { status: 422 });

    const seen = new Set<string>(); const duplicatesInBatch: RowError[] = [];
    const deduped = linkable.filter((v, i) => { const k = logicalKey(studentByAdm.get(v.admission_number)!, v.fee_type, v.due_date, v.amount); if (seen.has(k)) { duplicatesInBatch.push({ row: i + 1, admission_number: v.admission_number, reason: 'duplicate fee (student/type/due_date/amount) within this import' }); return false; } seen.add(k); return true; });

    const studentIds = Array.from(new Set(deduped.map((v) => studentByAdm.get(v.admission_number)!)));
    const dueDates = Array.from(new Set(deduped.map((v) => v.due_date)));
    const existingKeys = new Set<string>();
    if (studentIds.length && dueDates.length) {
      const { data: existing, error: exErr } = await supabaseAdmin.from('fees').select('student_id, fee_type, due_date, amount').in('student_id', studentIds).in('due_date', dueDates);
      if (exErr) throw new Error(`existing-check failed: ${exErr.message}`);
      (existing ?? []).forEach((x: any) => { const amt = Math.round(Number(x.amount) * 100) / 100; existingKeys.add(logicalKey(x.student_id, String(x.fee_type ?? 'tuition').toLowerCase(), x.due_date, amt)); });
    }
    const duplicatesInDb: RowError[] = [];
    const toInsert = deduped.filter((v, i) => { const k = logicalKey(studentByAdm.get(v.admission_number)!, v.fee_type, v.due_date, v.amount); if (existingKeys.has(k)) { duplicatesInDb.push({ row: i + 1, admission_number: v.admission_number, reason: 'identical fee already exists' }); return false; } return true; });
    if (duplicatesInDb.length && mode === 'error') return NextResponse.json({ error: 'Duplicate fees already exist', duplicates_in_db: duplicatesInDb }, { status: 409 });

    if (toInsert.length === 0) return NextResponse.json({ import_batch_id: null, summary: { received: rows.length, inserted: 0, unmatched_students: unmatched.length, skipped_existing: duplicatesInDb.length, duplicates_in_batch: duplicatesInBatch.length, validation_failed: validationErrors.length }, unmatched, duplicates_in_db: duplicatesInDb, duplicates_in_batch: duplicatesInBatch, validation_errors: validationErrors });

    const importBatchId = randomUUID();
    const payload = toInsert.map((v) => ({ school_id: schoolId, student_id: studentByAdm.get(v.admission_number)!, amount: v.amount, due_date: v.due_date, fee_type: v.fee_type, description: v.description, status: 'pending', data_source: 'live', import_batch_id: importBatchId }));
    const { data: inserted, error: insErr } = await supabaseAdmin.from('fees').insert(payload).select('id, student_id, amount, due_date, fee_type');
    if (insErr) throw new Error(`insert failed: ${insErr.message}`);

    await logActivity({ schoolId, action: `Imported ${inserted?.length ?? 0} fee records`, module: 'import', details: { import_batch_id: importBatchId, inserted: inserted?.length ?? 0, unmatched: unmatched.length, mode } });

    return NextResponse.json({
      import_batch_id: importBatchId,
      rollback: { method: 'DELETE', endpoint: '/api/import/fees', body: { import_batch_id: importBatchId } },
      summary: { received: rows.length, inserted: inserted?.length ?? 0, unmatched_students: unmatched.length, skipped_existing: duplicatesInDb.length, duplicates_in_batch: duplicatesInBatch.length, validation_failed: validationErrors.length },
      inserted: (inserted ?? []).map((x: any) => ({ id: x.id, student_id: x.student_id, amount: x.amount, due_date: x.due_date, fee_type: x.fee_type })),
      unmatched, duplicates_in_db: duplicatesInDb, duplicates_in_batch: duplicatesInBatch, validation_errors: validationErrors,
    });
  } catch (err) {
    await logError({ route: '/api/import/fees', error: String(err), schoolId });
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
    const { data: deleted, error: delErr } = await supabaseAdmin.from('fees').delete().eq('import_batch_id', importBatchId).eq('school_id', schoolId).select('id');
    if (delErr) throw new Error(`rollback failed: ${delErr.message}`);
    await logActivity({ schoolId, action: `Rolled back fees import ${importBatchId}`, module: 'import', details: { import_batch_id: importBatchId, deleted: deleted?.length ?? 0 } });
    return NextResponse.json({ import_batch_id: importBatchId, rolled_back: deleted?.length ?? 0 });
  } catch (err) {
    await logError({ route: '/api/import/fees', error: String(err), schoolId });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    resource: 'fees', methods: ['POST (CSV multipart or JSON)', 'DELETE (rollback)'],
    fields: { admission_number: 'required — links to an existing student in your school', amount: 'number > 0', due_date: 'YYYY-MM-DD', fee_type: `optional one of: ${ALLOWED_FEE_TYPES.join(', ')} (default tuition)`, description: 'optional' },
    duplicate_handling: 'logical key student+fee_type+due_date+amount; unmatched admission_numbers reported',
    rollback: 'DELETE /api/import/fees with { import_batch_id }',
  });
}
