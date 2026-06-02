// app/api/import/fees/route.ts
// EdProSys — Fees Bulk Importer (Mission 5)
// Reference architecture: app/api/import/academic-years/route.ts
// DB: rqdnxdvuypekpmxbteju
//
// Verified live schema:
//   fees(id uuid pk, school_id uuid NOT NULL, student_id uuid NOT NULL,
//     amount numeric NOT NULL, due_date date NOT NULL, paid_date date,
//     status text default 'pending', fee_type text default 'tuition', description text,
//     data_source text NOT NULL default 'live', discount_amount numeric default 0,
//     refund_status text default 'none', import_batch_id uuid)
//   No DB UNIQUE constraint -> logical dedupe on (student_id, fee_type, due_date, amount)
//   students UNIQUE (admission_number) -> lookup key
//
// Student lookup: each row carries an admission_number; the student is resolved
// within the caller's school (tenant guard); fees.student_id/school_id come from
// the resolved student, never the payload.

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

// Fees are an accounting operation -> accountant included alongside admins.
const ALLOWED_ROLES: string[] = ['owner', 'admin', 'principal', 'accountant']
const MAX_ROWS = 1000
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const ALLOWED_FEE_TYPES = ['tuition', 'transport', 'hostel', 'exam', 'library', 'lab', 'admission', 'uniform', 'books', 'misc', 'other']

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
  if (!ALLOWED_ROLES.includes(su.role)) return { error: `Role '${su.role}' is not permitted to import fees`, status: 403 }
  return { caller: { authUserId: user.id, institutionId: su.institution_id as string, schoolId: (su.school_id as string | null) ?? null, role: su.role as string } }
}

function adminClient() { return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } }) }

type RawRow = Record<string, unknown>
type ValidRow = { admission_number: string; amount: number; due_date: string; fee_type: string; description: string | null }
type RowError = { row: number; admission_number?: string; reason: string }

function str(v: unknown): string { return typeof v === 'string' ? v.trim() : (typeof v === 'number' ? String(v) : '') }

function validateRow(raw: RawRow, index: number): { ok: true; value: ValidRow } | { ok: false; error: RowError } {
  const row = index + 1
  if (raw == null || typeof raw !== 'object') return { ok: false, error: { row, reason: 'Row is not an object' } }
  const admission_number = str(raw.admission_number)
  if (!admission_number) return { ok: false, error: { row, reason: 'admission_number is required' } }

  const amountRaw = typeof raw.amount === 'number' ? raw.amount : Number(str(raw.amount))
  if (!Number.isFinite(amountRaw)) return { ok: false, error: { row, admission_number, reason: 'amount must be a number' } }
  if (amountRaw <= 0) return { ok: false, error: { row, admission_number, reason: 'amount must be greater than 0' } }
  const amount = Math.round(amountRaw * 100) / 100

  const due_date = str(raw.due_date)
  if (!ISO_DATE.test(due_date) || Number.isNaN(Date.parse(due_date))) return { ok: false, error: { row, admission_number, reason: 'due_date must be a valid YYYY-MM-DD' } }

  let fee_type = (str(raw.fee_type) || 'tuition').toLowerCase()
  if (!ALLOWED_FEE_TYPES.includes(fee_type)) return { ok: false, error: { row, admission_number, reason: `fee_type must be one of: ${ALLOWED_FEE_TYPES.join(', ')}` } }

  const description = str(raw.description) || null
  return { ok: true, value: { admission_number, amount, due_date, fee_type, description } }
}

function logicalKey(studentId: string, v: { fee_type: string; due_date: string; amount: number }): string {
  return `${studentId}|${v.fee_type}|${v.due_date}|${v.amount}`
}

