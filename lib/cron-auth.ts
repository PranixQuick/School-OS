// lib/cron-auth.ts
// Shared cron-invocation guard.
//
// Production accepts EITHER:
//   - Vercel's x-vercel-cron:1 header (injected by the platform on scheduled runs;
//     not forgeable from outside the Vercel edge), OR
//   - Authorization: Bearer <CRON_SECRET> (manual invocation, external schedulers,
//     debugging via curl)
//
// Non-production with no CRON_SECRET set allows unauthenticated calls so local
// `curl http://localhost:3000/api/cron/...` works during development.

import type { NextRequest } from 'next/server';
import { env } from './env';

export function verifyCronAuth(req: NextRequest | Request): boolean {
  // 1. Vercel-platform cron path. The x-vercel-cron header is added by Vercel's
  //    edge on scheduled invocations defined in vercel.json. Outside callers
  //    cannot set it; Vercel strips client-supplied copies before the request
  //    reaches the function.
  if (req.headers.get('x-vercel-cron') === '1') return true;

  // 2. Bearer token path. Required when CRON_SECRET is set (production) or
  //    when explicitly used for manual invocation.
  if (env.CRON_SECRET) {
    const auth = req.headers.get('authorization');
    return auth === `Bearer ${env.CRON_SECRET}`;
  }

  // 3. Local dev escape hatch. Only when CRON_SECRET is unset AND we are not
  //    in production. Production with no CRON_SECRET returns false here, so
  //    any request that reaches this branch in production is denied unless
  //    it carried the x-vercel-cron header above.
  return env.NODE_ENV !== 'production';
}
