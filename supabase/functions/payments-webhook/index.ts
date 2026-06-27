// ============================================================================
// EdProSys edge function (PROPOSAL) — payments-webhook  [PR-3]
// Verify gateway signature -> idempotency -> append immutable ledger row ->
// reconcile to fee. Secrets via Doppler -> Vercel/Supabase env. DO NOT deploy
// until credential rotation (Gate G1) is complete. Founder merges only.
// Pattern mirrors the existing VidyaGrid HMAC webhook verification.
// ============================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";
import { createHmac, timingSafeEqual } from "node:crypto";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;        // rotated set only
const RZP_WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET")!;     // rotated set only

const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

function verify(rawBody: string, signature: string): boolean {
  const expected = createHmac("sha256", RZP_WEBHOOK_SECRET).update(rawBody).digest("hex");
  try { return timingSafeEqual(Buffer.from(expected), Buffer.from(signature)); }
  catch { return false; }
}

Deno.serve(async (req) => {
  const raw = await req.text();
  const sig = req.headers.get("x-razorpay-signature") ?? "";
  if (!verify(raw, sig)) return new Response("invalid signature", { status: 401 });

  const event = JSON.parse(raw);
  const eventId: string = event.id ?? event?.payload?.payment?.entity?.id;
  const payment = event?.payload?.payment?.entity;
  if (!payment) return new Response("no payment entity", { status: 400 });

  // 1) idempotency at the edge
  const { error: dupErr } = await db.from("payment_webhook_events")
    .insert({ provider: "razorpay", provider_event_id: eventId });
  if (dupErr) return new Response("duplicate (already processed)", { status: 200 });

  // 2) map gateway status -> ledger status
  const statusMap: Record<string, string> = {
    "payment.captured": "captured", "payment.authorized": "authorized",
    "payment.failed": "failed", "refund.processed": "refunded",
  };
  const status = statusMap[event.event] ?? "created";

  // notes carry our linkage set at create-order time
  const feeId = payment.notes?.fee_id ?? null;
  const schoolId = payment.notes?.school_id ?? null;
  const studentId = payment.notes?.student_id ?? null;

  // 3) append immutable ledger row (insert-only; unique idx blocks double-post)
  const { data: txn, error: insErr } = await db.from("payment_transactions").insert({
    school_id: schoolId, student_id: studentId, fee_id: feeId,
    gateway: "razorpay", gateway_order_id: payment.order_id,
    gateway_payment_id: payment.id, gateway_signature: sig,
    amount_minor: payment.amount, currency: payment.currency ?? "INR",
    method: payment.method, status, raw_payload: event,
    idempotency_key: payment.id,
  }).select().single();
  if (insErr && !String(insErr.message).includes("duplicate")) {
    return new Response("ledger insert failed: " + insErr.message, { status: 500 });
  }

  // 4) reconcile only on captured (idempotent, partial-aware, tenant-safe)
  if (status === "captured" && feeId) {
    await reconcile(feeId, schoolId, payment.amount, txn?.id);
  }
  // 5) (PR-4) enqueue receipt dispatch here.
  return new Response("ok", { status: 200 });
});

async function reconcile(feeId: string, schoolId: string, paidMinor: number, txnId?: string) {
  const { data: fee } = await db.from("fees")
    .select("id, amount, amount_paid_minor, school_id, status")
    .eq("id", feeId).single();
  if (!fee || fee.school_id !== schoolId) return;            // tenant safety
  const dueMinor = Math.round(Number(fee.amount) * 100);
  const newPaid = (fee.amount_paid_minor ?? 0) + paidMinor;
  const status = newPaid >= dueMinor ? "paid" : "partial";  // 'partial' = live fees_status_check value
  await db.from("fees").update({
    amount_paid_minor: newPaid, status,
    paid_date: status === "paid" ? new Date().toISOString().slice(0, 10) : fee.paid_date,
    payment_verified_at: new Date().toISOString(),
    payment_reference: txnId ?? fee.payment_reference, payment_method: "online",
  }).eq("id", feeId);
  if (txnId) await db.from("payment_allocations")
    .insert({ transaction_id: txnId, fee_id: feeId, amount_minor: Math.min(paidMinor, dueMinor) });
}
