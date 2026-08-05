import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../../app/api/schools/create/route';
import { NextRequest } from 'next/server';

const { mockSupabaseClient } = vi.hoisted(() => {
  const queryBuilder: any = {
    select: vi.fn(() => queryBuilder),
    eq: vi.fn(() => queryBuilder),
    insert: vi.fn(() => queryBuilder),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn((resolve) => resolve({ data: null, error: null })),
  };

  const mockSupabaseClient = {
    from: vi.fn(() => queryBuilder),
    auth: {
      admin: {
        createUser: vi.fn(),
        listUsers: vi.fn(),
        updateUserById: vi.fn(),
      },
    },
  };
  return { mockSupabaseClient };
});

vi.mock('@/lib/supabaseClient', () => {
  return {
    supabaseAdmin: mockSupabaseClient,
  };
});

describe('POST /api/schools/create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists school with institution_type: intermediate_college and sets higher-ed flags', async () => {
    const mockOrg = { id: 'org-123' };
    const mockInst = { id: 'inst-123' };
    const mockSchool = { id: 'school-123', name: 'Staging College', slug: 'staging-college', plan: 'free' };
    const mockAuthUser = { user: { id: 'auth-user-123' } };

    const fromSpy = vi.spyOn(mockSupabaseClient, 'from');
    const insertSpy = vi.fn().mockReturnThis();
    
    // We mock sequential calls to different tables
    fromSpy.mockImplementation((table: string) => {
      const q: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        insert: insertSpy,
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        single: vi.fn(),
      };

      if (table === 'organisations') {
        q.single = vi.fn().mockResolvedValue({ data: mockOrg, error: null });
      } else if (table === 'institutions') {
        q.single = vi.fn().mockResolvedValue({ data: mockInst, error: null });
      } else if (table === 'schools') {
        q.single = vi.fn().mockResolvedValue({ data: mockSchool, error: null });
      } else if (table === 'school_users') {
        q.then = vi.fn((resolve) => resolve({ data: {}, error: null }));
      } else if (table === 'owner_profiles') {
        q.then = vi.fn((resolve) => resolve({ data: {}, error: null }));
      }
      return q as any;
    });

    vi.spyOn(mockSupabaseClient.auth.admin, 'createUser').mockResolvedValue({
      data: mockAuthUser,
      error: null,
    } as any);

    const body = {
      school_name: 'Staging College',
      admin_email: 'admin@stagingcollege.edu.in',
      admin_name: 'Admin Name',
      institution_type: 'intermediate_college',
      ownership_type: 'private',
    };

    const req = new NextRequest('http://localhost/api/schools/create', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const resData = await res.json();
    expect(resData.success).toBe(true);

    // Verify institutions insert arguments:
    // For intermediate_college, isHigherEd = true. Since ownership_type = private, feeModuleEnabled = true, scholarshipEnabled = false.
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        institution_type: 'intermediate_college',
        feature_flags: expect.objectContaining({
          fee_module_enabled: true,
          scholarship_tracking_enabled: false,
        }),
      })
    );
  });
});
