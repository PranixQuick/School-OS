// DISABLED 2026-06-27. Superseded by the access-gated in-app route POST /api/parent/pay
// (requires a valid parent session; Razorpay keys never reach the client).
// This unauthenticated build-phase edge function is closed. The deployed function
// now requires verify_jwt and returns 410 Gone. Kept as a tombstone in repo history.
Deno.serve(() => new Response(
  JSON.stringify({ error: "gone", detail: "payments-create-order is disabled. Use /api/parent/pay (authenticated)." }),
  { status: 410, headers: { "content-type": "application/json" } },
));
