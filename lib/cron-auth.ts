// lib/cron-auth.ts
// Shared cron-invocation guard.
// Vercel cron posts with `Authorization: Bearer <CRON_SECRET>` when the env is set.
// In non-production we allow an unset CRON_SECRET so `curl` works locally.

import type { NextRequest } from 'next/server';
import { env } from './env';

export function verifyCronAuth(req: NextRequest | Request): boolean {
  if (!env.CRON_SECRET) return env.NODE_ENV !== 'production';
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${env.CRON_SECRET}`;
}
