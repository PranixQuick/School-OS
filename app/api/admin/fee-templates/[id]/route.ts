// app/api/admin/fee-templates/[id]/route.ts
// Batch 2: Fee templates — update (PUT) and soft delete (DELETE).
// DELETE is soft: sets is_active=false.
// TODO(item-15): migrate to supabaseForUser
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

// ─── PUT ──────────────────────────────────────────────────────────────────────
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid template id' }, { status: 400 });
  let ctx; try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;
  let body: unknown; try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const allowed = ['name','grade_level','section','academic_year_id','fee_items','is_active'] as const;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if ((body as Record<string, unknown>)[key] !== undefined) update[key] = (body as Record<string, unknown>)[key];
  }
  // Validate fee_items if provided
  if (update.fee_items !== undefined) {
    const items = update.fee_items as unknown;
    if (!Array.isArray(items) || items.length === 0 ||
      !items.every((i: unknown) => i && typeof i === 'object' && typeof (i as Record<string,unknown>).fee_type === 'string' && typeof (i as Record<string,unknown>).amount === 'number' && (i as Record<string,number>).amount > 0)) {
      return NextResponse.json({ error: 'fee_items must be a non-empty array of {fee_type, amount (>0)}' }, { status: 400 });
    }
  }
  const { data, error } = await supabaseAdmin.from('fee_templates').update(update)
    .eq('id', id).eq('school_id', schoolId).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  return NextResponse.json(data);
}

// ─── DELETE (soft) ────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid template id' }, { status: 400 });
  let ctx; try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;
  const { error } = await supabaseAdmin.from('fee_templates')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id).eq('school_id', schoolId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true, id });
}
