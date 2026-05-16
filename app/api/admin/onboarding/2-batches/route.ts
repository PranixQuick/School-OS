import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

// K2: Batch creation for coaching centres during onboarding Step 2.
// Accepts an array of batches and bulk-inserts into the batches table.
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const { schoolId } = ctx;

  const body = await req.json() as {
    batches: { label: string; entry_year?: number; capacity?: number | null; group_code?: string }[];
  };

  if (!body.batches || !Array.isArray(body.batches)) {
    return NextResponse.json({ error: 'batches array required' }, { status: 400 });
  }

  // Resolve institution_id from school
  const { data: school } = await supabaseAdmin
    .from('schools')
    .select('institution_id')
    .eq('id', schoolId)
    .maybeSingle();

  if (!school?.institution_id) {
    return NextResponse.json({ error: 'institution not found' }, { status: 404 });
  }

  const institutionId = school.institution_id;

  // Filter out empty labels and build insert rows
  const rows = body.batches
    .filter(b => b.label?.trim())
    .map(b => ({
      institution_id: institutionId,
      label: b.label.trim(),
      entry_year: b.entry_year ?? new Date().getFullYear() + 1,
      capacity: b.capacity ?? null,
      ...(b.group_code ? { group_code: b.group_code } : {}), // K5: jr college groups
    }));

  if (rows.length === 0) {
    return NextResponse.json({ success: true, batch_count: 0 });
  }

  const { error } = await supabaseAdmin
    .from('batches')
    .insert(rows);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, batch_count: rows.length });
}
