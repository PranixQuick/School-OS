// app/api/import/academic-years/route.ts
// EdProSys — Academic Year Bulk Importer  (Mission 1)
// Reference: app/api/import/students/route.ts
// DB: rqdnxdvuypekpmxbteju (EdProSys / School OS, Sydney)
//
// Grounded in verified live schema:
//   academic_years(id uuid pk, institution_id uuid NOT NULL, label text NOT NULL,
//     start_date date NOT NULL, end_date date NOT NULL, is_current bool default false,
//     term_structure jsonb NOT NULL, status text default 'draft',
//     promoted_at timestamptz, promoted_by uuid, school_id uuid, import_batch_id uuid)
//   UNIQUE (institution_id, label)            -> duplicate key
//   school_users(auth_user_id, institution_id, school_id, role, is_active)  -> authz + tenant
//   audit_log(institution_id, school_id, user_id, action, resource, op, metadata, ...)

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

const DEFAULT_TERM_STRUCTURE = [
  { name: 'Term 1', assessments: ['FA1', 'FA2', 'SA1'] },
  { name: 'Term 2', assessments: ['FA3', 'FA4', 'SA2'] },
]

const MAX_ROWS = 200
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

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
    .from('school_users')
    .select('institution_id, school_id, role, is_active')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (suError) return { error: 'Failed to resolve user membership', status: 500 }
  if (!su) return { error: 'No institution membership for this user', status: 403 }
  if (su.is_active === false) return { error: 'User is inactive', status: 403 }
  if (!su.institution_id) return { error: 'User has no institution_id', status: 403 }
  if (!ALLOWED_ROLES.includes(su.role)) {
    return { error: `Role '${su.role}' is not permitted to import academic years`, status: 403 }
  }

  return {
    caller: {
      authUserId: user.id,
      institutionId: su.institution_id as string,
      schoolId: (su.school_id as string | null) ?? null,
      role: su.role as string,
    },
  }
}

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}

type RawRow = Record<string, unknown>
type ValidRow = { label: string; start_date: string; end_date: string; is_current: boolean; term_structure: unknown }
type RowError = { row: number; label?: string; reason: string }

function validateRow(raw: RawRow, index: number): { ok: true; value: ValidRow } | { ok: false; error: RowError } {
  const row = index + 1
  if (raw == null || typeof raw !== 'object') return { ok: false, error: { row, reason: 'Row is not an object' } }

  const label = typeof raw.label === 'string' ? raw.label.trim() : ''
  if (!label) return { ok: false, error: { row, reason: 'label is required' } }
  if (label.length > 60) return { ok: false, error: { row, label, reason: 'label exceeds 60 characters' } }

  const start_date = typeof raw.start_date === 'string' ? raw.start_date.trim() : ''
  const end_date = typeof raw.end_date === 'string' ? raw.end_date.trim() : ''
  if (!ISO_DATE.test(start_date)) return { ok: false, error: { row, label, reason: 'start_date must be YYYY-MM-DD' } }
  if (!ISO_DATE.test(end_date)) return { ok: false, error: { row, label, reason: 'end_date must be YYYY-MM-DD' } }

  const s = Date.parse(start_date)
  const e = Date.parse(end_date)
  if (Number.isNaN(s) || Number.isNaN(e)) return { ok: false, error: { row, label, reason: 'invalid date value' } }
  if (e <= s) return { ok: false, error: { row, label, reason: 'end_date must be after start_date' } }

  let is_current = false
  if (typeof raw.is_current === 'boolean') is_current = raw.is_current
  else if (typeof raw.is_current === 'string') is_current = ['true', '1', 'yes', 'y'].includes(raw.is_current.toLowerCase())

  let term_structure: unknown = raw.term_structure
  if (term_structure == null) term_structure = DEFAULT_TERM_STRUCTURE
  else if (typeof term_structure === 'string') {
    try { term_structure = JSON.parse(term_structure) }
    catch { return { ok: false, error: { row, label, reason: 'term_structure is not valid JSON' } } }
  }
  if (typeof term_structure !== 'object') return { ok: false, error: { row, label, reason: 'term_structure must be an object or array' } }

  return { ok: true, value: { label, start_date, end_date, is_current, term_structure } }
}

