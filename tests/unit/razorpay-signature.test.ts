// tests/unit/razorpay-signature.test.ts
// Phase D — D2: Unit test for Razorpay signature verification.
// Tests the HMAC-SHA256 verification logic from lib/razorpay-verify.ts.
// Does NOT require live Razorpay credentials — uses known test values.
//
// Skip condition: if RAZORPAY_PLATFORM_KEY_SECRET is set in env (live key present),
// tests still run using the computed values — the secret env var is NOT used in tests.
// Per PDF: skip gracefully if RAZORPAY_PLATFORM_KEY_ID is not set.

import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import { verifyRazorpaySignature } from '../../lib/razorpay-verify';

// Skip all tests if Razorpay integration is not configured
// (avoids false failures in environments without the key)
const SKIP = !process.env.RAZORPAY_PLATFORM_KEY_ID && process.env.CI === 'true';

describe.skipIf(SKIP)('verifyRazorpaySignature', () => {
  const TEST_SECRET = 'test_secret_key_for_unit_testing';
  const ORDER_ID    = 'order_test_123456';
  const PAYMENT_ID  = 'pay_test_789012';

  // Compute the correct expected signature for use in tests
  const VALID_SIGNATURE = createHmac('sha256', TEST_SECRET)
    .update(`${ORDER_ID}|${PAYMENT_ID}`)
    .digest('hex');

  it('returns true for a valid signature', () => {
    expect(
      verifyRazorpaySignature(ORDER_ID, PAYMENT_ID, VALID_SIGNATURE, TEST_SECRET)
    ).toBe(true);
  });

  it('returns false for a tampered signature', () => {
    const tampered = VALID_SIGNATURE.replace(/.$/, 'x'); // flip last char
    expect(
      verifyRazorpaySignature(ORDER_ID, PAYMENT_ID, tampered, TEST_SECRET)
    ).toBe(false);
  });

  it('returns false for a completely wrong signature', () => {
    expect(
      verifyRazorpaySignature(ORDER_ID, PAYMENT_ID, 'bad_signature_value', TEST_SECRET)
    ).toBe(false);
  });

  it('returns false when order_id is wrong', () => {
    const sigWithWrongOrder = createHmac('sha256', TEST_SECRET)
      .update(`wrong_order_id|${PAYMENT_ID}`)
      .digest('hex');
    // This sig was computed with wrong order_id, so verifying with correct order_id should fail
    expect(
      verifyRazorpaySignature(ORDER_ID, PAYMENT_ID, sigWithWrongOrder, TEST_SECRET)
    ).toBe(false);
  });

  it('returns false when payment_id is wrong', () => {
    const sigWithWrongPayment = createHmac('sha256', TEST_SECRET)
      .update(`${ORDER_ID}|wrong_payment_id`)
      .digest('hex');
    expect(
      verifyRazorpaySignature(ORDER_ID, PAYMENT_ID, sigWithWrongPayment, TEST_SECRET)
    ).toBe(false);
  });

  it('returns false for empty signature', () => {
    expect(
      verifyRazorpaySignature(ORDER_ID, PAYMENT_ID, '', TEST_SECRET)
    ).toBe(false);
  });

  it('returns false for empty secret', () => {
    expect(
      verifyRazorpaySignature(ORDER_ID, PAYMENT_ID, VALID_SIGNATURE, '')
    ).toBe(false);
  });
});
