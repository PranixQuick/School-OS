// fee-sms-dispatch (v9): MSG91 SMS for fee receipts, reminders + login credentials.
// v9: login_credentials now uses the DLT-approved EDPROSYSAPPLOGINPIN template
//     (MSG91 id 6a4124860fea2fb0a30cb933, DLT 1707178265058412379) with TWO variables —
//     var1=student_name, var2=pin. The role variable was dropped (DLT rejected the earlier
//     'purpose not clear' 3-var wording). Content:
//       "Dear Parent, your EdProSys school app login PIN for ##var1## is ##var2##. Use it to
//        sign in and view fees, attendance and notices. -PRANIX"
// v8: wired credentials template id as default fallback.
// v7: adds type 'login_credentials'; parent recipient resolved WITHOUT the marketing opt-out filter.
// v5: success only when MSG91 body type=='success'; raw response captured in dispatch_log.error.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DISPATCH_SECRET = Deno.env.get("DISPATCH_SECRET") ?? "";
const AUTHKEY = Deno.env.get("MSG91_AUTHKEY") ?? "";
const TPL_RECEIPT = Deno.env.get("MSG91_SMS_RECEIPT_TEMPLATE_ID") ?? "6a40a9966915563bad0e6a22";
const TPL_REMINDER = Deno.env.get("MSG91_SMS_REMINDER_TEMPLATE_ID") ?? "6a40aae591946fc4510ff6e3";
const TPL_CREDENTIALS = Deno.env.get("MSG91_SMS_CREDENTIALS_TEMPLATE_ID") ?? "6a4124860fea2fb0a30cb933";
const BATCH = Math.max(1, Math.min(50, parseInt(Deno.env.get("FEE_SMS_BATCH") ?? "20", 10) || 20));

const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

function normMobile(p: string | null): string | null {
  const d = (p ?? "").replace(/\D/g, "");
  if (d.length === 10) return "91" + d;
  if (d.length === 12 && d.startsWith("91")) return d;
  if (d.length === 11 && d.startsWith("0")) return "91" + d.slice(1);
  return d.length >= 10 ? d : null;
}
function mask(m: string | null): string { return m ? m.slice(0, 4) + "xxxxx" + m.slice(-2) : "<none>"; }
function amt(v: unknown): string { const n = Number(v); return Number.isFinite(n) ? String(Math.round(n)) : String(v ?? ""); }

function buildVars(type: string, tv: Record<string, unknown>): Record<string, string> | null {
  if (type === "fee_receipt")
    return { var1: amt(tv.amount), var2: String(tv.student_name ?? ""), var3: String(tv.receipt_no ?? "") };
  if (type === "fee_reminder")
    return { var1: amt(tv.amount), var2: String(tv.student_name ?? "") };
  if (type === "login_credentials")
    return { var1: String(tv.student_name ?? ""), var2: String(tv.pin ?? "") };
  return null;
}
function templateIdFor(type: string): string {
  if (type === "fee_receipt") return TPL_RECEIPT;
  if (type === "fee_reminder") return TPL_REMINDER;
  if (type === "login_credentials") return TPL_CREDENTIALS;
  return "";
}

async function sendSms(mobile: string, templateId: string, vars: Record<string, string>): Promise<{ ok: boolean; id?: string; error?: string }> {
  const body = { template_id: templateId, short_url: "0", recipients: [{ mobiles: mobile, ...vars }] };
  try {
    const r = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: { authkey: AUTHKEY, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
    });
    const t = await r.text();
    let j: any = null; try { j = JSON.parse(t); } catch { /* non-json */ }
    const success = r.ok && j && (j.type === "success");
    if (success) return { ok: true, id: String(j.message ?? j.request_id ?? "").slice(0, 80) };
    return { ok: false, error: ("MSG91 HTTP " + r.status + " body=" + t).slice(0, 300) };
  } catch (e) {
    return { ok: false, error: "fetch error: " + String(e).slice(0, 200) };
  }
}

Deno.serve(async (req) => {
  if (!DISPATCH_SECRET || req.headers.get("X-DISPATCH-SECRET") !== DISPATCH_SECRET) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
  }

  const { data: rows, error } = await db.from("notifications")
    .select("id, school_id, type, message, reference_id, attempts, template_vars")
    .in("type", ["fee_receipt", "fee_reminder", "login_credentials"])
    .eq("channel", "sms").eq("status", "pending").lt("attempts", 5)
    .order("created_at", { ascending: true }).limit(BATCH);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "content-type": "application/json" } });

  const summary = { claimed: (rows ?? []).length, sent: 0, skipped: 0, failed: 0 };

  for (const n of rows ?? []) {
    let pq = db.from("parents")
      .select("phone").eq("school_id", n.school_id).eq("student_id", n.reference_id)
      .not("phone", "is", null);
    if (n.type !== "login_credentials") pq = pq.eq("whatsapp_opted_out", false);
    const { data: parent } = await pq.order("created_at", { ascending: true }).limit(1).maybeSingle();

    const mobile = normMobile(parent?.phone ?? null);
    const tplId = templateIdFor(n.type);
    const vars = buildVars(n.type, (n.template_vars ?? {}) as Record<string, unknown>);

    let notifStatus = "skipped"; let logStatus = "skipped"; let err: string | null = null; let provId: string | null = null;
    if (!mobile) { err = "no parent phone"; }
    else if (!AUTHKEY || !tplId || !vars) { err = "dry_run (MSG91 key not configured for " + n.type + ")"; }
    else {
      const res = await sendSms(mobile, tplId, vars);
      if (res.ok) { notifStatus = "dispatched"; logStatus = "sent"; provId = res.id ?? null; summary.sent++; }
      else { notifStatus = "failed"; logStatus = "failed"; err = res.error ?? "send failed"; summary.failed++; }
    }
    if (notifStatus === "skipped") summary.skipped++;

    await db.from("notifications").update({
      status: notifStatus, attempts: (n.attempts ?? 0) + 1, last_attempt_at: new Date().toISOString(),
      dispatch_error: err, dispatched_at: notifStatus === "dispatched" ? new Date().toISOString() : null,
      whatsapp_message_sid: provId,
    }).eq("id", n.id);

    await db.from("dispatch_log").insert({
      notification_id: n.id, school_id: n.school_id, channel: "sms",
      recipient: mask(mobile), status: logStatus, provider: "msg91", provider_message_id: provId, error: err,
      attempted_at: new Date().toISOString(),
    });
  }

  return new Response(JSON.stringify(summary), { status: 200, headers: { "content-type": "application/json" } });
});
