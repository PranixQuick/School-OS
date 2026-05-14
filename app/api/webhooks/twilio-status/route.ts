// app/api/webhooks/twilio-status/route.ts
// Batch 13 — Twilio WhatsApp delivery status callback.
// Already public via '/api/webhooks' prefix in middleware PUBLIC_PATHS — no change needed.
// Twilio sends form-encoded body (NOT JSON).
// Updates notifications.delivery_status + delivered_at/read_at via whatsapp_message_sid.
// Must return 200 or Twilio retries.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const params = new URLSearchParams(rawBody);
    const sid = params.get('MessageSid');
    const status = params.get('MessageStatus'); // sent|delivered|read|failed|undelivered

    if (!sid || !status) {
      console.warn('[twilio-status] missing MessageSid or MessageStatus');
      return new Response('OK', { status: 200 });
    }

    const validStatuses = ['sent','delivered','read','failed','undelivered'];
    if (!validStatuses.includes(status)) {
      console.warn('[twilio-status] unknown status:', status);
      return new Response('OK', { status: 200 });
    }

    const patch: Record<string, unknown> = { delivery_status: status };
    if (status === 'delivered') patch.delivered_at = new Date().toISOString();
    if (status === 'read') patch.read_at = new Date().toISOString();

    const { error } = await supabaseAdmin
      .from('notifications')
      .update(patch)
      .eq('whatsapp_message_sid', sid);

    if (error) {
      console.error('[twilio-status] update error:', error.message);
    } else {
      console.log('[twilio-status] updated:', sid, '->', status);
    }
  } catch (e) {
    console.error('[twilio-status] fatal:', e);
  }

  // Always 200 — Twilio retries on non-200
  return new Response('OK', { status: 200 });
}
