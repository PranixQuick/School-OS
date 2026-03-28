import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId } from '@/lib/getSchoolId';



export async function GET(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);

    const { data, error } = await supabaseAdmin
      .from('recordings')
      .select('id, staff_id, file_name, transcript, eval_report, coaching_score, status, uploaded_at, processed_at, staff(name, role, subject)')
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .order('uploaded_at', { ascending: false });

    if (error) throw new Error(error.message);
    return NextResponse.json({ recordings: data ?? [] });
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
      .from('recordings')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('school_id', schoolId);

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PATCH: re-run AI evaluation on an existing recording
export async function PATCH(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const { id } = await req.json() as { id: string };
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // Mark as pending — the process route will pick it up
    const { data, error } = await supabaseAdmin
      .from('recordings')
      .update({ status: 'pending', eval_report: null, coaching_score: null, processed_at: null })
      .eq('id', id)
      .eq('school_id', schoolId)
      .select('id, file_url, file_name, transcript, staff_id')
      .single();

    if (error) throw new Error(error.message);

    // If transcript exists, re-run eval immediately
    if (data?.transcript) {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/teacher-eval/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recording_id: id, transcript: data.transcript }),
      });
      const result = await response.json() as Record<string, unknown>;
      return NextResponse.json({ success: true, rerun: true, result });
    }

    return NextResponse.json({ success: true, rerun: false, message: 'Marked for re-processing. Re-upload to regenerate transcript.' });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
