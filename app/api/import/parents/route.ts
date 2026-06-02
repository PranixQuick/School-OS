// app/api/import/parents/route.ts
// EdProSys — Parent Bulk Importer (Mission 4)
// Reference architecture: app/api/import/academic-years/route.ts
// DB: rqdnxdvuypekpmxbteju
//
// Verified live schema:
//   parents(id uuid pk, school_id uuid NOT NULL, student_id uuid NOT NULL,
//     name text NOT NULL, phone text NOT NULL, email text, language_pref text default 'en',
//     data_source text NOT NULL default 'live', is_active bool NOT NULL default true,
//     import_batch_id uuid)
//   UNIQUE (school_id, phone) -> duplicate key
//   students UNIQUE (admission_number) -> lookup key
//
// Parent linking: each row carries an admission_number; the student is resolved
// within the caller's school (tenant guard), and parent.student_id/school_id are
// taken from the resolved student row, never from the payload.

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const ALLOWED_ROLES: string[] = ['owner', 'admin', 'principal']
const MAX_ROWS = 500
const ALLOWED_LANGS = ['en', 'te']

type Caller = { authUserId: string; institutionId: string; schoolId: string | null; role: string }

async function resolveCaller(): Promise<
  { caller: Caller; error?: undefined; status?: undefined } | { caller?: undefined; error: string; status: number }
> {
  const cookieStore = await cookies()
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: { getAll() { return cookieStore.getAll() }, setAll() {} },
  })
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Not authenticated', status: 401 }
  const { data: su, error: suError } = await supabase
    .from('school_users').select('institution_id, school_id, role, is_active').eq('auth_user_id', user.id).maybeSingle()
  if (suError) return { error: 'Failed to resolve user membership', status: 500 }
  if (!su) return { error: 'No institution membership for this user', status: 403 }
  if (su.is_active === false) return { error: 'User is inactive', status: 403 }
  if (!su.institution_id) return { error: 'User has no institution_id', status: 403 }
  if (!ALLOWED_ROLES.includes(su.role)) return { error: `Role '${su.role}' is not permitted to import parents`, status: 403 }
  return { caller: { authUserId: user.id, institutionId: su.institution_id as string, schoolId: (su.school_id as string | null) ?? null, role: su.role as string } }
}

function adminClient() { return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } }) }

type RawRow = Record<string, unknown>
type ValidRow = { admission_number: string; name: string; phone: string; email: string | null; language_pref: string }
type RowError = { row: number; admission_number?: string; reason: string }

function str(v: unknown): string { return typeof v === 'string' ? v.trim() : (typeof v === 'number' ? String(v) : '') }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[0-9+][0-9\s-]{6,19}$/

function validateRow(raw: RawRow, index: number): { ok: true; value: ValidRow } | { ok: false; error: RowError } {
  const row = index + 1
  if (raw == null || typeof raw !== 'object') return { ok: false, error: { row, reason: 'Row is not an object' } }
  const admission_number = str(raw.admission_number)
  if (!admission_number) return { ok: false, error: { row, reason: 'admission_number is required' } }
  const name = str(raw.name)
  if (!name) return { ok: false, error: { row, admission_number, reason: 'name is required' } }
  if (name.length > 120) return { ok: false, error: { row, admission_number, reason: 'name exceeds 120 characters' } }
  const phone = str(raw.phone)
  if (!phone) return { ok: false, error: { row, admission_number, reason: 'phone is required' } }
  if (!PHONE_RE.test(phone)) return { ok: false, error: { row, admission_number, reason: 'phone is not a valid number' } }
  const emailRaw = str(raw.email)
  let email: string | null = null
  if (emailRaw) { if (!EMAIL_RE.test(emailRaw)) return { ok: false, error: { row, admission_number, reason: 'email is not a valid address' } }; email = emailRaw.toLowerCase() }
  let language_pref = str(raw.language_pref).toLowerCase() || 'en'
  if (!ALLOWED_LANGS.includes(language_pref)) language_pref = 'en'
  return { ok: true, value: { admission_number, name, phone, email, language_pref } }
}

