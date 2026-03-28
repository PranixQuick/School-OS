// WhatsApp integration abstraction layer
// Currently in STUB mode — logs messages instead of sending
// To go live: replace sendWhatsApp() with Twilio/WATI/Gupshup SDK call

export interface WhatsAppMessage {
  to: string;        // phone number: +919876543210
  body: string;      // message text (max 1600 chars for WhatsApp)
  schoolName?: string;
}

export interface WhatsAppResult {
  success: boolean;
  messageId?: string;
  provider: string;
  error?: string;
}

// ─── Provider: Stub (logs only) ───────────────────────────────────────────────

async function sendViaStub(msg: WhatsAppMessage): Promise<WhatsAppResult> {
  // Simulate a brief network delay
  await new Promise(r => setTimeout(r, 50));

  console.log(`[WhatsApp STUB] TO: ${msg.to}`);
  console.log(`[WhatsApp STUB] MSG: ${msg.body.slice(0, 100)}...`);

  // Simulate 95% success rate for realistic testing
  if (Math.random() < 0.05) {
    return { success: false, provider: 'stub', error: 'Simulated network timeout' };
  }

  return {
    success: true,
    messageId: `stub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    provider: 'stub',
  };
}

// ─── Provider: Twilio (uncomment when credentials available) ──────────────────

// async function sendViaTwilio(msg: WhatsAppMessage): Promise<WhatsAppResult> {
//   const accountSid = process.env.TWILIO_ACCOUNT_SID!;
//   const authToken = process.env.TWILIO_AUTH_TOKEN!;
//   const fromNumber = process.env.TWILIO_WHATSAPP_FROM!; // whatsapp:+14155238886
//
//   const response = await fetch(
//     `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
//     {
//       method: 'POST',
//       headers: {
//         'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
//         'Content-Type': 'application/x-www-form-urlencoded',
//       },
//       body: new URLSearchParams({
//         From: fromNumber,
//         To: `whatsapp:${msg.to}`,
//         Body: msg.body,
//       }),
//     }
//   );
//   const data = await response.json() as { sid?: string; message?: string };
//   if (!response.ok) return { success: false, provider: 'twilio', error: data.message };
//   return { success: true, messageId: data.sid, provider: 'twilio' };
// }

// ─── Public API ───────────────────────────────────────────────────────────────

export async function sendWhatsApp(msg: WhatsAppMessage): Promise<WhatsAppResult> {
  const provider = process.env.WHATSAPP_PROVIDER ?? 'stub';

  try {
    switch (provider) {
      // case 'twilio': return await sendViaTwilio(msg);
      default:        return await sendViaStub(msg);
    }
  } catch (err) {
    return { success: false, provider, error: String(err) };
  }
}

// Validate and normalise phone number
export function normalisePhone(phone: string): string | null {
  if (!phone) return null;
  // Strip spaces, dashes, brackets
  const cleaned = phone.replace(/[\s\-()]/g, '');
  // Must start with + or be 10 digits
  if (cleaned.startsWith('+')) return cleaned;
  if (/^\d{10}$/.test(cleaned)) return `+91${cleaned}`;
  if (/^\d{12}$/.test(cleaned)) return `+${cleaned}`;
  return null;
}
