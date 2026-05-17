// app/api/admin/parents/resend-credentials/route.ts
// Real workflow: office staff clicks "Resend PIN" for a parent who didn't receive it
// Calls the send-parent-credentials Edge Function with resend=true
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { env } from '@/lib/env';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  let body: { parent_id: string; channel?: 'whatsapp' | 'sms' | 'email' };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { parent_id, channel = 'whatsapp' } = body;
  if (!parent_id) return NextResponse.json({ error: 'parent_id required' }, { status: 400 });

  // Verify parent belongs to this school
  const { data: parent } = await supabaseAdmin
    .from('parents').select('id, school_id').eq('id', parent_id).maybeSingle();
  if (!parent || parent.school_id !== schoolId) {
    return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
  }

  // Call the Edge Function
  const fnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-parent-credentials`;
  try {
    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ parent_id, school_id: schoolId, channel, resend: true }),
    });
    const data = await res.json();
    return NextResponse.json({ success: true, ...data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