export async function POST(req: NextRequest) {
  const resolved = await resolveCaller()
  if (resolved.error) return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  const caller = resolved.caller
  if (!caller.schoolId) return NextResponse.json({ error: 'Your account is not scoped to a school; parent import requires a school context.' }, { status: 400 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }
  const rows: RawRow[] = Array.isArray(body) ? body : Array.isArray(body?.rows) ? body.rows : []
  if (rows.length === 0) return NextResponse.json({ error: 'No rows provided. Send an array or { rows: [...] }' }, { status: 400 })
  if (rows.length > MAX_ROWS) return NextResponse.json({ error: `Too many rows in one import (max ${MAX_ROWS})` }, { status: 400 })
  const mode: 'skip' | 'error' = body?.mode === 'error' ? 'error' : 'skip'

  const valid: ValidRow[] = []
  const validationErrors: RowError[] = []
  rows.forEach((r, i) => { const v = validateRow(r, i); if (v.ok) valid.push(v.value); else validationErrors.push(v.error) })

  // within-batch dedupe on phone (UNIQUE school_id, phone)
  const seenPhone = new Set<string>()
  const duplicatesInBatch: RowError[] = []
  const deduped: ValidRow[] = []
  valid.forEach((v, i) => {
    if (seenPhone.has(v.phone)) duplicatesInBatch.push({ row: i + 1, admission_number: v.admission_number, reason: 'duplicate phone within this import' })
    else { seenPhone.add(v.phone); deduped.push(v) }
  })

  if (validationErrors.length && mode === 'error') {
    return NextResponse.json({ error: 'Validation failed', validation_errors: validationErrors, duplicates_in_batch: duplicatesInBatch }, { status: 422 })
  }

  const db = adminClient()

  // 1. Resolve students by admission_number WITHIN the caller's school (tenant guard)
  const admissionNumbers = Array.from(new Set(deduped.map((v) => v.admission_number)))
  const { data: students, error: stuErr } = await db
    .from('students').select('id, admission_number, school_id').eq('school_id', caller.schoolId).in('admission_number', admissionNumbers)
  if (stuErr) return NextResponse.json({ error: 'Failed to resolve students', detail: stuErr.message }, { status: 500 })
  const studentByAdm = new Map<string, { id: string; school_id: string }>()
  ;(students ?? []).forEach((s: any) => studentByAdm.set(String(s.admission_number), { id: s.id, school_id: s.school_id }))

  const unmatched: RowError[] = []
  const linkable = deduped.filter((v, i) => {
    if (!studentByAdm.has(v.admission_number)) { unmatched.push({ row: i + 1, admission_number: v.admission_number, reason: 'no student with this admission_number in your school' }); return false }
    return true
  })
  if (unmatched.length && mode === 'error') {
    return NextResponse.json({ error: 'Unmatched students', unmatched }, { status: 422 })
  }

  // 2. DB dedupe on (school_id, phone)
  const phones = linkable.map((v) => v.phone)
  const existingSet = new Set<string>()
  if (phones.length) {
    const { data: existing, error: exErr } = await db.from('parents').select('phone').eq('school_id', caller.schoolId).in('phone', phones)
    if (exErr) return NextResponse.json({ error: 'Failed to check existing parents', detail: exErr.message }, { status: 500 })
    ;(existing ?? []).forEach((r: any) => existingSet.add(String(r.phone)))
  }
  const duplicatesInDb: string[] = []
  const toInsert = linkable.filter((v) => { if (existingSet.has(v.phone)) { duplicatesInDb.push(v.phone); return false } return true })
  if (duplicatesInDb.length && mode === 'error') {
    return NextResponse.json({ error: 'Duplicate parent phones already exist', duplicates_in_db: duplicatesInDb }, { status: 409 })
  }

  if (toInsert.length === 0) {
    return NextResponse.json({ import_batch_id: null, summary: { received: rows.length, inserted: 0, unmatched_students: unmatched.length, skipped_existing: duplicatesInDb.length, duplicates_in_batch: duplicatesInBatch.length, validation_failed: validationErrors.length }, unmatched, duplicates_in_db: duplicatesInDb, duplicates_in_batch: duplicatesInBatch, validation_errors: validationErrors }, { status: 200 })
  }

  const importBatchId = randomUUID()
  const payload = toInsert.map((v) => {
    const stu = studentByAdm.get(v.admission_number)!
    return { school_id: stu.school_id, student_id: stu.id, name: v.name, phone: v.phone, email: v.email, language_pref: v.language_pref, is_active: true, data_source: 'live', import_batch_id: importBatchId }
  })
  const { data: inserted, error: insErr } = await db.from('parents').insert(payload).select('id, name, student_id')
  if (insErr) return NextResponse.json({ error: 'Insert failed', detail: insErr.message, import_batch_id: importBatchId }, { status: 500 })

  try { await db.from('audit_log').insert({ institution_id: caller.institutionId, school_id: caller.schoolId, user_id: caller.authUserId, action: 'import.parents', resource: 'parents', op: 'INSERT', metadata: { import_batch_id: importBatchId, inserted: inserted?.length ?? 0, unmatched: unmatched.length, mode } }) } catch {}

  return NextResponse.json({
    import_batch_id: importBatchId,
    rollback: { method: 'DELETE', endpoint: '/api/import/parents', body: { import_batch_id: importBatchId } },
    summary: { received: rows.length, inserted: inserted?.length ?? 0, unmatched_students: unmatched.length, skipped_existing: duplicatesInDb.length, duplicates_in_batch: duplicatesInBatch.length, validation_failed: validationErrors.length },
    inserted: (inserted ?? []).map((r: any) => ({ id: r.id, name: r.name, student_id: r.student_id })),
    unmatched, duplicates_in_db: duplicatesInDb, duplicates_in_batch: duplicatesInBatch, validation_errors: validationErrors,
  }, { status: 200 })
}

export async function DELETE(req: NextRequest) {
  const resolved = await resolveCaller()
  if (resolved.error) return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  const caller = resolved.caller
  if (!caller.schoolId) return NextResponse.json({ error: 'School context required for rollback.' }, { status: 400 })
  let body: any = {}
  try { body = await req.json() } catch {}
  const importBatchId: string | null = (typeof body?.import_batch_id === 'string' ? body.import_batch_id : null) ?? req.nextUrl.searchParams.get('import_batch_id')
  if (!importBatchId) return NextResponse.json({ error: 'import_batch_id is required' }, { status: 400 })
  const db = adminClient()
  const { data: deleted, error: delErr } = await db.from('parents').delete().eq('import_batch_id', importBatchId).eq('school_id', caller.schoolId).select('id, name')
  if (delErr) return NextResponse.json({ error: 'Rollback failed', detail: delErr.message }, { status: 500 })
  try { await db.from('audit_log').insert({ institution_id: caller.institutionId, school_id: caller.schoolId, user_id: caller.authUserId, action: 'import.parents.rollback', resource: 'parents', op: 'DELETE', metadata: { import_batch_id: importBatchId, deleted: deleted?.length ?? 0 } }) } catch {}
  return NextResponse.json({ import_batch_id: importBatchId, rolled_back: deleted?.length ?? 0, deleted: deleted ?? [] }, { status: 200 })
}

export async function GET() {
  return NextResponse.json({
    resource: 'parents', method: 'POST', accepts: 'array of rows, or { rows: [...], mode: "skip" | "error" }',
    fields: { admission_number: 'string, required — links parent to an existing student in your school', name: 'string, required, <=120', phone: 'string, required, unique per school', email: 'optional, validated', language_pref: 'optional: en | te (default en)' },
    ignored_fields: ['id', 'school_id', 'student_id', 'is_active', 'data_source', 'import_batch_id'],
    duplicate_handling: 'by phone within school (UNIQUE school_id, phone); unmatched admission_numbers are reported',
    rollback: 'DELETE /api/import/parents with { import_batch_id }',
    sample: { rows: [{ admission_number: 'ADM2025001', name: 'Lakshmi Devi', phone: '9876543210', language_pref: 'te' }], mode: 'skip' },
  })
}
