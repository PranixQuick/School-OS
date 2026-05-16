import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

// Parent portal: verify by phone + PIN, return child's data
export async function POST(req: NextRequest) {
  try {
    const { phone, pin, school_id } = await req.json() as {
      phone: string;
      pin: string;
      school_id?: string;
    };

    if (!phone || !pin) {
      return NextResponse.json({ error: 'phone and pin required' }, { status: 400 });
    }

    // Build query — MUST reassign each .eq() call (Supabase builder is immutable)
    let query = supabaseAdmin
      .from('parents')
      .select('id, school_id, student_id, name, phone, access_pin, last_access')
      .eq('phone', phone)
      .eq('access_pin', pin);

    if (school_id) query = query.eq('school_id', school_id);

    const { data: parent, error: pErr } = await query.single();

    if (pErr || !parent) {
      return NextResponse.json({ error: 'Invalid phone number or PIN' }, { status: 401 });
    }

    // Throttled last_access update via DB function — prevents write storms on rapid reloads
    await supabaseAdmin.rpc('update_parent_access', { p_parent_id: parent.id });

    const schoolId = parent.school_id;
    const studentId = parent.student_id;

    // Fetch student details + attendance + fees + report narrative in parallel
    const [studentRes, attendanceRes, feesRes, narrativeRes] = await Promise.all([
      supabaseAdmin
        .from('students')
        .select('id, name, class, section, roll_number, admission_number')
        .eq('id', studentId)
        .eq('school_id', schoolId)
        .single(),

      supabaseAdmin
        .from('attendance')
        .select('date, status')
        .eq('student_id', studentId)
        .eq('school_id', schoolId)
        .order('date', { ascending: false })
        .limit(30),

      supabaseAdmin
        .from('fees')
        .select('fee_type, amount, due_date, status, paid_date')
        .eq('student_id', studentId)
        .eq('school_id', schoolId)
        .order('due_date', { ascending: false }),

      supabaseAdmin
        .from('report_narratives')
        .select('term, narrative_text, status, generated_at')
        .eq('student_id', studentId)
        .eq('school_id', schoolId)
        .order('generated_at', { ascending: false })
        .limit(3),
    ]);

    // PR-3: institution_type lookup for parent portal tab gating
    let institutionType: string | null = null;
    {
      const { data: schoolRow } = await supabaseAdmin
        .from('schools')
        .select('institution_id, institutions(institution_type)')
        .eq('id', schoolId)
        .maybeSingle();
      if (schoolRow?.institutions) {
        const inst = Array.isArray(schoolRow.institutions) ? schoolRow.institutions[0] : schoolRow.institutions;
        institutionType = (inst as { institution_type?: string } | null)?.institution_type ?? null;
      }
    }

    const attendance = attendanceRes.data ?? [];
    const presentDays = attendance.filter(a => a.status === 'present').length;
    const attendancePct = attendance.length > 0
      ? Math.round((presentDays / attendance.length) * 100)
      : 100;

    return NextResponse.json({
      success: true,
      parent: { name: parent.name },
      student: studentRes.data ? { ...studentRes.data, institution_type: institutionType } : null,
      attendance: {
        records: attendance.slice(0, 10),
        summary: {
          present: presentDays,
          total: attendance.length,
          percentage: attendancePct,
        },
      },
      fees: feesRes.data ?? [],
      narratives: narrativeRes.data ?? [],
    });

  } catch (err) {
    console.error('Parent portal error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
