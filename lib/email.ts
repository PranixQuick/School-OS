// Email integration abstraction layer
// STUB mode: logs to console. To go live, set EMAIL_PROVIDER=resend|smtp and add credentials.

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;       // plain text
  htmlBody?: string;  // optional HTML version
  from?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  provider: string;
  error?: string;
}

// ─── Provider: Stub ───────────────────────────────────────────────────────────

async function sendViaStub(msg: EmailMessage): Promise<EmailResult> {
  await new Promise(r => setTimeout(r, 30));

  console.log(`[Email STUB] TO: ${msg.to}`);
  console.log(`[Email STUB] SUBJECT: ${msg.subject}`);
  console.log(`[Email STUB] BODY: ${msg.body.slice(0, 120)}...`);

  return {
    success: true,
    messageId: `stub_email_${Date.now()}`,
    provider: 'stub',
  };
}

// ─── Provider: Resend (uncomment when API key available) ──────────────────────

// async function sendViaResend(msg: EmailMessage): Promise<EmailResult> {
//   const apiKey = process.env.RESEND_API_KEY!;
//   const res = await fetch('https://api.resend.com/emails', {
//     method: 'POST',
//     headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
//     body: JSON.stringify({
//       from: msg.from ?? 'noreply@schoolos.app',
//       to: [msg.to],
//       subject: msg.subject,
//       text: msg.body,
//       html: msg.htmlBody ?? `<p>${msg.body.replace(/\n/g, '<br>')}</p>`,
//     }),
//   });
//   const data = await res.json() as { id?: string; message?: string };
//   if (!res.ok) return { success: false, provider: 'resend', error: data.message };
//   return { success: true, messageId: data.id, provider: 'resend' };
// }

// ─── Public API ───────────────────────────────────────────────────────────────

export async function sendEmail(msg: EmailMessage): Promise<EmailResult> {
  const provider = process.env.EMAIL_PROVIDER ?? 'stub';

  try {
    switch (provider) {
      // case 'resend': return await sendViaResend(msg);
      default:        return await sendViaStub(msg);
    }
  } catch (err) {
    return { success: false, provider, error: String(err) };
  }
}

// Build a clean HTML email from plain text
export function buildEmailHtml(params: {
  schoolName: string;
  title: string;
  body: string;
  footer?: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F9FAFB;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #E5E7EB;">
    <div style="background:#4F46E5;padding:20px 24px;">
      <div style="color:#fff;font-size:18px;font-weight:700;">${params.schoolName}</div>
    </div>
    <div style="padding:24px;">
      <h2 style="font-size:16px;color:#111827;margin:0 0 12px;">${params.title}</h2>
      <p style="color:#374151;font-size:14px;line-height:1.7;white-space:pre-wrap;">${params.body}</p>
    </div>
    ${params.footer ? `<div style="padding:16px 24px;background:#F9FAFB;border-top:1px solid #E5E7EB;font-size:12px;color:#9CA3AF;">${params.footer}</div>` : ''}
  </div>
</body>
</html>`;
}
