// app/api/import/academic-years/route.ts
// EdProSys — Academic Year Bulk Importer (Mission 1) — corrected to repo conventions
// Reference: app/api/import/students/route.ts
//
// Auth model (verified): middleware injects x-school-id and x-user-role from the
// session cookie. getSchoolId(req) throws if absent; getUserRole(req) returns role.
// Tenant: institution_id resolved from school via getInstitutionForSchool(schoolId).
// Client: supabaseAdmin singleton (service role). Logging: logActivity/logError.
// Rollback: rows stamped with import_batch_id; DELETE removes the batch (school-scoped).

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId, getUserRole, MissingSchoolIdError } from '@/lib/getSchoolId';
import { getInstitutionForSchool } from '@/lib/tenant-lookup';
import { logActivity, logError } from '@/lib/logger';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['owner', 'principal', 'admin', 'admin_staff', 'super_admin'];
const MAX_ROWS = 200;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_TERM_STRUCTURE = [
  { name: 'Term 1', assessments: ['FA1', 'FA2', 'SA1'] },
  { name: 'Term 2', assessments: ['FA3', 'FA4', 'SA2'] },
];

type RawRow = Record<string, unknown>;

// RFC-ish CSV parser: handles quoted fields and escaped quotes ("") so commas
// inside quotes don't mis-split. Read-only parse; values are never evaluated.
function parseCSV(text: string): RawRow[] {
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { record.push(field); field = ''; }
    else if (c === '\n') { record.push(field); records.push(record); record = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || record.length) { record.push(field); records.push(record); }
  if (records.length < 1) return [];
  const headers = records[0].map((h) => h.trim().toLowerCase());
  return records.slice(1)
    .filter((r) => r.some((c) => c.trim() !== ''))
    .map((r) => { const o: RawRow = {}; headers.forEach((h, idx) => { o[h] = (r[idx] ?? '').trim(); }); return o; });
}

async function readRows(req: NextRequest): Promise<{ rows: RawRow[]; mode: 'skip' | 'error' } | { error: string; status: number }> {
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return { error: 'CSV file required (form field "file")', status: 400 };
    if (!file.name.toLowerCase().endsWith('.csv')) return { error: 'Only CSV files accepted', status: 400 };
    if (file.size > 2 * 1024 * 1024) return { error: 'File too large. Max 2MB.', status: 400 };
    const text = await file.text();
    const m = (form.get('mode') as string) || 'skip';
    return { rows: parseCSV(text), mode: m === 'error' ? 'error' : 'skip' };
  }
  let body: any;
  try { body = await req.json(); } catch { return { error: 'Invalid JSON body', status: 400 }; }
  const rows: RawRow[] = Array.isArray(body) ? body : Array.isArray(body?.rows) ? body.rows : [];
  return { rows, mode: body?.mode === 'error' ? 'error' : 'skip' };
}

function requireRole(req: NextRequest): { schoolId: string } | { error: string; status: number } {
  let schoolId: string;
  try { schoolId = getSchoolId(req); }
  catch (e) { if (e instanceof MissingSchoolIdError) return { error: 'Not authenticated', status: 401 }; throw e; }
  const role = getUserRole(req);
  if (!ALLOWED_ROLES.includes(role)) return { error: `Role '${role || 'unknown'}' is not permitted to import academic years`, status: 403 };
  return { schoolId };
}

type ValidRow = { label: string; start_date: string; end_date: string; is_current: boolean; term_structure: unknown };
type RowError = { row: number; label?: string; reason: string };

function str(v: unknown): string { return typeof v === 'string' ? v.trim() : (typeof v === 'number' ? String(v) : ''); }

