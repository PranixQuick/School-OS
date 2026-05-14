// app/api/admin/conversations/route.ts
// Batch 5B — WhatsApp conversation log: grouped by phone + joined with inquiries CRM.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  const { searchParams } = new URL(req.url);
  const phoneFilter = searchParams.get('phone');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);
  const offset = parseInt(searchParams.get('offset') ?? '0');

  let query = supabaseAdmin
    .from('conversations')
    .select('*', { count: 'exact' })
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (phoneFilter) query = query.eq('phone_number', phoneFilter);

  const { data: convs, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get unique phones for this page
  const phones = [...new Set((convs ?? []).map(c => c.phone_number))];

  // Fetch inquiry data for known leads
  const inquiryMap: Record<string, { parent_name?: string; status?: string }> = {};
  if (phones.length) {
    const { data: inquiries } = await supabaseAdmin
      .from('inquiries')
      .select('phone, parent_name, status')
      .eq('school_id', schoolId)
      .in('phone', phones);
    for (const i of inquiries ?? []) {
      inquiryMap[i.phone] = { parent_name: i.parent_name, status: i.status };
    }
  }

  const conversations = (convs ?? []).map(c => ({
    ...c,
    inquiry_name: inquiryMap[c.phone_number]?.parent_name ?? null,
    inquiry_status: inquiryMap[c.phone_number]?.status ?? null,
  }));

  // Summary stats
  const { data: stats } = await supabaseAdmin
    .from('conversations')
    .select('intent, phone_number')
    .eq('school_id', schoolId)
    .eq('direction', 'inbound');

  const totalConvs = stats?.length ?? 0;
  const admissionInquiries = stats?.filter(s => s.intent === 'admission_inquiry').length ?? 0;
  const existingParents = stats?.filter(s => s.intent === 'existing_parent').length ?? 0;
  const uniquePhones = new Set(stats?.map(s => s.phone_number) ?? []).size;

  return NextResponse.json({
    conversations,
    total: count ?? 0,
    stats: { total_messages: totalConvs, admission_inquiries: admissionInquiries, existing_parents: existingParents, unique_contacts: uniquePhones },
  });
}
