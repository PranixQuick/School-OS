import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import bcrypt from 'bcryptjs';
import { signParentSession, parentSessionCookieOptions } from '@/lib/parent-auth';

interface LoginRequest { phone?: string; pin?: string; }

export async function POST(req: NextRequest) {
  try {
    const { phone, pin } = await req.json() as LoginRequest;

    if (!phone || !pin) {
      return NextResponse.json({ error: 'phone and pin required' }, { status: 400 });
    }

    const { data: parents, error: pErr } = await supabaseAdmin
      .from('parents')
      .select('id, school_id, student_id, name, phone, language_pref, access_pin, access_pin_hashed, is_active')
      .eq('phone', phone);

    if (pErr) return NextResponse.json({ error: 'Failed to verify credentials' }, { status: 500 });
    if (!parents || parents.length === 0) return NextResponse.json({ error: 'Invalid phone number or PIN' }, { status: 401 });
    if (parents.length > 1) return NextResponse.json({ error: 'Multiple accounts match this phone. Contact your school admin.' }, { status: 409 });

    const parent = parents[0];
    if (parent.is_active === false) return NextResponse.json({ error: 'Account is inactive.' }, { status: 401 });

    let pinValid = false;
    if (parent.access_pin_hashed) {
      pinValid = await bcrypt.compare(pin, parent.access_pin_hashed);
    } else if (parent.access_pin) {
      pinValid = (parent.access_pin === pin);
      if (pinValid) {
        const hashed = await bcrypt.hash(pin, 10);
        await supabaseAdmin.from('parents').update({ access_pin_hashed: hashed, access_pin: null }).eq('id', parent.id);
      }
    }
    if (!pinValid) return NextResponse.json({ error: 'Invalid phone number or PIN' }, { status: 401 });

    const { data: student } = await supabaseAdmin
      .from('students')
      .select('id, school_id, name, class, section, is_active')
      .eq('id', parent.student_id)
      .eq('school_id', parent.school_id)
      .single();

    if (!student) return NextResponse.json({ error: 'Student record not found.' }, { status: 404 });

    let resolvedClassId: string | null = null;
    if (student.class && student.section) {
      const { data: classRow } = await supabaseAdmin
        .from('classes').select('id')
        .eq('school_id', student.school_id)
        .eq('grade_level', student.class)
        .eq('section', student.section)
        .maybeSingle();
      if (classRow) resolvedClassId = classRow.id;
    }

    await supabaseAdmin.from('parents').update({ last_access: new Date().toISOString() }).eq('id', parent.id);

    // Issue session cookie
    const token = await signParentSession({
      parentId: parent.id,
      schoolId: parent.school_id,
      studentId: parent.student_id,
      phone: parent.phone,
    });

    const res = NextResponse.json({
      success: true,
      parent: { id: parent.id, school_id: parent.school_id, name: parent.name, phone: parent.phone },
      student: { id: student.id, name: student.name, class: student.class, section: student.section, is_active: student.is_active },
      class_id: resolvedClassId,
    });

    const opts = parentSessionCookieOptions();
    res.cookies.set(opts.name, token, opts);
    return res;
  } catch (err) {
    console.error('Parent login error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
