// ============================================================================
// EdProSys edge function (PROPOSAL) — payments-create-order  [PR-2]
// Auth caller -> validate fee + amount -> create gateway order -> return order.
// Secrets via Doppler. DO NOT deploy until Gate G1 (rotation). Founder merges.
// ============================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RZP_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID")!;
const RZP_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET")!;

const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  // TODO: enforce caller auth (parent of student) consistent with app authz +
  // reconciled role vocabulary (Gate G3). Reject if not the linked parent.
  const { fee_id, school_id } = await req.json();
  if (!fee_id || !school_id) return new Response("fee_id, school_id required", { status: 400 });

  // server-side amount of record (never trust client amount)
  const { data: fee, error } = await db.from("fees")
    .select("id, amount, amount_paid_minor, student_id, school_id, status")
    .eq("id", fee_id).eq("school_id", school_id).single();
  if (error || !fee) return new Response("fee not found", { status: 404 });
  if (["paid", "refunded"].includes(fee.status)) return new Response("not collectable", { status: 409 });

  const dueMinor = Math.round(Number(fee.amount) * 100) - (fee.amount_paid_minor ?? 0);
  if (dueMinor <= 0) return new Response("nothing due", { status: 409 });   // zero-fee safety

  // create gateway order (gateway-hosted checkout -> PCI SAQ-A; no card data here)
  const auth = "Basic " + btoa(`${RZP_KEY_ID}:${RZP_KEY_SECRET}`);
  const r = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify({
      amount: dueMinor, currency: "INR", receipt: `fee_${fee_id}`,
      notes: { fee_id, school_id, student_id: fee.student_id }, // echoed back in webhook
    }),
  });
  if (!r.ok) return new Response("gateway order failed", { status: 502 });
  const order = await r.json();

  // optimistic 'created' ledger row (immutable; captured row appended later)
  await db.from("payment_transactions").insert({
    school_id, student_id: fee.student_id, fee_id, gateway: "razorpay",
    gateway_order_id: order.id, amount_minor: dueMinor, currency: "INR", status: "created",
  });

  return new Response(JSON.stringify({ order_id: order.id, amount: dueMinor, key_id: RZP_KEY_ID }),
    { headers: { "Content-Type": "application/json" } });
});
