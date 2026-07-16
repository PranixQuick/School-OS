import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { getParentSession } from '@/lib/parent-auth';
import { verifyStudentSession, STUDENT_SESSION_COOKIE } from '@/lib/student-auth';
import { aariaSpeak, AARIA_PRODUCT, AariaClientError, AARIA_BASE_URL } from '@/lib/aaria-client';

// app/api/voice-companion/route.ts
//
// Additive Aaria "visual-companion" slice for School-OS (Aaria product key
// "EdProSys").
//
// WHAT THIS IS: a small, self-contained server endpoint that turns an
// already-resolved text response (the string the user just received from
// /api/voice-query) into (a) synthesized speech audio and (b) Aaria's
// visual_companion metadata (avatar_state / expression / caption timing). It
// calls aariaSpeak() from lib/aaria-client.ts — the previously-staged,
// until-now-unwired wrapper around pranix-aaria's POST /api/voice/speak.
//
// WHY A SEPARATE ROUTE (not folded inline into /api/voice-query): the live
// voice-query route is a large, working core read-path. Keeping this slice
// additive means it cannot break that route. This mirrors how QuietKeep added
// its Aaria integration as a distinct additive route
// (src/app/api/aaria/route.js) rather than editing its existing intent
// pipeline. components/VoiceQueryWidget.tsx already models `visual_companion`
// in its VoiceNLResp type and renders an expression cue, so the client can
// consume this endpoint with a minimal follow-up call after voice-query
// returns.
//
// AUTH: gated behind ANY valid School-OS session (staff / parent / student) —
// exactly the session primitives /api/voice-query already imports. This route
// does NOT touch billing, access-control, or any auth logic; it only *reads*
// session validity to reject anonymous callers, then proxies TTS.

export const dynamic = 'force-dynamic';

async function hasValidSession(req: NextRequest): Promise<boolean> {
  // Staff (teacher / accountant / principal / owner)
  const staff = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (staff) return true;
  // Parent
  const parent = await getParentSession(req);
  if (parent) return true;
  // Student
  const student = await verifyStudentSession(req.cookies.get(STUDENT_SESSION_COOKIE)?.value);
  if (student) return true;
  return false;
}

export async function POST(req: NextRequest) {
  if (!(await hasValidSession(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { text?: unknown; lang?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const lang = typeof body.lang === 'string' && body.lang ? body.lang : 'en';
  if (!text) {
    return NextResponse.json({ error: 'text required' }, { status: 400 });
  }

  // Best-effort: a speak failure must never break the caller's UX. On any
  // error we return 200 with null companion fields so the widget simply shows
  // the text response without audio/expression, exactly as it does today.
  try {
    const speak = await aariaSpeak(text, { lang, product: AARIA_PRODUCT });
    return NextResponse.json({
      audio_response_base64: speak.audio_base64 ?? null,
      visual_companion: speak.visual_companion ?? null,
      lang: speak.lang ?? lang,
      engine_used: speak.engine_used ?? null,
    });
  } catch (e) {
    const detail = e instanceof AariaClientError ? e.message : 'Aaria speak unreachable';
    return NextResponse.json(
      { audio_response_base64: null, visual_companion: null, degraded: true, detail },
      { status: 200 }
    );
  }
}

// Health passthrough — quick ops check for the Aaria speak dependency without
// the client needing to know Aaria's base URL.
export async function GET() {
  try {
    const res = await fetch(`${AARIA_BASE_URL}/api/health`, {
      signal: AbortSignal.timeout(10_000),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      {
        status: 'error',
        service: 'aaria-companion-proxy',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 503 }
    );
  }
}
