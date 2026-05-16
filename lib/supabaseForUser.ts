import { createClient } from '@supabase/supabase-js';

/**
 * Phase I: Named factory — scaffolding for full RLS migration (item-15).
 * Currently still uses service role. Full RLS via JWT claims is Phase J.
 * ALL callers MUST still use .eq('school_id', schoolId) explicitly.
 */
export function supabaseForUser(_schoolId: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