export async function POST(req: NextRequest) {
  const resolved = await resolveCaller()
  if (resolved.error) return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  const caller = resolved.caller

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const rows: RawRow[] = Array.isArray(body) ? body : Array.isArray(body?.rows) ? body.rows : []
  if (rows.length === 0) return NextResponse.json({ error: 'No rows provided. Send an array or { rows: [...] }' }, { status: 400 })
  if (rows.length > MAX_ROWS) return NextResponse.json({ error: `Too many rows in one import (max ${MAX_ROWS})` }, { status: 400 })

  const mode: 'skip' | 'error' = body?.mode === 'error' ? 'error' : 'skip'

  const valid: ValidRow[] = []
  const validationErrors: RowError[] = []
  rows.forEach((r, i) => { const v = validateRow(r, i); if (v.ok) valid.push(v.value); else validationErrors.push(v.error) })

  const seen = new Set<string>()
  const duplicatesInBatch: RowError[] = []
  const deduped: ValidRow[] = []
  valid.forEach((v, i) => {
    const key = v.label.toLowerCase()
    if (seen.has(key)) duplicatesInBatch.push({ row: i + 1, label: v.label, reason: 'duplicate label within this import' })
    else { seen.add(key); deduped.push(v) }
  })

  const currentRows = deduped.filter((v) => v.is_current)
  if (currentRows.length > 1) {
    return NextResponse.json({ error: 'Only one row may set is_current = true per import', is_current_rows: currentRows.map((v) => v.label) }, { status: 400 })
  }

  if (validationErrors.length && mode === 'error') {
    return NextResponse.json({ error: 'Validation failed', validation_errors: validationErrors, duplicates_in_batch: duplicatesInBatch }, { status: 422 })
  }

  const db = adminClient()

  const labels = deduped.map((v) => v.label)
  const { data: existing, error: exErr } = await db
    .from('academic_years').select('label').eq('institution_id', caller.institutionId).in('label', labels)
  if (exErr) return NextResponse.json({ error: 'Failed to check existing academic years', detail: exErr.message }, { status: 500 })

  const existingSet = new Set((existing ?? []).map((r: any) => String(r.label).toLowerCase()))
  const duplicatesInDb: string[] = []
  const toInsert = deduped.filter((v) => {
    if (existingSet.has(v.label.toLowerCase())) { duplicatesInDb.push(v.label); return false }
    return true
  })

  if (duplicatesInDb.length && mode === 'error') {
    return NextResponse.json({ error: 'Duplicate academic years already exist', duplicates_in_db: duplicatesInDb }, { status: 409 })
  }

  if (toInsert.length === 0) {
    return NextResponse.json({
      import_batch_id: null,
      summary: { received: rows.length, inserted: 0, skipped_existing: duplicatesInDb.length, duplicates_in_batch: duplicatesInBatch.length, validation_failed: validationErrors.length },
      duplicates_in_db: duplicatesInDb, duplicates_in_batch: duplicatesInBatch, validation_errors: validationErrors,
    }, { status: 200 })
  }

  const importBatchId = randomUUID()
  const payload = toInsert.map((v) => ({
    institution_id: caller.institutionId,
    school_id: caller.schoolId,
    label: v.label,
    start_date: v.start_date,
    end_date: v.end_date,
    is_current: false,
    term_structure: v.term_structure,
    status: 'draft',
    import_batch_id: importBatchId,
  }))

  const { data: inserted, error: insErr } = await db.from('academic_years').insert(payload).select('id, label')
  if (insErr) return NextResponse.json({ error: 'Insert failed', detail: insErr.message, import_batch_id: importBatchId }, { status: 500 })

  let currentSetFor: string | null = null
  const wantsCurrent = toInsert.find((v) => v.is_current)
  if (wantsCurrent && inserted) {
    const target = inserted.find((r: any) => r.label === wantsCurrent.label)
    if (target) {
      await db.from('academic_years').update({ is_current: false }).eq('institution_id', caller.institutionId).eq('is_current', true)
      await db.from('academic_years').update({ is_current: true, status: 'active', promoted_at: new Date().toISOString(), promoted_by: caller.authUserId }).eq('id', (target as any).id)
      currentSetFor = wantsCurrent.label
    }
  }

  try {
    await db.from('audit_log').insert({
      institution_id: caller.institutionId, school_id: caller.schoolId, user_id: caller.authUserId,
      action: 'import.academic_years', resource: 'academic_years', op: 'INSERT',
      metadata: { import_batch_id: importBatchId, inserted: inserted?.length ?? 0, mode, current_set_for: currentSetFor },
    })
  } catch {}

  return NextResponse.json({
    import_batch_id: importBatchId,
    rollback: { method: 'DELETE', endpoint: '/api/import/academic-years', body: { import_batch_id: importBatchId } },
    summary: { received: rows.length, inserted: inserted?.length ?? 0, current_set_for: currentSetFor, skipped_existing: duplicatesInDb.length, duplicates_in_batch: duplicatesInBatch.length, validation_failed: validationErrors.length },
    inserted: (inserted ?? []).map((r: any) => ({ id: r.id, label: r.label })),
    duplicates_in_db: duplicatesInDb, duplicates_in_batch: duplicatesInBatch, validation_errors: validationErrors,
  }, { status: 200 })
}

