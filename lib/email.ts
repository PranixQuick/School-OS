// lib/email.ts — Resend live, stub fallback

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
  htmlBody?: string;
  from?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  provider: string;
  error?: string;
}

// ─── Resend ───────────────────────────────────────────────────────────────────

async function sendViaResend(msg: EmailMessage): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY!;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: msg.from ?? 'EdProSys <noreply@edprosys.com>',
      to: [msg.to],
      subject: msg.subject,
      text: msg.body,
      html: msg.htmlBody ?? `<p>${msg.body.replace(/\n/g, '<br>')}</p>`,
    }),
  });

  const data = await res.json() as { id?: string; message?: string; error?: { message: string } };
  if (!res.ok) {
    const errMsg = data.error?.message ?? data.message ?? `HTTP ${res.status}`;
    return { success: false, provider: 'resend', error: errMsg };
  }
  return { success: true, messageId: data.id, provider: 'resend' };
}

// ─── Stub ─────────────────────────────────────────────────────────────────────

async function sendViaStub(msg: EmailMessage): Promise<EmailResult> {
  await new Promise(r => setTimeout(r, 30));
  console.log(`[Email STUB] TO: ${msg.to} | SUBJECT: ${msg.subject}`);
  return { success: true, messageId: `stub_email_${Date.now()}`, provider: 'stub' };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function sendEmail(msg: EmailMessage): Promise<EmailResult> {
  const provider = process.env.EMAIL_PROVIDER ?? 'stub';
  try {
    switch (provider) {
      case 'resend': return await sendViaResend(msg);
      default:       return await sendViaStub(msg);
    }
  } catch (err) {
    return { success: false, provider, error: String(err) };
  }
}

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
  <div style="padding:12px 24px;background:#0F172A;text-align:center;font-size:11px;color:#94A3B8;margin-top:24px;">
    EdProSys &middot; Powering Institutions. Empowering Futures.
    <span style="margin:0 8px;opacity:0.4">&middot;</span>
    edprosys.com
    <span style="margin:0 8px;opacity:0.4">&middot;</span>
    Pranix AI Labs Pvt Ltd
  </div>
</body>
</html>`;
}
