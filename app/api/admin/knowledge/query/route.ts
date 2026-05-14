// app/api/admin/knowledge/query/route.ts
// Batch 5B — RAG query: retrieve relevant knowledge chunks + answer via Claude Haiku.
// Keyword-based retrieval (PostgreSQL full-text search, no vector DB needed).
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

async function resolveSession(req: NextRequest) {
  try { return await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError && e.status === 403) {
      try {
        const { requireTeacherSession } = await import('@/lib/teacher-auth');
        const t = await requireTeacherSession(req);
        return { schoolId: t.schoolId, staffId: t.staffId, userRole: 'teacher' as const };
      } catch {}
    }
    throw e;
  }
}

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await resolveSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { question } = body as { question?: string };
  if (!question?.trim()) return NextResponse.json({ error: 'question required' }, { status: 400 });

  // Step 1: Full-text search for relevant chunks
  const { data: ftChunks } = await supabaseAdmin
    .from('knowledge_chunks')
    .select('id, title, content, category')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .textSearch('content', question, { type: 'plain', config: 'english' })
    .limit(5);

  // Also try title ILIKE match as supplement
  const { data: titleChunks } = await supabaseAdmin
    .from('knowledge_chunks')
    .select('id, title, content, category')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .ilike('title', `%${question.slice(0, 40)}%`)
    .limit(3);

  // Merge and deduplicate
  const seen = new Set<string>();
  const chunks: { id: string; title: string; content: string; category: string }[] = [];
  for (const c of [...(ftChunks ?? []), ...(titleChunks ?? [])]) {
    if (!seen.has(c.id)) { seen.add(c.id); chunks.push(c); }
    if (chunks.length >= 5) break;
  }

  if (chunks.length === 0) {
    return NextResponse.json({
      answer: "I don't have information about that in the school knowledge base. Please contact the school office for more details.",
      sources: [],
      question,
    });
  }

  // Step 2: Get school name for context
  const { data: school } = await supabaseAdmin
    .from('schools').select('name').eq('id', schoolId).maybeSingle();
  const schoolName = school?.name ?? 'the school';

  // Step 3: Call Claude Haiku
  const contextText = chunks.map(c => `--- ${c.title} ---\n${c.content}`).join('\n\n');

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';
  let answer = "I couldn't generate an answer right now. Please check the documents directly.";

  if (ANTHROPIC_API_KEY) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          messages: [{
            role: 'user',
            content: `You are a helpful assistant for ${schoolName} school. Answer the question based ONLY on the provided context. If the context doesn't contain the answer, say so clearly. Be concise and helpful.\n\nContext from school knowledge base:\n${contextText}\n\nQuestion: ${question}\n\nAnswer in the same language as the question.`,
          }],
        }),
      });
      if (res.ok) {
        const data = await res.json() as { content?: { text?: string }[] };
        answer = data.content?.[0]?.text ?? answer;
      }
    } catch (e) {
      console.error('[RAG] Claude call failed:', String(e).slice(0, 100));
    }
  } else {
    // No API key — return context directly
    answer = `Based on available documents:\n\n${chunks.map(c => `**${c.title}**: ${c.content.slice(0, 200)}`).join('\n\n')}`;
  }

  return NextResponse.json({
    answer,
    sources: chunks.map(c => ({ title: c.title, category: c.category })),
    question,
  });
}
