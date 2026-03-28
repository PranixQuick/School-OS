import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId } from '@/lib/getSchoolId';

export async function POST(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const { requested_plan, message } = await req.json() as { requested_plan: string; message?: string };

    if (!requested_plan) {
      return NextResponse.json({ error: 'requested_plan required' }, { status: 400 });
    }

    const { data: school } = await supabaseAdmin
      .from('schools')
      .select('name, plan, contact_email, billing_email')
      .eq('id', schoolId)
      .single();

    if (!school) return NextResponse.json({ error: 'School not found' }, { status: 404 });

    await supabaseAdmin.from('upgrade_requests').insert({
      school_id: schoolId,
      school_name: school.name,
      contact_email: school.billing_email ?? school.contact_email ?? '',
      current_plan: school.plan,
      requested_plan,
      message: message ?? null,
      status: 'pending',
    });

    return NextResponse.json({ success: true, message: 'Upgrade request submitted. Team will contact you within 24 hours.' });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
