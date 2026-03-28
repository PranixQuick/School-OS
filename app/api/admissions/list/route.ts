import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId } from '@/lib/getSchoolId';

const DEMO_SCHOOL_ID = '00000000-0000-0000-0000-000000000001';

export async function GET(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req) || DEMO_SCHOOL_ID;
    const priority = req.nextUrl.searchParams.get('priority');
    const status = req.nextUrl.searchParams.get('status');

    let query = supabaseAdmin
      .from('inquiries')
      .select('id, parent_name, child_name, child_age, target_class, source, phone, email, score, priority, status, has_sibling, notes, created_at')
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .order('score', { ascending: false });

    if (priority) query = query.eq('priority', priority);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return NextResponse.json({ leads: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req) || DEMO_SCHOOL_ID;
    const body = await req.json() as {
      id: string; status?: string; notes?: string;
      parent_name?: string; phone?: string; email?: string; priority?: string;
    };

    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('inquiries')
      .update({
        ...(body.status !== undefined && { status: body.status }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.parent_name !== undefined && { parent_name: body.parent_name }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.priority !== undefined && { priority: body.priority }),
      })
      .eq('id', body.id)
      .eq('school_id', schoolId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, lead: data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req) || DEMO_SCHOOL_ID;
    const { id } = await req.json() as { id: string };
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // Soft delete
    const { error } = await supabaseAdmin
      .from('inquiries')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('school_id', schoolId);

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
