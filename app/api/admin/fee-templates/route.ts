// app/api/admin/fee-templates/route.ts
// Phase D — C4: Fee Templates API — list and create
// GET  /api/admin/fee-templates         - list templates for school
// POST /api/admin/fee-templates         - create template

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export async function GET(req: NextRequest) {
  let auth; try { auth = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const { data, error } = await supabaseAdmin
    .from('fee_templates')
    .select('id, name, grade_level, section, fee_items, is_active, created_at')
    .eq('school_id', auth.schoolId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Failed to load templates' }, { status: 500 });
  return NextResponse.json({ templates: data ?? [] });
}

export async function POST(req: NextRequest) {
  let auth; try { auth = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const { name, grade_level, section, fee_items } = body as {
    name?: string; grade_level?: string; section?: string;
    fee_items?: Array<{ fee_type: string; amount: number }>;
  };

  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  if (!grade_level?.trim()) return NextResponse.json({ error: 'grade_level is required' }, { status: 400 });
  if (!Array.isArray(fee_items) || fee_items.length === 0) {
    return NextResponse.json({ error: 'fee_items must be a non-empty array' }, { status: 400 });
  }

  // Validate fee_items shape
  for (const item of fee_items) {
    if (!item.name || typeof item.amount !== 'number' || item.amount <= 0) {
      return NextResponse.json(
        { error: 'Each fee_item must have name (string) and amount (number > 0)' },
        { status: 400 }
      );
    }
  }

  // Require academic_year_id from school
  const { data: school } = await supabaseAdmin
    .from('schools')
    .select('id')
    .eq('id', auth.schoolId)
    .single();
  if (!school) return NextResponse.json({ error: 'School not found' }, { status: 404 });

  const { data: ay } = await supabaseAdmin
    .from('academic_years')
    .select('id')
    .eq('school_id', auth.schoolId)
    .eq('is_active', true)
    .single();

  const { data: created, error: createErr } = await supabaseAdmin
    .from('fee_templates')
    .insert({
      school_id: auth.schoolId,
      academic_year_id: ay?.id ?? null,
      name: name.trim(),
      grade_level: grade_level.trim(),
      section: section?.trim() ?? null,
      fee_items,
      is_active: true,
    })
    .select('id, name, grade_level, section, fee_items, is_active, created_at')
    .single();

  if (createErr) {
    console.error('[fee-templates] create error:', createErr.message);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }

  return NextResponse.json({ template: created }, { status: 201 });
}
