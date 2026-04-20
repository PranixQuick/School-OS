import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

export const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// supabaseForUser returns an anon-key client bound to a Supabase Auth access token.
// RLS policies that call auth.jwt() / auth.uid() / current_school_id() evaluate
// against THIS token, so every query is tenant-scoped by Postgres, not by the app.
//
// IMPORTANT: the access token must be a Supabase-issued JWT (from supabase.auth),
// NOT the custom session JWT minted by lib/session.ts. The magic-link callback
// flow returns a Supabase session — its access_token is what you pass here.
//
// Rollout: routes should check isRlsStrictEnabled(schoolId) from lib/tenancy.ts and
// use supabaseForUser when true, falling back to supabaseAdmin while the school is
// still on the permissive path. Per-route migration is 5 routes/day per the plan.
export function supabaseForUser(accessToken: string): SupabaseClient {
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    }
  );
}
