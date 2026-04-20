// lib/abuse/blocklist.ts
// IP blocklist read path. Queried by the login route and magic-link route
// before any password / token work so a blocked IP cannot drive the
// rate-limit counter further.

import { supabaseAdmin } from '@/lib/supabaseClient';

export interface BlockStatus {
  blocked: boolean;
  reason?: string;
  until?: string;
}

export async function isIpBlocked(ip: string | null | undefined): Promise<BlockStatus> {
  if (!ip) return { blocked: false };
  const { data, error } = await supabaseAdmin
    .from('blocked_ips')
    .select('reason, blocked_until')
    .eq('ip', ip)
    .gte('blocked_until', new Date().toISOString())
    .maybeSingle();
  if (error || !data) return { blocked: false };
  return {
    blocked: true,
    reason: (data.reason as string | null) ?? undefined,
    until: data.blocked_until as string,
  };
}
