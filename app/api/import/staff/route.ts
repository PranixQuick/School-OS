// app/api/import/staff/route.ts
// EdProSys — Staff Bulk Importer (Mission 2) — corrected to repo conventions.
// staff(school_id NN, institution_id, name NN, role NN, subject, phone, email,
//   is_active, data_source NN default 'live', designation, joined_at, import_batch_id)
// No DB unique -> dedupe by (school_id, lower(email)) when email present.

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
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  if (!ALLOWED_ROLES.includes(role)) return { error: `Role '${role || 'unknown'}' is not permitted to import staff`, status: 403 };
  return { schoolId };
}

type ValidRow = { name: string; role: string; email: string | null; phone: string | null; subject: string | null; designation: string | null; joined_at: string | null };
type RowError = { row: number; name?: string; reason: string };
function str(v: unknown): string { return typeof v === 'string' ? v.trim() : (typeof v === 'number' ? String(v) : ''); }

function validateRow(raw: RawRow, index: number): { ok: true; value: ValidRow } | { ok: false; error: RowError } {
  const row = index + 1;
  if (raw == null || typeof raw !== 'object') return { ok: false, error: { row, reason: 'Row is not an object' } };
  const name = str(raw.name); if (!name) return { ok: false, error: { row, reason: 'name is required' } };
  if (name.length > 120) return { ok: false, error: { row, name, reason: 'name exceeds 120 characters' } };
  const role = str(raw.role); if (!role) return { ok: false, error: { row, name, reason: 'role is required' } };
  if (role.length > 40) return { ok: false, error: { row, name, reason: 'role exceeds 40 characters' } };
  const emailRaw = str(raw.email); let email: string | null = null;
  if (emailRaw) { if (!EMAIL_RE.test(emailRaw)) return { ok: false, error: { row, name, reason: 'email is not a valid address' } }; email = emailRaw.toLowerCase(); }
  const phone = str(raw.phone) || null; const subject = str(raw.subject) || null; const designation = str(raw.designation) || null;
  let joined_at: string | null = null; const jr = str(raw.joined_at);
  if (jr) { if (!ISO_DATE.test(jr) || Number.isNaN(Date.parse(jr))) return { ok: false, error: { row, name, reason: 'joined_at must be YYYY-MM-DD' } }; joined_at = jr; }
  return { ok: true, value: { name, role, email, phone, subject, designation, joined_at } };
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

    const seenEmail = new Set<string>(); const duplicatesInBatch: RowError[] = []; const deduped: ValidRow[] = [];
    valid.forEach((v, i) => { if (v.email && seenEmail.has(v.email)) duplicatesInBatch.push({ row: i + 1, name: v.name, reason: 'duplicate email within this import' }); else { if (v.email) seenEmail.add(v.email); deduped.push(v); } });

    if (validationErrors.length && mode === 'error') return NextResponse.json({ error: 'Validation failed', validation_errors: validationErrors, duplicates_in_batch: duplicatesInBatch }, { status: 422 });

    const emails = deduped.map((v) => v.email).filter((e): e is string => !!e);
    const existingSet = new Set<string>();
    if (emails.length) {
      const { data: existing, error: exErr } = await supabaseAdmin.from('staff').select('email').eq('school_id', schoolId).in('email', emails);
      if (exErr) throw new Error(`existing-check failed: ${exErr.message}`);
      (existing ?? []).forEach((x: any) => { if (x.email) existingSet.add(String(x.email).toLowerCase()); });
    }
    const duplicatesInDb: string[] = [];
    const toInsert = deduped.filter((v) => { if (v.email && existingSet.has(v.email)) { duplicatesInDb.push(v.email); return false; } return true; });
    if (duplicatesInDb.length && mode === 'error') return NextResponse.json({ error: 'Duplicate staff (by email) already exist', duplicates_in_db: duplicatesInDb }, { status: 409 });

    if (toInsert.length === 0) return NextResponse.json({ import_batch_id: null, summary: { received: rows.length, inserted: 0, skipped_existing: duplicatesInDb.length, duplicates_in_batch: duplicatesInBatch.length, validation_failed: validationErrors.length }, duplicates_in_db: duplicatesInDb, duplicates_in_batch: duplicatesInBatch, validation_errors: validationErrors });

    const importBatchId = randomUUID();
    const payload = toInsert.map((v) => ({ school_id: schoolId, institution_id, name: v.name, role: v.role, email: v.email, phone: v.phone, subject: v.subject, designation: v.designation, joined_at: v.joined_at, is_active: true, data_source: 'live', import_batch_id: importBatchId }));
    const { data: inserted, error: insErr } = await supabaseAdmin.from('staff').insert(payload).select('id, name');
    if (insErr) throw new Error(`insert failed: ${insErr.message}`);

    await logActivity({ schoolId, action: `Imported ${inserted?.length ?? 0} staff`, module: 'import', details: { import_batch_id: importBatchId, inserted: inserted?.length ?? 0, mode } });

    return NextResponse.json({
      import_batch_id: importBatchId,
      rollback: { method: 'DELETE', endpoint: '/api/import/staff', body: { import_batch_id: importBatchId } },
      summary: { received: rows.length, inserted: inserted?.length ?? 0, skipped_existing: duplicatesInDb.length, duplicates_in_batch: duplicatesInBatch.length, validation_failed: validationErrors.length },
      inserted: (inserted ?? []).map((x: any) => ({ id: x.id, name: x.name })),
      duplicates_in_db: duplicatesInDb, duplicates_in_batch: duplicatesInBatch, validation_errors: validationErrors,
    });
  } catch (err) {
    await logError({ route: '/api/import/staff', error: String(err), schoolId });
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
    const { data: deleted, error: delErr } = await supabaseAdmin.from('staff').delete().eq('import_batch_id', importBatchId).eq('school_id', schoolId).select('id, name');
    if (delErr) throw new Error(`rollback failed: ${delErr.message}`);
    await logActivity({ schoolId, action: `Rolled back staff import ${importBatchId}`, module: 'import', details: { import_batch_id: importBatchId, deleted: deleted?.length ?? 0 } });
    return NextResponse.json({ import_batch_id: importBatchId, rolled_back: deleted?.length ?? 0, deleted: deleted ?? [] });
  } catch (err) {
    await logError({ route: '/api/import/staff', error: String(err), schoolId });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    resource: 'staff', methods: ['POST (CSV multipart or JSON)', 'DELETE (rollback)'],
    fields: { name: 'required <=120', role: 'required <=40', email: 'optional validated (dedupe key)', phone: 'optional', subject: 'optional', designation: 'optional', joined_at: 'optional YYYY-MM-DD' },
    duplicate_handling: 'by email within school; rows without email are not deduped',
    rollback: 'DELETE /api/import/staff with { import_batch_id }',
  });
}
