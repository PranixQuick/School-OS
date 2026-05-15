import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { verifyCronAuth } from '@/lib/cron-auth';

// Weekly cron (Sunday 3am UTC) — Phase E E3.
// Finds school_users who still use the legacy password and have not logged in
// for 30+ days; sends a migration magic link reminder via Resend.

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: users, error } = await supabaseAdmin
    .from('school_users')
    .select('id, email, school_id')
    .is('password_migrated_at', null)
    .lt('last_login', thirtyDaysAgo)
    .eq('is_active', true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;

  for (const user of users ?? []) {
    try {
      // Dispatch magic link via internal endpoint
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/auth/magic-link`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email, redirectTo: '/dashboard' }),
        }
      );
      if (res.ok) sent++; else failed++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({
    users_found: users?.length ?? 0,
    sent,
    failed,
  });
}
