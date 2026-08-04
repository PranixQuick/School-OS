import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../../app/api/billing/webhook/route';
import { createHmac } from 'crypto';

const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null })
    })
  })
});

vi.mock('../../lib/supabaseClient', () => ({
  supabaseAdmin: {
    from: vi.fn().mockImplementation(() => ({
      update: mockUpdate
    }))
  }
}));

describe('Billing Webhook API Tests', () => {
  const SECRET = 'test_webhook_secret_key';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;
    process.env.NODE_ENV = 'production';
  });

  it('rejects invalid signature with 401', async () => {
    const body = JSON.stringify({ event: 'payment.captured' });
    const req = new NextRequest('https://school-os.edu/api/billing/webhook', {
      method: 'POST',
      headers: {
        'x-razorpay-signature': 'invalid_sig'
      },
      body
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('invalid signature');
  });

  it('accepts valid signature and upgrades school plan & limits', async () => {
    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            order_id: 'order_123',
            id: 'pay_123',
            status: 'captured',
            notes: {
              school_id: 'school_abc',
              requested_plan: 'growth'
            }
          }
        }
      }
    };
    const rawBody = JSON.stringify(payload);
    const signature = createHmac('sha256', SECRET).update(rawBody).digest('hex');

    const req = new NextRequest('https://school-os.edu/api/billing/webhook', {
      method: 'POST',
      headers: {
        'x-razorpay-signature': signature
      },
      body: rawBody
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.plan).toBe('growth');
    expect(mockUpdate).toHaveBeenCalled();
  });
});