export async function POST(req: NextRequest) {
  const resolved = await resolveCaller()
  if (resolved.error) return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  const caller = resolved.caller
  if (!caller.schoolId) return NextResponse.json({ error: 'Your account is not scoped to a school; fees import requires a school context.' }, { status: 400 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }
  const rows: RawRow[] = Array.isArray(body) ? body : Array.isArray(body?.rows) ? body.rows : []
  if (rows.length === 0) return NextResponse.json({ error: 'No rows provided. Send an array or { rows: [...] }' }, { status: 400 })
  if (rows.length > MAX_ROWS) return NextResponse.json({ error: `Too many rows in one import (max ${MAX_ROWS})` }, { status: 400 })
  const mode: 'skip' | 'error' = body?.mode === 'error' ? 'error' : 'skip'

  const valid: ValidRow[] = []
  const validationErrors: RowError[] = []
  rows.forEach((r, i) => { const v = validateRow(r, i); if (v.ok) valid.push(v.value); else validationErrors.push(v.error) })
  if (validationErrors.length && mode === 'error') {
    return NextResponse.json({ error: 'Validation failed', validation_errors: validationErrors }, { status: 422 })
  }

  const db = adminClient()

  // 1. Resolve students by admission_number WITHIN the caller's school (tenant guard)
  const admissionNumbers = Array.from(new Set(valid.map((v) => v.admission_number)))
  const { data: students, error: stuErr } = await db
    .from('students').select('id, admission_number, school_id').eq('school_id', caller.schoolId).in('admission_number', admissionNumbers)
  if (stuErr) return NextResponse.json({ error: 'Failed to resolve students', detail: stuErr.message }, { status: 500 })
  const studentByAdm = new Map<string, { id: string; school_id: string }>()
  ;(students ?? []).forEach((s: any) => studentByAdm.set(String(s.admission_number), { id: s.id, school_id: s.school_id }))

  const unmatched: RowError[] = []
  const linkable = valid.filter((v, i) => {
    if (!studentByAdm.has(v.admission_number)) { unmatched.push({ row: i + 1, admission_number: v.admission_number, reason: 'no student with this admission_number in your school' }); return false }
    return true
  })
  if (unmatched.length && mode === 'error') {
    return NextResponse.json({ error: 'Unmatched students', unmatched }, { status: 422 })
  }

  // 2. within-batch dedupe on logical key
  const seen = new Set<string>()
  const duplicatesInBatch: RowError[] = []
  const deduped = linkable.filter((v, i) => {
    const key = logicalKey(studentByAdm.get(v.admission_number)!.id, v)
    if (seen.has(key)) { duplicatesInBatch.push({ row: i + 1, admission_number: v.admission_number, reason: 'duplicate fee (same student/type/due_date/amount) within this import' }); return false }
    seen.add(key); return true
  })

  // 3. DB dedupe: pull existing fees for the resolved students + due_dates, compare logical key
  const studentIds = Array.from(new Set(deduped.map((v) => studentByAdm.get(v.admission_number)!.id)))
  const dueDates = Array.from(new Set(deduped.map((v) => v.due_date)))
  const existingKeys = new Set<string>()
  if (studentIds.length && dueDates.length) {
    const { data: existing, error: exErr } = await db
      .from('fees').select('student_id, fee_type, due_date, amount').in('student_id', studentIds).in('due_date', dueDates)
    if (exErr) return NextResponse.json({ error: 'Failed to check existing fees', detail: exErr.message }, { status: 500 })
    ;(existing ?? []).forEach((r: any) => {
      const amt = Math.round(Number(r.amount) * 100) / 100
      existingKeys.add(`${r.student_id}|${String(r.fee_type ?? 'tuition').toLowerCase()}|${r.due_date}|${amt}`)
    })
  }
  const duplicatesInDb: RowError[] = []
  const toInsert = deduped.filter((v, i) => {
    const key = logicalKey(studentByAdm.get(v.admission_number)!.id, v)
    if (existingKeys.has(key)) { duplicatesInDb.push({ row: i + 1, admission_number: v.admission_number, reason: 'identical fee already exists' }); return false }
    return true
  })
  if (duplicatesInDb.length && mode === 'error') {
    return NextResponse.json({ error: 'Duplicate fees already exist', duplicates_in_db: duplicatesInDb }, { status: 409 })
  }

  if (toInsert.length === 0) {
    return NextResponse.json({ import_batch_id: null, summary: { received: rows.length, inserted: 0, unmatched_students: unmatched.length, skipped_existing: duplicatesInDb.length, duplicates_in_batch: duplicatesInBatch.length, validation_failed: validationErrors.length }, unmatched, duplicates_in_db: duplicatesInDb, duplicates_in_batch: duplicatesInBatch, validation_errors: validationErrors }, { status: 200 })
  }

  const importBatchId = randomUUID()
  const payload = toInsert.map((v) => {
    const stu = studentByAdm.get(v.admission_number)!
    return { school_id: stu.school_id, student_id: stu.id, amount: v.amount, due_date: v.due_date, fee_type: v.fee_type, description: v.description, status: 'pending', data_source: 'live', import_batch_id: importBatchId }
  })
  const { data: inserted, error: insErr } = await db.from('fees').insert(payload).select('id, student_id, amount, due_date, fee_type')
  if (insErr) return NextResponse.json({ error: 'Insert failed', detail: insErr.message, import_batch_id: importBatchId }, { status: 500 })

  try { await db.from('audit_log').insert({ institution_id: caller.institutionId, school_id: caller.schoolId, user_id: caller.authUserId, action: 'import.fees', resource: 'fees', op: 'INSERT', metadata: { import_batch_id: importBatchId, inserted: inserted?.length ?? 0, unmatched: unmatched.length, mode } }) } catch {}

  return NextResponse.json({
    import_batch_id: importBatchId,
    rollback: { method: 'DELETE', endpoint: '/api/import/fees', body: { import_batch_id: importBatchId } },
    summary: { received: rows.length, inserted: inserted?.length ?? 0, unmatched_students: unmatched.length, skipped_existing: duplicatesInDb.length, duplicates_in_batch: duplicatesInBatch.length, validation_failed: validationErrors.length },
    inserted: (inserted ?? []).map((r: any) => ({ id: r.id, student_id: r.student_id, amount: r.amount, due_date: r.due_date, fee_type: r.fee_type })),
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
  const { data: deleted, error: delErr } = await db.from('fees').delete().eq('import_batch_id', importBatchId).eq('school_id', caller.schoolId).select('id')
  if (delErr) return NextResponse.json({ error: 'Rollback failed', detail: delErr.message }, { status: 500 })
  try { await db.from('audit_log').insert({ institution_id: caller.institutionId, school_id: caller.schoolId, user_id: caller.authUserId, action: 'import.fees.rollback', resource: 'fees', op: 'DELETE', metadata: { import_batch_id: importBatchId, deleted: deleted?.length ?? 0 } }) } catch {}
  return NextResponse.json({ import_batch_id: importBatchId, rolled_back: deleted?.length ?? 0 }, { status: 200 })
}

export async function GET() {
  return NextResponse.json({
    resource: 'fees', method: 'POST', accepts: 'array of rows, or { rows: [...], mode: "skip" | "error" }',
    fields: { admission_number: 'string, required — links fee to an existing student in your school', amount: 'number, required, > 0', due_date: 'YYYY-MM-DD, required', fee_type: `optional, one of: ${ALLOWED_FEE_TYPES.join(', ')} (default tuition)`, description: 'optional' },
    ignored_fields: ['id', 'school_id', 'student_id', 'status', 'paid_date', 'data_source', 'import_batch_id'],
    duplicate_handling: 'logical key (student + fee_type + due_date + amount); unmatched admission_numbers reported',
    rollback: 'DELETE /api/import/fees with { import_batch_id }',
    sample: { rows: [{ admission_number: 'ADM2025001', amount: 12000, due_date: '2025-07-15', fee_type: 'tuition', description: 'Term 1 tuition' }], mode: 'skip' },
  })
}