function validateRow(raw: RawRow, index: number): { ok: true; value: ValidRow } | { ok: false; error: RowError } {
  const row = index + 1;
  if (raw == null || typeof raw !== 'object') return { ok: false, error: { row, reason: 'Row is not an object' } };
  const label = str(raw.label);
  if (!label) return { ok: false, error: { row, reason: 'label is required' } };
  if (label.length > 60) return { ok: false, error: { row, label, reason: 'label exceeds 60 characters' } };
  const start_date = str(raw.start_date);
  const end_date = str(raw.end_date);
  if (!ISO_DATE.test(start_date)) return { ok: false, error: { row, label, reason: 'start_date must be YYYY-MM-DD' } };
  if (!ISO_DATE.test(end_date)) return { ok: false, error: { row, label, reason: 'end_date must be YYYY-MM-DD' } };
  const s = Date.parse(start_date); const e = Date.parse(end_date);
  if (Number.isNaN(s) || Number.isNaN(e)) return { ok: false, error: { row, label, reason: 'invalid date value' } };
  if (e <= s) return { ok: false, error: { row, label, reason: 'end_date must be after start_date' } };
  let is_current = false;
  if (typeof raw.is_current === 'boolean') is_current = raw.is_current;
  else { const iv = str(raw.is_current).toLowerCase(); is_current = ['true', '1', 'yes', 'y'].includes(iv); }
  let term_structure: unknown = raw.term_structure;
  if (term_structure == null || term_structure === '') term_structure = DEFAULT_TERM_STRUCTURE;
  else if (typeof term_structure === 'string') { try { term_structure = JSON.parse(term_structure); } catch { return { ok: false, error: { row, label, reason: 'term_structure is not valid JSON' } }; } }
  if (typeof term_structure !== 'object') return { ok: false, error: { row, label, reason: 'term_structure must be an object or array' } };
  return { ok: true, value: { label, start_date, end_date, is_current, term_structure } };
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

    const { institution_id } = await getInstitutionForSchool(schoolId);
    if (!institution_id) return NextResponse.json({ error: 'No institution is linked to your school; cannot import academic years.' }, { status: 400 });

    const valid: ValidRow[] = [];
    const validationErrors: RowError[] = [];
    rows.forEach((row, i) => { const v = validateRow(row, i); if (v.ok) valid.push(v.value); else validationErrors.push(v.error); });

    const seen = new Set<string>();
    const duplicatesInBatch: RowError[] = [];
    const deduped: ValidRow[] = [];
    valid.forEach((v, i) => { const k = v.label.toLowerCase(); if (seen.has(k)) duplicatesInBatch.push({ row: i + 1, label: v.label, reason: 'duplicate label within this import' }); else { seen.add(k); deduped.push(v); } });

    const currentRows = deduped.filter((v) => v.is_current);
    if (currentRows.length > 1) return NextResponse.json({ error: 'Only one row may set is_current = true per import', is_current_rows: currentRows.map((v) => v.label) }, { status: 400 });
    if (validationErrors.length && mode === 'error') return NextResponse.json({ error: 'Validation failed', validation_errors: validationErrors, duplicates_in_batch: duplicatesInBatch }, { status: 422 });

    const labels = deduped.map((v) => v.label);
    const { data: existing, error: exErr } = await supabaseAdmin.from('academic_years').select('label').eq('institution_id', institution_id).in('label', labels);
    if (exErr) throw new Error(`existing-check failed: ${exErr.message}`);
    const existingSet = new Set((existing ?? []).map((x: any) => String(x.label).toLowerCase()));
    const duplicatesInDb: string[] = [];
    const toInsert = deduped.filter((v) => { if (existingSet.has(v.label.toLowerCase())) { duplicatesInDb.push(v.label); return false; } return true; });
    if (duplicatesInDb.length && mode === 'error') return NextResponse.json({ error: 'Duplicate academic years already exist', duplicates_in_db: duplicatesInDb }, { status: 409 });

    if (toInsert.length === 0) return NextResponse.json({ import_batch_id: null, summary: { received: rows.length, inserted: 0, skipped_existing: duplicatesInDb.length, duplicates_in_batch: duplicatesInBatch.length, validation_failed: validationErrors.length }, duplicates_in_db: duplicatesInDb, duplicates_in_batch: duplicatesInBatch, validation_errors: validationErrors }, { status: 200 });

    const importBatchId = randomUUID();
    const payload = toInsert.map((v) => ({ institution_id, school_id: schoolId, label: v.label, start_date: v.start_date, end_date: v.end_date, is_current: false, term_structure: v.term_structure, status: 'draft', import_batch_id: importBatchId }));
    const { data: inserted, error: insErr } = await supabaseAdmin.from('academic_years').insert(payload).select('id, label');
    if (insErr) throw new Error(`insert failed: ${insErr.message}`);

    let currentSetFor: string | null = null;
    const wantsCurrent = toInsert.find((v) => v.is_current);
    if (wantsCurrent && inserted) {
      const target = inserted.find((x: any) => x.label === wantsCurrent.label);
      if (target) {
        await supabaseAdmin.from('academic_years').update({ is_current: false }).eq('institution_id', institution_id).eq('is_current', true);
        await supabaseAdmin.from('academic_years').update({ is_current: true, status: 'active', promoted_at: new Date().toISOString() }).eq('id', (target as any).id);
        currentSetFor = wantsCurrent.label;
      }
    }

    await logActivity({ schoolId, action: `Imported ${inserted?.length ?? 0} academic years`, module: 'import', details: { import_batch_id: importBatchId, inserted: inserted?.length ?? 0, current_set_for: currentSetFor, mode } });

    return NextResponse.json({
      import_batch_id: importBatchId,
      rollback: { method: 'DELETE', endpoint: '/api/import/academic-years', body: { import_batch_id: importBatchId } },
      summary: { received: rows.length, inserted: inserted?.length ?? 0, current_set_for: currentSetFor, skipped_existing: duplicatesInDb.length, duplicates_in_batch: duplicatesInBatch.length, validation_failed: validationErrors.length },
      inserted: (inserted ?? []).map((x: any) => ({ id: x.id, label: x.label })),
      duplicates_in_db: duplicatesInDb, duplicates_in_batch: duplicatesInBatch, validation_errors: validationErrors,
    });
  } catch (err) {
    await logError({ route: '/api/import/academic-years', error: String(err), schoolId });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const gate = requireRole(req);
  if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { schoolId } = gate;
  try {
    let body: any = {};
    try { body = await req.json(); } catch {}
    const importBatchId: string | null = (typeof body?.import_batch_id === 'string' ? body.import_batch_id : null) ?? req.nextUrl.searchParams.get('import_batch_id');
    if (!importBatchId) return NextResponse.json({ error: 'import_batch_id is required' }, { status: 400 });
    const { data: deleted, error: delErr } = await supabaseAdmin.from('academic_years').delete().eq('import_batch_id', importBatchId).eq('school_id', schoolId).select('id, label');
    if (delErr) throw new Error(`rollback failed: ${delErr.message}`);
    await logActivity({ schoolId, action: `Rolled back academic-year import ${importBatchId}`, module: 'import', details: { import_batch_id: importBatchId, deleted: deleted?.length ?? 0 } });
    return NextResponse.json({ import_batch_id: importBatchId, rolled_back: deleted?.length ?? 0, deleted: deleted ?? [] });
  } catch (err) {
    await logError({ route: '/api/import/academic-years', error: String(err), schoolId });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    resource: 'academic_years', methods: ['POST (CSV multipart or JSON)', 'DELETE (rollback)'],
    fields: { label: 'string, required, unique per institution, <=60', start_date: 'YYYY-MM-DD', end_date: 'YYYY-MM-DD after start_date', is_current: 'optional boolean (max one per import)', term_structure: 'optional JSON; defaults to FA/SA two-term' },
    duplicate_handling: 'by label within institution (UNIQUE institution_id, label); mode=skip|error',
    rollback: 'DELETE /api/import/academic-years with { import_batch_id }',
  });
}
