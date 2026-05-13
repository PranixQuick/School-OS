// app/api/admin/fee-templates/route.ts
// Batch 2: Fee structure templates — list and create.
// GET: ?grade_level=X (optional)
// POST: { name, grade_level, section?, academic_year_id?, fee_items: [{fee_type, amount, description?}] }
// TODO(item-15): migrate to supabaseForUser
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

interface FeeItem { fee_type: string; amount: number; description?: string }

function validateFeeItems(items: unknown): items is FeeItem[] {
  if (!Array.isArray(items) || items.length === 0) return false;
  return items.every((i: unknown) => {
    if (!i || typeof i !== 'object') return false;
    const item = i as Record<string, unknown>;
    return typeof item.fee_type === 'string' && item.fee_type.trim() &&
      typeof item.amount === 'number' && item.amount > 0;
  });
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  let ctx; try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;
  const gradeLevel = req.nextUrl.searchParams.get('grade_level');
  let query = supabaseAdmin.from('fee_templates')
    .select('id, name, grade_level, section, academic_year_id, fee_items, is_active, created_at, updated_at')
    .eq('school_id', schoolId).eq('is_active', true)
    .order('grade_level').order('name');
  if (gradeLevel) query = query.eq('grade_level', gradeLevel);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data ?? [], count: (data ?? []).length });
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let ctx; try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId, staffId } = ctx;
  let body: unknown; try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { name, grade_level, section, academic_year_id, fee_items } = body as Record<string, unknown>;
  if (!name || typeof name !== 'string' || !name.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });
  if (!grade_level || typeof grade_level !== 'string' || !grade_level.trim()) return NextResponse.json({ error: 'grade_level required' }, { status: 400 });
  if (!validateFeeItems(fee_items)) return NextResponse.json({ error: 'fee_items must be a non-empty array of {fee_type, amount (>0)}' }, { status: 400 });
  // Resolve institution_id
  const { data: school } = await supabaseAdmin.from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  const { data: template, error } = await supabaseAdmin.from('fee_templates').insert({
    school_id: schoolId,
    institution_id: school?.institution_id ?? null,
    name: name.trim(),
    grade_level: grade_level.trim(),
    section: typeof section === 'string' && section.trim() ? section.trim() : null,
    academic_year_id: isUuid(academic_year_id) ? academic_year_id : null,
    fee_items,
    created_by: staffId ?? null,
  }).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(template, { status: 201 });
}
