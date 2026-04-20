// app/api/health/route.ts
// Phase 0 Task 0.4 — health endpoint.
// Wired to Vercel deploy checks before promoting a deployment.
// Returns 200 if every check passes, 503 otherwise.

import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CheckResult {
  ok: boolean;
  detail?: string;
  ms?: number;
}

async function checkEnv(): Promise<CheckResult> {
  // If this file executes at all, lib/env.ts loaded successfully, which means
  // all required env vars parsed against the Zod schema. We still emit the
  // NODE_ENV tag so operators can see which environment answered.
  return { ok: true, detail: `NODE_ENV=${env.NODE_ENV}` };
}

async function checkDb(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const { error } = await supabaseAdmin.from('schools').select('id').limit(1);
    const ms = Date.now() - start;
    if (error) return { ok: false, detail: `supabase error: ${error.message}`, ms };
    return { ok: true, ms };
  } catch (err) {
    return { ok: false, detail: `exception: ${String(err)}`, ms: Date.now() - start };
  }
}

// Light check only — we verify the key is present and looks like an Anthropic key.
// A deep network ping would cost tokens on every probe; deploy-time env validation
// plus format check is sufficient for the health signal.
async function checkAnthropic(): Promise<CheckResult> {
  if (!env.ANTHROPIC_API_KEY) return { ok: false, detail: 'ANTHROPIC_API_KEY unset' };
  if (!env.ANTHROPIC_API_KEY.startsWith('sk-ant-')) {
    return { ok: false, detail: 'ANTHROPIC_API_KEY does not match expected prefix' };
  }
  return { ok: true, detail: 'key present and well-formed' };
}

function checkWhatsapp(): CheckResult {
  const provider = env.WHATSAPP_PROVIDER ?? null;

  if (env.NODE_ENV === 'production') {
    if (provider !== 'twilio') {
      return { ok: false, detail: `provider=${provider ?? 'unset'} (must be twilio in production)` };
    }
    const missing: string[] = [];
    if (!env.TWILIO_ACCOUNT_SID) missing.push('TWILIO_ACCOUNT_SID');
    if (!env.TWILIO_AUTH_TOKEN) missing.push('TWILIO_AUTH_TOKEN');
    if (!env.TWILIO_WHATSAPP_FROM) missing.push('TWILIO_WHATSAPP_FROM');
    if (missing.length > 0) {
      return { ok: false, detail: `missing: ${missing.join(', ')}` };
    }
    return { ok: true, detail: 'provider=twilio, credentials present' };
  }

  return { ok: true, detail: `provider=${provider ?? 'stub (dev default)'}` };
}

export async function GET() {
  const [envChk, dbChk, anthropicChk] = await Promise.all([
    checkEnv(),
    checkDb(),
    checkAnthropic(),
  ]);
  const whatsappChk = checkWhatsapp();

  const checks = {
    env: envChk,
    db: dbChk,
    anthropic: anthropicChk,
    whatsapp: whatsappChk,
  };

  const ok = Object.values(checks).every((c) => c.ok);

  return NextResponse.json(
    {
      status: ok ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: ok ? 200 : 503 }
  );
}
