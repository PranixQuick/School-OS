import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PATCH } from '../../app/api/admin/rte/applications/[id]/admit/route';
import { POST } from '../../app/api/admin/rte/config/route';
import { NextRequest } from 'next/server';

const { mockRequireAdminSession, mockSupabaseClient } = vi.hoisted(() => {
  const mockRequireAdminSession = vi.fn();
  const queryBuilder: any = {
    select: vi.fn(() => queryBuilder),
    eq: vi.fn(() => queryBuilder),
    is: vi.fn(() => queryBuilder),
    update: vi.fn(() => queryBuilder),
    insert: vi.fn(() => queryBuilder),
    upsert: vi.fn(() => queryBuilder),
    maybeSingle: vi.fn(),
    single: vi.fn(),
    then: vi.fn((resolve) => resolve({ data: null, error: null })),
  };

  const mockSupabaseClient = {
    from: vi.fn(() => queryBuilder),
  };
  return { mockRequireAdminSession, mockSupabaseClient };
});

vi.mock('@/lib/admin-auth', () => {
  return {
    requireAdminSession: mockRequireAdminSession,
    AdminAuthError: class AdminAuthError extends Error {
      status: number;
      constructor(message: string, status: number) {
        super(message);
        this.status = status;
      }
    },
  };
});

vi.mock('@/lib/supabaseClient', () => {
  return {
    supabaseAdmin: mockSupabaseClient,
  };
});

describe('RTE Admissions and Quota', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST config accepts and uses custom rte_seats', async () => {
    mockRequireAdminSession.mockResolvedValue({ schoolId: 'school-123' });

    const mockFeatureFlagQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { institutions: { feature_flags: { rte_mode_enabled: true } } },
        error: null,
      }),
    };

    const mockConfigUpsertQuery = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'cfg-1', total_seats: 100, rte_seats: 10 },
        error: null,
      }),
    };

    const fromSpy = vi.spyOn(mockSupabaseClient, 'from');
    fromSpy.mockImplementation((table: string) => {
      if (table === 'schools') return mockFeatureFlagQuery as any;
      if (table === 'rte_seat_config') return mockConfigUpsertQuery as any;
      return {} as any;
    });

    const req = new NextRequest(new URL('http://localhost/api/admin/rte/config'), {
      method: 'POST',
      body: JSON.stringify({
        total_seats: 100,
        academic_year_id: 'year-2026',
        rte_seats: 10, // custom quota (10% instead of 25%)
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.config.rte_seats).toBe(10);
    expect(mockConfigUpsertQuery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        total_seats: 100,
        rte_seats: 10,
      }),
      expect.any(Object)
    );
  });

  it('PATCH admit rejects when RTE seat config capacity is already full', async () => {
    mockRequireAdminSession.mockResolvedValue({ schoolId: 'school-123' });

    const mockApp = {
      id: 'app-777',
      status: 'lottery_selected',
      academic_year_id: 'year-2026',
      applicant_name: 'Test Child',
    };

    const mockSeatConfig = {
      entry_class: 'Class 1',
      rte_seats: 5,
      rte_seats_filled: 5, // Full!
    };

    const fromSpy = vi.spyOn(mockSupabaseClient, 'from');

    const mockAppQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: mockApp, error: null }),
    };

    const mockSeatConfigQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: mockSeatConfig, error: null }),
    };

    fromSpy.mockImplementation((table: string) => {
      if (table === 'rte_applications') return mockAppQuery as any;
      if (table === 'rte_seat_config') return mockSeatConfigQuery as any;
      return {} as any;
    });

    const req = new NextRequest(new URL('http://localhost/api/admin/rte/applications/app-777/admit'), {
      method: 'PATCH',
      body: JSON.stringify({ confirmed: true }),
    });

    const paramsPromise = Promise.resolve({ id: 'app-777' });
    const res = await PATCH(req, { params: paramsPromise });
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain('RTE seat capacity is already full');
  });
});
