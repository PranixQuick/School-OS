// app/api/admin/knowledge/route.ts
// Batch 5B — Knowledge base CRUD (GET list + POST create).
// Valid categories: policy, fee_structure, admission, academic,
//   transport, medical, circular, general (also accepts legacy: fees, contact, events, schedule)
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

const VALID_CATEGORIES = new Set([
  'policy','fee_structure','admission','academic','transport',
  'medical','circular','general',
  // Legacy seeded categories
  'fees','contact','events','schedule',
]);

async function resolveSession(req: NextRequest) {
  try { return await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError && e.status === 403) {
      try {
        const { requireTeacherSession, TeacherAuthError } = await import('@/lib/teacher-auth');
        const t = await requireTeacherSession(req);
        return { schoolId: t.schoolId, staffId: t.staffId, userRole: 'teacher' as const };
      } catch {}
    }
    throw e;
  }
}

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await resolveSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const search = searchParams.get('search');

  let query = supabaseAdmin
    .from('knowledge_chunks')
    .select('*')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false });

  if (category) query = query.eq('category', category);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Apply text search in-memory if provided (Supabase tsvector search via RPC is more complex)
  let chunks = data ?? [];
  if (search) {
    const q = search.toLowerCase();
    chunks = chunks.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.content.toLowerCase().includes(q) ||
      (c.keywords ?? []).some((k: string) => k.toLowerCase().includes(q))
    );
  }

  return NextResponse.json({ chunks, total: chunks.length });
}

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { title, content, category, keywords, source_doc } = body as {
    title?: string; content?: string; category?: string;
    keywords?: string[]; source_doc?: string;
  };

  if (!title || !content || !category) {
    return NextResponse.json({ error: 'title, content, and category required' }, { status: 400 });
  }
  if (!VALID_CATEGORIES.has(category)) {
    return NextResponse.json({ error: `Invalid category. Valid: ${[...VALID_CATEGORIES].join(', ')}` }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('knowledge_chunks')
    .insert({
      school_id: schoolId,
      title, content, category,
      keywords: keywords ?? [],
      source_doc: source_doc ?? null,
      is_active: true,
    })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ chunk: data }, { status: 201 });
}
