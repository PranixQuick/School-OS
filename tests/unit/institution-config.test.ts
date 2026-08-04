import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PATCH } from '../../app/api/admin/institution-config/route';
import { NextRequest } from 'next/server';

const { mockRequireAdminSession, mockSupabaseClient } = vi.hoisted(() => {
  const mockRequireAdminSession = vi.fn();
  const queryBuilder: any = {
    select: vi.fn(() => queryBuilder),
    eq: vi.fn(() => queryBuilder),
    maybeSingle: vi.fn(),
    update: vi.fn(() => queryBuilder),
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

describe('Institution Config Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET returns settings for school without institution_id', async () => {
    mockRequireAdminSession.mockResolvedValue({ schoolId: 'school-123' });

    const mockSchool = {
      institution_id: null,
      name: 'Greenwood School',
      plan: 'premium',
      onboarded_at: '2026-08-01T10:00:00Z',
      settings: {
        institution_type: 'anganwadi',
        ownership_type: 'govt',
        feature_flags: { meal_tracking_enabled: true },
      },
    };

    const selectBuilder = mockSupabaseClient.from('schools');
    const maybeSingleSpy = vi.spyOn(selectBuilder, 'maybeSingle');
    maybeSingleSpy.mockResolvedValue({ data: mockSchool, error: null } as any);

    const req = new NextRequest(new URL('http://localhost/api/admin/institution-config'));
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.institution_type).toBe('anganwadi');
    expect(data.feature_flags.meal_tracking_enabled).toBe(true);
  });

  it('PATCH updates school settings JSONB when institution_id is null', async () => {
    mockRequireAdminSession.mockResolvedValue({ schoolId: 'school-123' });

    const mockSchool = {
      institution_id: null,
      settings: {
        institution_type: 'school_k12',
      },
    };

    const schoolsFromSpy = vi.spyOn(mockSupabaseClient, 'from');
    // First query: select school
    const mockSchoolSelectQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: mockSchool, error: null }),
      update: vi.fn().mockReturnThis(),
      then: vi.fn((resolve) => resolve({ data: null, error: null })),
    };
    schoolsFromSpy.mockReturnValue(mockSchoolSelectQuery as any);

    const req = new NextRequest(new URL('http://localhost/api/admin/institution-config'), {
      method: 'PATCH',
      body: JSON.stringify({
        institution_type: 'anganwadi',
        feature_flags_patch: { meal_tracking_enabled: true },
      }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    expect(mockSchoolSelectQuery.update).toHaveBeenCalledWith({
      settings: {
        institution_type: 'anganwadi',
        feature_flags: { meal_tracking_enabled: true },
      },
    });
  });
});
