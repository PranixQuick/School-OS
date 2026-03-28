// lib/whatsapp.ts — Twilio live, stub fallback

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

// ─── Stub ─────────────────────────────────────────────────────────────────────

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

export async function sendWhatsApp(msg: WhatsAppMessage): Promise<WhatsAppResult> {
  const provider = process.env.WHATSAPP_PROVIDER ?? 'stub';
  try {
    switch (provider) {
      case 'twilio': return await sendViaTwilio(msg);
      default:       return await sendViaStub(msg);
    }
  } catch (err) {
    return { success: false, provider, error: String(err) };
  }
}

export function normalisePhone(phone: string): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[\s\-()+]/g, '');
  // Already has country code
  if (phone.startsWith('+')) return phone.replace(/[\s\-()]/g, '');
  // 10-digit Indian number
  if (/^\d{10}$/.test(cleaned)) return `+91${cleaned}`;
  // 12-digit with country code (no +)
  if (/^\d{12}$/.test(cleaned)) return `+${cleaned}`;
  return null;
}
