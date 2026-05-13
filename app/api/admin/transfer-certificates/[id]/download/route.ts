// app/api/admin/transfer-certificates/[id]/download/route.ts
// Item #11 TC Lifecycle — PR #2
// GET: download issued TC as PDF
//
// If TC is issued + pdf_content exists: streams PDF.
// TC reprint works without re-generation — serves stored pdf_content.
// Auth: requireAdminSession or requirePrincipalSession
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { requirePrincipalSession, PrincipalAuthError } from '@/lib/principal-auth';
// TODO(item-15): migrate to supabaseForUser
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

async function resolveSession(req: NextRequest) {
  try {
    const ctx = await requireAdminSession(req);
    return { schoolId: ctx.schoolId };
  } catch (e) {
    if (!(e instanceof AdminAuthError)) throw e;
    try {
      const ctx = await requirePrincipalSession(req);
      return { schoolId: ctx.schoolId };
    } catch (pe) {
      if (pe instanceof PrincipalAuthError) return null;
      throw pe;
    }
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid TC id' }, { status: 400 });

  const ctx = await resolveSession(req);
  if (!ctx) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { schoolId } = ctx;

  const { data: tc, error } = await supabaseAdmin
    .from('transfer_certificates')
    .select('id, status, tc_number, pdf_content, student_id')
    .eq('id', id).eq('school_id', schoolId).maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!tc) return NextResponse.json({ error: 'TC not found' }, { status: 404 });

  if (tc.status !== 'issued' || !tc.pdf_content) {
    return NextResponse.json(
      { error: 'tc_not_issued', message: 'TC has not been issued yet. Issue the TC before downloading.' },
      { status: 404 }
    );
  }

  // Fetch student name for filename
  const { data: student } = await supabaseAdmin
    .from('students').select('name').eq('id', tc.student_id).maybeSingle();
  const safeName = (student?.name ?? 'student').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `TC-${tc.tc_number}-${safeName}.pdf`;

  const pdfBuffer = Buffer.from(tc.pdf_content, 'base64');

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(pdfBuffer.length),
      'Cache-Control': 'no-store',
    },
  });
}
