import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getMeal } from '../../app/api/admin/meal-attendance/route';
import { GET as getSummary } from '../../app/api/admin/meal-attendance/summary/route';
import { NextRequest } from 'next/server';

const { mockRequireAdminSession, mockSupabaseClient } = vi.hoisted(() => {
  const mockRequireAdminSession = vi.fn();
  const queryBuilder: any = {
    select: vi.fn(() => queryBuilder),
    eq: vi.fn(() => queryBuilder),
    is: vi.fn(() => queryBuilder),
    maybeSingle: vi.fn(),
    then: vi.fn((resolve) => resolve({ data: [], error: null })),
  };

  const mockSupabaseClient = {
    from: vi.fn(() => queryBuilder),
    rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
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

describe('Meal Attendance Local Date Fallbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/admin/meal-attendance defaults to local today date string', async () => {
    mockRequireAdminSession.mockResolvedValue({ schoolId: 'school-123' });

    const mockFeatureFlagQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { institutions: { feature_flags: { meal_tracking_enabled: true } } },
        error: null,
      }),
    };

    const fromSpy = vi.spyOn(mockSupabaseClient, 'from');
    fromSpy.mockImplementation((table: string) => {
      if (table === 'schools') return mockFeatureFlagQuery as any;
      if (table === 'students') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: vi.fn((resolve) => resolve({ data: [], error: null })),
        } as any;
      }
      return {} as any;
    });

    const req = new NextRequest(new URL('http://localhost/api/admin/meal-attendance'));
    const res = await getMeal(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    const d = new Date();
    const expectedLocalToday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(data.date).toBe(expectedLocalToday);
  });

  it('GET /api/admin/meal-attendance/summary defaults to local from/to date strings', async () => {
    mockRequireAdminSession.mockResolvedValue({ schoolId: 'school-123' });

    const mockFeatureFlagQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { institutions: { feature_flags: { meal_tracking_enabled: true } } },
        error: null,
      }),
    };

    const fromSpy = vi.spyOn(mockSupabaseClient, 'from');
    fromSpy.mockImplementation((table: string) => {
      if (table === 'schools') return mockFeatureFlagQuery as any;
      return {} as any;
    });

    const req = new NextRequest(new URL('http://localhost/api/admin/meal-attendance/summary'));
    const res = await getSummary(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    const d = new Date();
    const expectedLocalTo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(data.to).toBe(expectedLocalTo);
  });
});
