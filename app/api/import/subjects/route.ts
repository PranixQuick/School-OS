// app/api/import/subjects/route.ts
// EdProSys — Subject Bulk Importer (Mission 3)
// Reference architecture: app/api/import/academic-years/route.ts
// DB: rqdnxdvuypekpmxbteju
//
// Verified live schema:
//   subjects(id uuid pk, school_id uuid NOT NULL, institution_id uuid,
//     code text NOT NULL, name text NOT NULL, board_alignment text,
//     created_at timestamptz, import_batch_id uuid)
//   UNIQUE (school_id, code) -> duplicate key
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
  if (!ALLOWED_ROLES.includes(su.role)) return { error: `Role '${su.role}' is not permitted to import subjects`, status: 403 }
  return { caller: { authUserId: user.id, institutionId: su.institution_id as string, schoolId: (su.school_id as string | null) ?? null, role: su.role as string } }
}

function adminClient() { return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } }) }

type RawRow = Record<string, unknown>
type ValidRow = { code: string; name: string; board_alignment: string | null }
type RowError = { row: number; code?: string; reason: string }

function str(v: unknown): string { return typeof v === 'string' ? v.trim() : '' }

function validateRow(raw: RawRow, index: number): { ok: true; value: ValidRow } | { ok: false; error: RowError } {
  const row = index + 1
  if (raw == null || typeof raw !== 'object') return { ok: false, error: { row, reason: 'Row is not an object' } }
  const code = str(raw.code)
  if (!code) return { ok: false, error: { row, reason: 'code is required' } }
  if (code.length > 30) return { ok: false, error: { row, code, reason: 'code exceeds 30 characters' } }
  const name = str(raw.name)
  if (!name) return { ok: false, error: { row, code, reason: 'name is required' } }
  if (name.length > 120) return { ok: false, error: { row, code, reason: 'name exceeds 120 characters' } }
  const board_alignment = str(raw.board_alignment) || null
  return { ok: true, value: { code, name, board_alignment } }
}

export async function POST(req: NextRequest) {
  const resolved = await resolveCaller()
  if (resolved.error) return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  const caller = resolved.caller
  if (!caller.schoolId) return NextResponse.json({ error: 'Your account is not scoped to a school; subject import requires a school context.' }, { status: 400 })

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
    const key = v.code.toLowerCase()
    if (seen.has(key)) duplicatesInBatch.push({ row: i + 1, code: v.code, reason: 'duplicate code within this import' })
    else { seen.add(key); deduped.push(v) }
  })

  if (validationErrors.length && mode === 'error') {
    return NextResponse.json({ error: 'Validation failed', validation_errors: validationErrors, duplicates_in_batch: duplicatesInBatch }, { status: 422 })
  }

  const db = adminClient()
  const codes = deduped.map((v) => v.code)
  const { data: existing, error: exErr } = await db.from('subjects').select('code').eq('school_id', caller.schoolId).in('code', codes)
  if (exErr) return NextResponse.json({ error: 'Failed to check existing subjects', detail: exErr.message }, { status: 500 })
  const existingSet = new Set((existing ?? []).map((r: any) => String(r.code).toLowerCase()))
  const duplicatesInDb: string[] = []
  const toInsert = deduped.filter((v) => { if (existingSet.has(v.code.toLowerCase())) { duplicatesInDb.push(v.code); return false } return true })
  if (duplicatesInDb.length && mode === 'error') {
    return NextResponse.json({ error: 'Duplicate subject codes already exist', duplicates_in_db: duplicatesInDb }, { status: 409 })
  }
  if (toInsert.length === 0) {
    return NextResponse.json({ import_batch_id: null, summary: { received: rows.length, inserted: 0, skipped_existing: duplicatesInDb.length, duplicates_in_batch: duplicatesInBatch.length, validation_failed: validationErrors.length }, duplicates_in_db: duplicatesInDb, duplicates_in_batch: duplicatesInBatch, validation_errors: validationErrors }, { status: 200 })
  }

  const importBatchId = randomUUID()
  const payload = toInsert.map((v) => ({ school_id: caller.schoolId, institution_id: caller.institutionId, code: v.code, name: v.name, board_alignment: v.board_alignment, import_batch_id: importBatchId }))
  const { data: inserted, error: insErr } = await db.from('subjects').insert(payload).select('id, code, name')
  if (insErr) return NextResponse.json({ error: 'Insert failed', detail: insErr.message, import_batch_id: importBatchId }, { status: 500 })

  try { await db.from('audit_log').insert({ institution_id: caller.institutionId, school_id: caller.schoolId, user_id: caller.authUserId, action: 'import.subjects', resource: 'subjects', op: 'INSERT', metadata: { import_batch_id: importBatchId, inserted: inserted?.length ?? 0, mode } }) } catch {}

  return NextResponse.json({
    import_batch_id: importBatchId,
    rollback: { method: 'DELETE', endpoint: '/api/import/subjects', body: { import_batch_id: importBatchId } },
    summary: { received: rows.length, inserted: inserted?.length ?? 0, skipped_existing: duplicatesInDb.length, duplicates_in_batch: duplicatesInBatch.length, validation_failed: validationErrors.length },
    inserted: (inserted ?? []).map((r: any) => ({ id: r.id, code: r.code, name: r.name })),
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
  let q = db.from('subjects').delete().eq('import_batch_id', importBatchId)
  q = caller.schoolId ? q.eq('school_id', caller.schoolId) : q.eq('institution_id', caller.institutionId)
  const { data: deleted, error: delErr } = await q.select('id, code')
  if (delErr) return NextResponse.json({ error: 'Rollback failed', detail: delErr.message }, { status: 500 })
  try { await db.from('audit_log').insert({ institution_id: caller.institutionId, school_id: caller.schoolId, user_id: caller.authUserId, action: 'import.subjects.rollback', resource: 'subjects', op: 'DELETE', metadata: { import_batch_id: importBatchId, deleted: deleted?.length ?? 0 } }) } catch {}
  return NextResponse.json({ import_batch_id: importBatchId, rolled_back: deleted?.length ?? 0, deleted: deleted ?? [] }, { status: 200 })
}

export async function GET() {
  return NextResponse.json({
    resource: 'subjects', method: 'POST', accepts: 'array of rows, or { rows: [...], mode: "skip" | "error" }',
    fields: { code: 'string, required, unique per school, <=30', name: 'string, required, <=120', board_alignment: 'optional (e.g. SCERT-AP, CBSE)' },
    ignored_fields: ['id', 'school_id', 'institution_id', 'import_batch_id'],
    duplicate_handling: 'by code within school (UNIQUE school_id, code)',
    rollback: 'DELETE /api/import/subjects with { import_batch_id }',
    sample: { rows: [{ code: 'MATH10', name: 'Mathematics', board_alignment: 'SCERT-AP' }, { code: 'SCI10', name: 'General Science' }], mode: 'skip' },
  })
}
