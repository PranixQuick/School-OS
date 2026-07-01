import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireAdminSession } from '@/lib/admin-auth';
import { AdminAuthError } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAdminSession(req);
    const { data, error } = await supabaseAdmin
      .from('parents')
      .select('id, name, phone, last_access, is_active, student_id, students(name, class, section)')
      .eq('school_id', ctx.schoolId)
      .eq('is_active', true)
      .order('name', { ascending: true })
      .limit(500);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const parents = (data ?? []).map((p: any) => ({
      id: p.id, name: p.name, phone: p.phone, last_access: p.last_access, is_active: p.is_active,
      student_name: p.students?.name ?? null, class: p.students?.class ?? null, section: p.students?.section ?? null,
    }));
    return NextResponse.json({ parents, count: parents.length });
  } catch (err) {
    if (err instanceof AdminAuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const ctx = await requireAdminSession(req);
    const body = await req.json().catch(() => null) as {
      id: string; name?: string; phone?: string; is_active?: boolean;
    } | null;
    if (!body?.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const update: Record<string, any> = {};
    if (body.name !== undefined) update.name = body.name.trim();
    if (body.phone !== undefined) update.phone = body.phone.trim();
    if (body.is_active !== undefined) update.is_active = body.is_active;

    const { data, error } = await supabaseAdmin
      .from('parents')
      .update(update)
      .eq('id', body.id)
      .eq('school_id', ctx.schoolId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ parent: data });
  } catch (err) {
    if (err instanceof AdminAuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
