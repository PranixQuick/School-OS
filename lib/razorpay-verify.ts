// lib/razorpay-verify.ts
// Phase D — D2: Extracted Razorpay signature verification helper.
// Previously inline in app/api/parent/fees/confirm-payment/route.ts.
// Extracted here so it can be unit-tested without spinning up Next.js.
//
// Razorpay signature spec:
//   expectedSig = HMAC-SHA256(razorpay_order_id + "|" + razorpay_payment_id, keySecret)
//   Signature is valid if expectedSig === razorpay_signature (constant-time compare)

import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verifies a Razorpay payment signature.
 * @param orderId   - razorpay_order_id from the payment response
 * @param paymentId - razorpay_payment_id from the payment response
 * @param signature - razorpay_signature from the payment response
 * @param secret    - RAZORPAY_PLATFORM_KEY_SECRET (server-side only)
 * @returns true if the signature is valid, false otherwise
 */
export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): boolean {
  try {
    const expected = createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    // Constant-time comparison to prevent timing attacks
    const expectedBuf = Buffer.from(expected, 'hex');
    const signatureBuf = Buffer.from(signature, 'hex');
    if (expectedBuf.length !== signatureBuf.length) return false;
    return timingSafeEqual(expectedBuf, signatureBuf);
  } catch {
    return false;
  }
}