export async function DELETE(req: NextRequest) {
  const resolved = await resolveCaller()
  if (resolved.error) return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  const caller = resolved.caller

  let body: any = {}
  try { body = await req.json() } catch {}
  const importBatchId: string | null =
    (typeof body?.import_batch_id === 'string' ? body.import_batch_id : null) ?? req.nextUrl.searchParams.get('import_batch_id')
  if (!importBatchId) return NextResponse.json({ error: 'import_batch_id is required' }, { status: 400 })

  const db = adminClient()
  const { data: deleted, error: delErr } = await db
    .from('academic_years').delete().eq('import_batch_id', importBatchId).eq('institution_id', caller.institutionId).select('id, label')
  if (delErr) return NextResponse.json({ error: 'Rollback failed', detail: delErr.message }, { status: 500 })

  try {
    await db.from('audit_log').insert({
      institution_id: caller.institutionId, school_id: caller.schoolId, user_id: caller.authUserId,
      action: 'import.academic_years.rollback', resource: 'academic_years', op: 'DELETE',
      metadata: { import_batch_id: importBatchId, deleted: deleted?.length ?? 0 },
    })
  } catch {}

  return NextResponse.json({ import_batch_id: importBatchId, rolled_back: deleted?.length ?? 0, deleted: deleted ?? [] }, { status: 200 })
}

export async function GET() {
  return NextResponse.json({
    resource: 'academic_years', method: 'POST',
    accepts: 'array of rows, or { rows: [...], mode: "skip" | "error" }',
    fields: {
      label: 'string, required, unique per institution, <=60 chars',
      start_date: 'YYYY-MM-DD, required',
      end_date: 'YYYY-MM-DD, required, must be after start_date',
      is_current: 'boolean, optional (max one per import); promotes that year to active',
      term_structure: 'JSON object/array, optional; defaults to FA/SA two-term structure',
    },
    ignored_fields: ['id', 'institution_id', 'school_id', 'status', 'import_batch_id', 'promoted_at', 'promoted_by'],
    rollback: 'DELETE /api/import/academic-years with { import_batch_id }',
    sample: { rows: [{ label: '2025-26', start_date: '2025-06-01', end_date: '2026-04-30', is_current: true }, { label: '2026-27', start_date: '2026-06-01', end_date: '2027-04-30' }], mode: 'skip' },
  })
}
