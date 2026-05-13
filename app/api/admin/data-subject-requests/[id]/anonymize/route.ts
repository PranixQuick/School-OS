// app/api/admin/data-subject-requests/[id]/anonymize/route.ts
// Item #3 DPDP Compliance — PR #2
// PATCH: anonymize personal data in-place for deletion DSRs.
// Only runs after request_type='deletion' AND status='completed'.
// DO NOT DELETE records — anonymize in place.
//
// LEGAL HOLDS (NEVER anonymized):
//   transfer_certificates           — Section 65B legal hold
//   tc_section_65b_log              — Section 65B legal hold
//   institution_legal_acceptances   — legal hold
//   fees WHERE status='paid'        — financial record retention
// TODO(item-3-legal-hold): these records are exempt from DPDP deletion
//   per Section 65B and financial record retention requirements.
//
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { requirePrincipalSession, PrincipalAuthError } from '@/lib/principal-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

async function resolveSession(req: NextRequest) {
  try {
    const ctx = await requireAdminSession(req);
    return { schoolId: ctx.schoolId, staffId: ctx.staffId };
  } catch (e) {
    if (!(e instanceof AdminAuthError)) throw e;
    try {
      const ctx = await requirePrincipalSession(req);
      return { schoolId: ctx.schoolId, staffId: ctx.staffId };
    } catch (pe) {
      if (pe instanceof PrincipalAuthError) return null;
      throw pe;
    }
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid DSR id' }, { status: 400 });

  const ctx = await resolveSession(req);
  if (!ctx) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { schoolId } = ctx;

  let body: unknown; try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if ((body as Record<string, unknown>)?.confirmed !== true) {
    return NextResponse.json({ error: 'confirmed: true required to proceed with anonymization' }, { status: 400 });
  }

  // Fetch DSR — must be deletion + completed
  const { data: dsr } = await supabaseAdmin.from('data_subject_requests')
    .select('id, requester_type, requester_id, request_type, status')
    .eq('id', id).eq('school_id', schoolId).maybeSingle();
  if (!dsr) return NextResponse.json({ error: 'DSR not found' }, { status: 404 });
  if (dsr.request_type !== 'deletion') return NextResponse.json({ error: 'Anonymization only applies to deletion requests' }, { status: 400 });
  if (dsr.status !== 'completed') return NextResponse.json({ error: `DSR status is '${dsr.status}' — must be 'completed' before anonymization` }, { status: 400 });

  const tablesUpdated: string[] = [];
  const legalHoldsPreserved: string[] = [
    'transfer_certificates (Section 65B legal hold)',
    'tc_section_65b_log (Section 65B legal hold)',
    'institution_legal_acceptances (legal hold)',
    'fees[status=paid] (financial record retention)',
  ];

  if (dsr.requester_type === 'parent') {
    // Fetch parent BEFORE anonymizing (need original phone to find linked students)
    const { data: parent } = await supabaseAdmin.from('parents').select('id, phone')
      .eq('id', dsr.requester_id).eq('school_id', schoolId).maybeSingle();
    if (!parent) return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
    const originalPhone = parent.phone;

    // Anonymize linked students via phone_parent match first
    if (originalPhone) {
      const { error: sErr } = await supabaseAdmin.from('students').update({
        parent_name: 'ANONYMIZED',
        phone_parent: `ANON-${parent.id}`,
      }).eq('phone_parent', originalPhone).eq('school_id', schoolId);
      if (!sErr) tablesUpdated.push('students (parent_name, phone_parent)');
    }

    // Anonymize parent record
    const { error: pErr } = await supabaseAdmin.from('parents').update({
      name: 'ANONYMIZED',
      phone: `ANON-${parent.id}`,
      email: `ANON-${parent.id}`,
    }).eq('id', dsr.requester_id).eq('school_id', schoolId);
    if (!pErr) tablesUpdated.push('parents (name, phone, email)');

    // TODO(item-3-legal-hold): transfer_certificates records are exempt from DPDP deletion
    //   per Section 65B and financial record retention requirements.

  } else if (dsr.requester_type === 'student') {
    const { error: sErr } = await supabaseAdmin.from('students').update({
      name: 'ANONYMIZED',
      parent_name: 'ANONYMIZED',
      admission_number: `ANON-${dsr.requester_id}`,
    }).eq('id', dsr.requester_id).eq('school_id', schoolId);
    if (!sErr) tablesUpdated.push('students (name, parent_name, admission_number)');

    // TODO(item-3-legal-hold): transfer_certificates records are exempt from DPDP deletion
    //   per Section 65B and financial record retention requirements.
    // TODO(item-3-legal-hold): fees with status='paid' are exempt from DPDP deletion
    //   per financial record retention requirements.

  } else {
    // staff — only school_users / staff table
    const { error: sfErr } = await supabaseAdmin.from('staff').update({
      name: 'ANONYMIZED',
      phone: `ANON-${dsr.requester_id}`,
    }).eq('id', dsr.requester_id).eq('school_id', schoolId);
    if (!sfErr) tablesUpdated.push('staff (name, phone)');
  }

  return NextResponse.json({
    anonymized: true,
    requester_type: dsr.requester_type,
    tables_updated: tablesUpdated,
    legal_holds_preserved: legalHoldsPreserved,
  });
}
