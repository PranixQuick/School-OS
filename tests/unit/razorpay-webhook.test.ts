import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../../app/api/webhooks/razorpay/route';
import { NextRequest } from 'next/server';

const { mockSupabaseClient } = vi.hoisted(() => {
  const queryBuilder: any = {
    select: vi.fn(() => queryBuilder),
    eq: vi.fn(() => queryBuilder),
    maybeSingle: vi.fn(),
    update: vi.fn(() => queryBuilder),
    single: vi.fn(),
    then: vi.fn((resolve) => resolve({ data: null, error: null })),
  };

  const mockSupabaseClient = {
    from: vi.fn(() => queryBuilder),
  };
  return { mockSupabaseClient };
});

vi.mock('@/lib/supabaseClient', () => {
  return {
    supabaseAdmin: mockSupabaseClient,
  };
});

vi.mock('@/lib/receipt', () => {
  return {
    allocateReceiptNumber: vi.fn().mockResolvedValue('REC-1001'),
  };
});

vi.mock('crypto', () => {
  return {
    createHmac: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue('mock-signature'),
    })),
    timingSafeEqual: vi.fn(() => true),
  };
});

describe('Razorpay Webhook Partial Payments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RAZORPAY_PLATFORM_KEY_SECRET = 'test-secret';
  });

  it('updates status to partial and sets correct amount_paid_minor when fee is not fully paid', async () => {
    const mockFee = {
      id: 'fee-123',
      status: 'pending',
      school_id: 'school-123',
      amount: 100, // ₹100 = 10000 paise
      amount_paid_minor: 0,
    };

    const fromSpy = vi.spyOn(mockSupabaseClient, 'from');

    const mockQueryChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: mockFee, error: null }),
      update: vi.fn().mockReturnThis(),
      then: vi.fn((resolve) => resolve({ data: null, error: null })),
    };

    fromSpy.mockReturnValue(mockQueryChain as any);

    const eventPayload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_999',
            amount: 4000, // ₹40 = 4000 paise
            notes: {
              fee_id: 'fee-123',
              school_id: 'school-123',
            },
          },
        },
      },
    };

    const req = new NextRequest(new URL('http://localhost/api/webhooks/razorpay'), {
      method: 'POST',
      headers: {
        'x-razorpay-signature': 'mock-signature',
      },
      body: JSON.stringify(eventPayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockQueryChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'partial',
        amount_paid_minor: 4000,
        payment_reference: 'pay_999',
      })
    );
  });

  it('updates status to paid and sets correct amount_paid_minor when fee is fully paid', async () => {
    const mockFee = {
      id: 'fee-123',
      status: 'partial',
      school_id: 'school-123',
      amount: 100, // ₹100 = 10000 paise
      amount_paid_minor: 4000,
    };

    const fromSpy = vi.spyOn(mockSupabaseClient, 'from');

    const mockQueryChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: mockFee, error: null }),
      update: vi.fn().mockReturnThis(),
      then: vi.fn((resolve) => resolve({ data: null, error: null })),
    };

    fromSpy.mockReturnValue(mockQueryChain as any);

    const eventPayload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_1000',
            amount: 6000, // ₹60 = 6000 paise
            notes: {
              fee_id: 'fee-123',
              school_id: 'school-123',
            },
          },
        },
      },
    };

    const req = new NextRequest(new URL('http://localhost/api/webhooks/razorpay'), {
      method: 'POST',
      headers: {
        'x-razorpay-signature': 'mock-signature',
      },
      body: JSON.stringify(eventPayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockQueryChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'paid',
        amount_paid_minor: 10000,
        payment_reference: 'pay_1000',
      })
    );
  });
});
