// app/api/import/staff/route.ts
// EdProSys — Staff Bulk Importer (Mission 2)
// Reference architecture: app/api/import/academic-years/route.ts
// DB: rqdnxdvuypekpmxbteju
//
// Verified live schema:
//   staff(id uuid pk, school_id uuid NOT NULL, institution_id uuid,
//     name text NOT NULL, role text NOT NULL, subject text, phone text, email text,
//     is_active bool, data_source text NOT NULL default 'live', department_id uuid,
//     designation text, joined_at date, relieved_at date, notes text, import_batch_id uuid)
//   No DB UNIQUE constraint -> dedupe on (school_id, lower(email)) when email present.
//   Tenant: school_id + institution_id from caller's school_users row, never payload.

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
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
  if (!ALLOWED_ROLES.includes(su.role)) return { error: `Role '${su.role}' is not permitted to import staff`, status: 403 }
  return { caller: { authUserId: user.id, institutionId: su.institution_id as string, schoolId: (su.school_id as string | null) ?? null, role: su.role as string } }
}

function adminClient() { return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } }) }

type RawRow = Record<string, unknown>
type ValidRow = { name: string; role: string; email: string | null; phone: string | null; subject: string | null; designation: string | null; joined_at: string | null }
type RowError = { row: number; name?: string; reason: string }

function str(v: unknown): string { return typeof v === 'string' ? v.trim() : '' }

function validateRow(raw: RawRow, index: number): { ok: true; value: ValidRow } | { ok: false; error: RowError } {
  const row = index + 1
  if (raw == null || typeof raw !== 'object') return { ok: false, error: { row, reason: 'Row is not an object' } }
  const name = str(raw.name)
  if (!name) return { ok: false, error: { row, reason: 'name is required' } }
  if (name.length > 120) return { ok: false, error: { row, name, reason: 'name exceeds 120 characters' } }
  const role = str(raw.role)
  if (!role) return { ok: false, error: { row, name, reason: 'role is required' } }
  if (role.length > 40) return { ok: false, error: { row, name, reason: 'role exceeds 40 characters' } }
  const emailRaw = str(raw.email)
  let email: string | null = null
  if (emailRaw) { if (!EMAIL_RE.test(emailRaw)) return { ok: false, error: { row, name, reason: 'email is not a valid address' } }; email = emailRaw.toLowerCase() }
  const phone = str(raw.phone) || null
  const subject = str(raw.subject) || null
  const designation = str(raw.designation) || null
  let joined_at: string | null = null
  const jr = str(raw.joined_at)
  if (jr) { if (!ISO_DATE.test(jr) || Number.isNaN(Date.parse(jr))) return { ok: false, error: { row, name, reason: 'joined_at must be YYYY-MM-DD' } }; joined_at = jr }
  return { ok: true, value: { name, role, email, phone, subject, designation, joined_at } }
}

