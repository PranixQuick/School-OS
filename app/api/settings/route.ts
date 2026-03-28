import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId } from '@/lib/getSchoolId';

export async function GET(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);

    const [schoolRes, usageRes, usersRes] = await Promise.all([
      supabaseAdmin.from('schools').select('*').eq('id', schoolId).single(),
      supabaseAdmin.from('usage_limits').select('*').eq('school_id', schoolId).single(),
      supabaseAdmin.from('school_users').select('id, email, name, role, is_active, last_login, created_at').eq('school_id', schoolId).order('created_at'),
    ]);

    return NextResponse.json({
      school: schoolRes.data,
      usage: usageRes.data,
      users: usersRes.data ?? [],
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const body = await req.json() as {
      name?: string;
      contact_email?: string;
      contact_phone?: string;
      address?: string;
      board?: string;
      settings?: Record<string, unknown>;
    };

    const { data, error } = await supabaseAdmin
      .from('schools')
      .update({
        ...(body.name && { name: body.name }),
        ...(body.contact_email && { contact_email: body.contact_email }),
        ...(body.contact_phone !== undefined && { contact_phone: body.contact_phone }),
        ...(body.address !== undefined && { address: body.address }),
        ...(body.board && { board: body.board }),
        ...(body.settings && { settings: body.settings }),
      })
      .eq('id', schoolId)
      .select('id, name, plan, contact_email, contact_phone, address, board, slug')
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, school: data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
