import { describe, it, expect, afterEach } from 'vitest';
import { generateCode, maskPhone, isOtpEnabled, hashCode, verifyCodeHash } from '../../lib/otp';

const ENV_KEYS = ['OTP_ENABLED', 'MSG91_AUTH_KEY', 'MSG91_OTP_TEMPLATE_ID'] as const;

function snapshotEnv() {
  const snap: Record<string, string | undefined> = {};
  for (const k of ENV_KEYS) snap[k] = process.env[k];
  return snap;
}
function restoreEnv(snap: Record<string, string | undefined>) {
  for (const k of ENV_KEYS) {
    if (snap[k] === undefined) delete process.env[k];
    else process.env[k] = snap[k];
  }
}

describe('otp pure helpers', () => {
  const snap = snapshotEnv();
  afterEach(() => restoreEnv(snap));

  it('generateCode returns a 6-digit numeric string', () => {
    for (let i = 0; i < 50; i++) {
      const c = generateCode();
      expect(c).toMatch(/^\d{6}$/);
    }
  });

  it('maskPhone hides the middle digits', () => {
    expect(maskPhone('+919876543210')).toBe('+9****10');
    expect(maskPhone('123')).toBe('****');
    expect(maskPhone('')).toBe('****');
  });

  it('isOtpEnabled is false unless flag is "true" AND keys present', () => {
    delete process.env.OTP_ENABLED;
    delete process.env.MSG91_AUTH_KEY;
    delete process.env.MSG91_OTP_TEMPLATE_ID;
    expect(isOtpEnabled()).toBe(false);

    process.env.OTP_ENABLED = 'true';
    expect(isOtpEnabled()).toBe(false); // keys still missing

    process.env.MSG91_AUTH_KEY = 'k';
    process.env.MSG91_OTP_TEMPLATE_ID = 't';
    expect(isOtpEnabled()).toBe(true);

    process.env.OTP_ENABLED = 'false';
    expect(isOtpEnabled()).toBe(false); // flag off => disabled
  });

  it('hashCode + verifyCodeHash roundtrip', async () => {
    const code = generateCode();
    const hash = await hashCode(code);
    expect(hash).not.toBe(code);
    expect(await verifyCodeHash(code, hash)).toBe(true);
    expect(await verifyCodeHash('000000', hash)).toBe(false);
    expect(await verifyCodeHash(code, null)).toBe(false);
  });
});