export async function POST(req: NextRequest) {
  const resolved = await resolveCaller()
  if (resolved.error) return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  const caller = resolved.caller
  if (!caller.schoolId) return NextResponse.json({ error: 'Your account is not scoped to a school; staff import requires a school context.' }, { status: 400 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }
  const rows: RawRow[] = Array.isArray(body) ? body : Array.isArray(body?.rows) ? body.rows : []
  if (rows.length === 0) return NextResponse.json({ error: 'No rows provided. Send an array or { rows: [...] }' }, { status: 400 })
  if (rows.length > MAX_ROWS) return NextResponse.json({ error: `Too many rows in one import (max ${MAX_ROWS})` }, { status: 400 })
  const mode: 'skip' | 'error' = body?.mode === 'error' ? 'error' : 'skip'

  const valid: ValidRow[] = []
  const validationErrors: RowError[] = []
  rows.forEach((r, i) => { const v = validateRow(r, i); if (v.ok) valid.push(v.value); else validationErrors.push(v.error) })

  // within-batch dedupe on email (only meaningful uniqueness signal)
  const seenEmail = new Set<string>()
  const duplicatesInBatch: RowError[] = []
  const deduped: ValidRow[] = []
  valid.forEach((v, i) => {
    if (v.email && seenEmail.has(v.email)) duplicatesInBatch.push({ row: i + 1, name: v.name, reason: 'duplicate email within this import' })
    else { if (v.email) seenEmail.add(v.email); deduped.push(v) }
  })

  if (validationErrors.length && mode === 'error') {
    return NextResponse.json({ error: 'Validation failed', validation_errors: validationErrors, duplicates_in_batch: duplicatesInBatch }, { status: 422 })
  }

  const db = adminClient()
  // DB dedupe by email within school (rows without email cannot be reliably deduped)
  const emails = deduped.map((v) => v.email).filter((e): e is string => !!e)
  const existingSet = new Set<string>()
  if (emails.length) {
    const { data: existing, error: exErr } = await db.from('staff').select('email').eq('school_id', caller.schoolId).in('email', emails)
    if (exErr) return NextResponse.json({ error: 'Failed to check existing staff', detail: exErr.message }, { status: 500 })
    ;(existing ?? []).forEach((r: any) => { if (r.email) existingSet.add(String(r.email).toLowerCase()) })
  }
  const duplicatesInDb: string[] = []
  const toInsert = deduped.filter((v) => {
    if (v.email && existingSet.has(v.email)) { duplicatesInDb.push(v.email); return false }
    return true
  })
  if (duplicatesInDb.length && mode === 'error') {
    return NextResponse.json({ error: 'Duplicate staff (by email) already exist', duplicates_in_db: duplicatesInDb }, { status: 409 })
  }
  if (toInsert.length === 0) {
    return NextResponse.json({ import_batch_id: null, summary: { received: rows.length, inserted: 0, skipped_existing: duplicatesInDb.length, duplicates_in_batch: duplicatesInBatch.length, validation_failed: validationErrors.length }, duplicates_in_db: duplicatesInDb, duplicates_in_batch: duplicatesInBatch, validation_errors: validationErrors }, { status: 200 })
  }

  const importBatchId = randomUUID()
  const payload = toInsert.map((v) => ({
    school_id: caller.schoolId,
    institution_id: caller.institutionId,
    name: v.name,
    role: v.role,
    email: v.email,
    phone: v.phone,
    subject: v.subject,
    designation: v.designation,
    joined_at: v.joined_at,
    is_active: true,
    data_source: 'live',
    import_batch_id: importBatchId,
  }))
  const { data: inserted, error: insErr } = await db.from('staff').insert(payload).select('id, name')
  if (insErr) return NextResponse.json({ error: 'Insert failed', detail: insErr.message, import_batch_id: importBatchId }, { status: 500 })

  try {
    await db.from('audit_log').insert({ institution_id: caller.institutionId, school_id: caller.schoolId, user_id: caller.authUserId, action: 'import.staff', resource: 'staff', op: 'INSERT', metadata: { import_batch_id: importBatchId, inserted: inserted?.length ?? 0, mode } })
  } catch {}

  return NextResponse.json({
    import_batch_id: importBatchId,
    rollback: { method: 'DELETE', endpoint: '/api/import/staff', body: { import_batch_id: importBatchId } },
    summary: { received: rows.length, inserted: inserted?.length ?? 0, skipped_existing: duplicatesInDb.length, duplicates_in_batch: duplicatesInBatch.length, validation_failed: validationErrors.length },
    inserted: (inserted ?? []).map((r: any) => ({ id: r.id, name: r.name })),
    duplicates_in_db: duplicatesInDb, duplicates_in_batch: duplicatesInBatch, validation_errors: validationErrors,
  }, { status: 200 })
}

export async function DELETE(req: NextRequest) {
  const resolved = await resolveCaller()
  if (resolved.error) return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  const caller = resolved.caller
  let body: any = {}
  try { body = await req.json() } catch {}
  const importBatchId: string | null = (typeof body?.import_batch_id === 'string' ? body.import_batch_id : null) ?? req.nextUrl.searchParams.get('import_batch_id')
  if (!importBatchId) return NextResponse.json({ error: 'import_batch_id is required' }, { status: 400 })
  const db = adminClient()
  // scope to caller's school (staff has no institution_id guarantee; school_id is NOT NULL)
  let q = db.from('staff').delete().eq('import_batch_id', importBatchId)
  q = caller.schoolId ? q.eq('school_id', caller.schoolId) : q.eq('institution_id', caller.institutionId)
  const { data: deleted, error: delErr } = await q.select('id, name')
  if (delErr) return NextResponse.json({ error: 'Rollback failed', detail: delErr.message }, { status: 500 })
  try { await db.from('audit_log').insert({ institution_id: caller.institutionId, school_id: caller.schoolId, user_id: caller.authUserId, action: 'import.staff.rollback', resource: 'staff', op: 'DELETE', metadata: { import_batch_id: importBatchId, deleted: deleted?.length ?? 0 } }) } catch {}
  return NextResponse.json({ import_batch_id: importBatchId, rolled_back: deleted?.length ?? 0, deleted: deleted ?? [] }, { status: 200 })
}

export async function GET() {
  return NextResponse.json({
    resource: 'staff', method: 'POST', accepts: 'array of rows, or { rows: [...], mode: "skip" | "error" }',
    fields: { name: 'string, required, <=120', role: 'string, required, <=40 (e.g. teacher, clerk, librarian)', email: 'optional, validated; used for duplicate detection', phone: 'optional', subject: 'optional', designation: 'optional', joined_at: 'optional YYYY-MM-DD' },
    ignored_fields: ['id', 'school_id', 'institution_id', 'is_active', 'data_source', 'import_batch_id'],
    duplicate_handling: 'by email within school; rows without email are not deduped',
    rollback: 'DELETE /api/import/staff with { import_batch_id }',
    sample: { rows: [{ name: 'Sita Rao', role: 'teacher', email: 'sita@school.edu', subject: 'Mathematics', joined_at: '2024-06-01' }], mode: 'skip' },
  })
}
