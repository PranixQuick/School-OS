import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

// TEMPORARY DEBUG ENDPOINT — diagnose why signInWithPassword fails in CI
// Protected by E2E_BYPASS_SECRET — remove after CI is fixed
export async function POST(req: NextRequest) {
  const bypass = req.headers.get('x-e2e-bypass');
  const secret = process.env.E2E_BYPASS_SECRET;
  if (!secret || bypass !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { email, password } = await req.json() as { email: string; password: string };

  // Test with anon key
  const anonClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  );
  const { error: anonErr } = await anonClient.auth.signInWithPassword({ email, password });

  // Test with service role key
  const { createClient: cc } = await import('@supabase/supabase-js');
  const svcClient = cc(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const { error: svcErr } = await svcClient.auth.signInWithPassword({ email, password });

  return NextResponse.json({
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    anon_key_prefix: env.NEXT_PUBLIC_SUPABASE_ANON_KEY.slice(0, 20),
    anon_error: anonErr ? { code: anonErr.status, message: anonErr.message } : null,
    svc_error: svcErr ? { code: svcErr.status, message: svcErr.message } : null,
  });
}
