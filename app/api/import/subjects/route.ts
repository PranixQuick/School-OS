// app/api/import/subjects/route.ts
// EdProSys — Subject Bulk Importer (Mission 3) — corrected to repo conventions.
// subjects(school_id NN, institution_id, code NN, name NN, board_alignment, import_batch_id)
// UNIQUE (school_id, code) -> duplicate key.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId, getUserRole, MissingSchoolIdError } from '@/lib/getSchoolId';
import { getInstitutionForSchool } from '@/lib/tenant-lookup';
import { logActivity, logError } from '@/lib/logger';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['owner', 'principal', 'admin', 'admin_staff', 'super_admin'];
const MAX_ROWS = 500;

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
  if (!ALLOWED_ROLES.includes(role)) return { error: `Role '${role || 'unknown'}' is not permitted to import subjects`, status: 403 };
  return { schoolId };
}

type ValidRow = { code: string; name: string; board_alignment: string | null };
type RowError = { row: number; code?: string; reason: string };
function str(v: unknown): string { return typeof v === 'string' ? v.trim() : (typeof v === 'number' ? String(v) : ''); }

function validateRow(raw: RawRow, index: number): { ok: true; value: ValidRow } | { ok: false; error: RowError } {
  const row = index + 1;
  if (raw == null || typeof raw !== 'object') return { ok: false, error: { row, reason: 'Row is not an object' } };
  const code = str(raw.code); if (!code) return { ok: false, error: { row, reason: 'code is required' } };
  if (code.length > 30) return { ok: false, error: { row, code, reason: 'code exceeds 30 characters' } };
  const name = str(raw.name); if (!name) return { ok: false, error: { row, code, reason: 'name is required' } };
  if (name.length > 120) return { ok: false, error: { row, code, reason: 'name exceeds 120 characters' } };
  return { ok: true, value: { code, name, board_alignment: str(raw.board_alignment) || null } };
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

    const valid: ValidRow[] = []; const validationErrors: RowError[] = [];
    rows.forEach((row, i) => { const v = validateRow(row, i); if (v.ok) valid.push(v.value); else validationErrors.push(v.error); });

    const seen = new Set<string>(); const duplicatesInBatch: RowError[] = []; const deduped: ValidRow[] = [];
    valid.forEach((v, i) => { const k = v.code.toLowerCase(); if (seen.has(k)) duplicatesInBatch.push({ row: i + 1, code: v.code, reason: 'duplicate code within this import' }); else { seen.add(k); deduped.push(v); } });

    if (validationErrors.length && mode === 'error') return NextResponse.json({ error: 'Validation failed', validation_errors: validationErrors, duplicates_in_batch: duplicatesInBatch }, { status: 422 });

    const codes = deduped.map((v) => v.code);
    const { data: existing, error: exErr } = await supabaseAdmin.from('subjects').select('code').eq('school_id', schoolId).in('code', codes);
    if (exErr) throw new Error(`existing-check failed: ${exErr.message}`);
    const existingSet = new Set((existing ?? []).map((x: any) => String(x.code).toLowerCase()));
    const duplicatesInDb: string[] = [];
    const toInsert = deduped.filter((v) => { if (existingSet.has(v.code.toLowerCase())) { duplicatesInDb.push(v.code); return false; } return true; });
    if (duplicatesInDb.length && mode === 'error') return NextResponse.json({ error: 'Duplicate subject codes already exist', duplicates_in_db: duplicatesInDb }, { status: 409 });

    if (toInsert.length === 0) return NextResponse.json({ import_batch_id: null, summary: { received: rows.length, inserted: 0, skipped_existing: duplicatesInDb.length, duplicates_in_batch: duplicatesInBatch.length, validation_failed: validationErrors.length }, duplicates_in_db: duplicatesInDb, duplicates_in_batch: duplicatesInBatch, validation_errors: validationErrors });

    const importBatchId = randomUUID();
    const payload = toInsert.map((v) => ({ school_id: schoolId, institution_id, code: v.code, name: v.name, board_alignment: v.board_alignment, import_batch_id: importBatchId }));
    const { data: inserted, error: insErr } = await supabaseAdmin.from('subjects').insert(payload).select('id, code, name');
    if (insErr) throw new Error(`insert failed: ${insErr.message}`);

    await logActivity({ schoolId, action: `Imported ${inserted?.length ?? 0} subjects`, module: 'import', details: { import_batch_id: importBatchId, inserted: inserted?.length ?? 0, mode } });

    return NextResponse.json({
      import_batch_id: importBatchId,
      rollback: { method: 'DELETE', endpoint: '/api/import/subjects', body: { import_batch_id: importBatchId } },
      summary: { received: rows.length, inserted: inserted?.length ?? 0, skipped_existing: duplicatesInDb.length, duplicates_in_batch: duplicatesInBatch.length, validation_failed: validationErrors.length },
      inserted: (inserted ?? []).map((x: any) => ({ id: x.id, code: x.code, name: x.name })),
      duplicates_in_db: duplicatesInDb, duplicates_in_batch: duplicatesInBatch, validation_errors: validationErrors,
    });
  } catch (err) {
    await logError({ route: '/api/import/subjects', error: String(err), schoolId });
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
    const { data: deleted, error: delErr } = await supabaseAdmin.from('subjects').delete().eq('import_batch_id', importBatchId).eq('school_id', schoolId).select('id, code');
    if (delErr) throw new Error(`rollback failed: ${delErr.message}`);
    await logActivity({ schoolId, action: `Rolled back subject import ${importBatchId}`, module: 'import', details: { import_batch_id: importBatchId, deleted: deleted?.length ?? 0 } });
    return NextResponse.json({ import_batch_id: importBatchId, rolled_back: deleted?.length ?? 0, deleted: deleted ?? [] });
  } catch (err) {
    await logError({ route: '/api/import/subjects', error: String(err), schoolId });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    resource: 'subjects', methods: ['POST (CSV multipart or JSON)', 'DELETE (rollback)'],
    fields: { code: 'required <=30, unique per school', name: 'required <=120', board_alignment: 'optional' },
    duplicate_handling: 'by code within school (UNIQUE school_id, code)',
    rollback: 'DELETE /api/import/subjects with { import_batch_id }',
  });
}
