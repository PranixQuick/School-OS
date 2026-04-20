// lib/whatsapp.ts — Twilio live, dev-only stub.
// Phase 0 Task 0.3: stub-in-prod is hard-blocked at module load; silent fallback removed.

// ─── Module-load guard ────────────────────────────────────────────────────────
//
// Production deploys MUST set WHATSAPP_PROVIDER=twilio (and the TWILIO_* vars).
// A missing or 'stub' provider in production is a misconfiguration we refuse to
// serve, so the error is thrown here — the route file that imports this module
// will fail to load and the deploy will fail health checks.

const __provider_raw = process.env.WHATSAPP_PROVIDER;
const __node_env = process.env.NODE_ENV;

if (__node_env === 'production' && (!__provider_raw || __provider_raw === 'stub')) {
  throw new Error(
    `[lib/whatsapp] WHATSAPP_PROVIDER=${__provider_raw ?? '<unset>'} is not permitted in production. ` +
    `Set WHATSAPP_PROVIDER=twilio and configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM.`
  );
}

export interface WhatsAppMessage {
  to: string;
  body: string;
  schoolName?: string;
}

export interface WhatsAppResult {
  success: boolean;
  messageId?: string;
  provider: string;
  error?: string;
}

// ─── Twilio ───────────────────────────────────────────────────────────────────

async function sendViaTwilio(msg: WhatsAppMessage): Promise<WhatsAppResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken  = process.env.TWILIO_AUTH_TOKEN!;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM!; // whatsapp:+14155238886

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: fromNumber,
        To: `whatsapp:${msg.to}`,
        Body: msg.body,
      }),
    }
  );

  const data = await response.json() as { sid?: string; message?: string; error_message?: string };
  if (!response.ok) {
    return { success: false, provider: 'twilio', error: data.error_message ?? data.message ?? `HTTP ${response.status}` };
  }
  return { success: true, messageId: data.sid, provider: 'twilio' };
}

// ─── Stub (non-production only) ───────────────────────────────────────────────

async function sendViaStub(msg: WhatsAppMessage): Promise<WhatsAppResult> {
  await new Promise(r => setTimeout(r, 50));
  console.log(`[WhatsApp STUB] TO: ${msg.to} | MSG: ${msg.body.slice(0, 80)}`);
  return {
    success: true,
    messageId: `stub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    provider: 'stub',
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────
//
// sendWhatsApp no longer silently falls back to the stub when the provider is
// unset or unknown. Misconfiguration is surfaced as an explicit failure result
// so callers can log/alert rather than believing a message was delivered.

export async function sendWhatsApp(msg: WhatsAppMessage): Promise<WhatsAppResult> {
  const provider = process.env.WHATSAPP_PROVIDER;
  const isProd = process.env.NODE_ENV === 'production';

  try {
    if (provider === 'twilio') return await sendViaTwilio(msg);

    if (provider === 'stub' || !provider) {
      if (isProd) {
        return {
          success: false,
          provider: provider ?? 'unset',
          error: 'WHATSAPP_PROVIDER=stub or unset is not permitted in production',
        };
      }
      return await sendViaStub(msg);
    }

    return {
      success: false,
      provider,
      error: `Unknown WHATSAPP_PROVIDER: ${provider}`,
    };
  } catch (err) {
    return { success: false, provider: provider ?? 'unset', error: String(err) };
  }
}

export function normalisePhone(phone: string): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[\s\-()+]/g, '');
  if (phone.startsWith('+')) return phone.replace(/[\s\-()]/g, '');
  if (/^\d{10}$/.test(cleaned)) return `+91${cleaned}`;
  if (/^\d{12}$/.test(cleaned)) return `+${cleaned}`;
  return null;
}
