import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId } from '@/lib/getSchoolId';

export async function GET(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const studentId = req.nextUrl.searchParams.get('student_id');
    const term = req.nextUrl.searchParams.get('term');

    let query = supabaseAdmin
      .from('academic_records')
      .select('id, student_id, subject, term, marks_obtained, max_marks, grade, remarks, students(name, class, section)')
      .eq('school_id', schoolId)
      .order('term')
      .order('subject');

    if (studentId) query = query.eq('student_id', studentId);
    if (term) query = query.eq('term', term);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return NextResponse.json({ records: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const body = await req.json() as {
      student_id: string; subject: string; term: string;
      marks_obtained: number; max_marks: number; grade?: string; remarks?: string;
    };

    if (!body.student_id || !body.subject || !body.term) {
      return NextResponse.json({ error: 'student_id, subject, term required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('academic_records')
      .upsert({
        school_id: schoolId,
        student_id: body.student_id,
        subject: body.subject,
        term: body.term,
        marks_obtained: body.marks_obtained,
        max_marks: body.max_marks,
        grade: body.grade ?? null,
        remarks: body.remarks ?? null,
      }, { onConflict: 'school_id,student_id,subject,term' })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, record: data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const { id, marks_obtained, max_marks, grade, remarks } = await req.json() as {
      id: string; marks_obtained?: number; max_marks?: number; grade?: string; remarks?: string;
    };

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('academic_records')
      .update({
        ...(marks_obtained !== undefined && { marks_obtained }),
        ...(max_marks !== undefined && { max_marks }),
        ...(grade !== undefined && { grade }),
        ...(remarks !== undefined && { remarks }),
      })
      .eq('id', id)
      .eq('school_id', schoolId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, record: data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const { id } = await req.json() as { id: string };
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const { error } = await supabaseAdmin
      .from('academic_records')
      .delete()
      .eq('id', id)
      .eq('school_id', schoolId);

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
