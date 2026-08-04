import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../../app/api/admin/vidya-grid/sync/route';
import { NextRequest } from 'next/server';

const { mockRequireAdminSession, mockSupabaseClient, mockEnrollStudent } = vi.hoisted(() => {
  const mockRequireAdminSession = vi.fn();
  const mockEnrollStudent = vi.fn();
  const queryBuilder: any = {
    select: vi.fn(() => queryBuilder),
    eq: vi.fn(() => queryBuilder),
    is: vi.fn(() => queryBuilder),
    in: vi.fn(() => queryBuilder),
    limit: vi.fn(() => queryBuilder),
    update: vi.fn(() => queryBuilder),
    maybeSingle: vi.fn(),
    then: vi.fn((resolve) => resolve({ data: [], error: null, count: 5 })),
  };

  const mockSupabaseClient = {
    from: vi.fn(() => queryBuilder),
  };
  return { mockRequireAdminSession, mockSupabaseClient, mockEnrollStudent };
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

vi.mock('@/lib/vidya-grid', () => {
  return {
    vidyaGridConfigured: vi.fn(() => ({ ok: true, missing: [] })),
    enrollStudentInVidyaGrid: mockEnrollStudent,
  };
});

describe('VidyaGrid Sync Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST syncs eligible students and maps plan, board, and language', async () => {
    mockRequireAdminSession.mockResolvedValue({ schoolId: 'school-123' });

    // Mock school select
    const schoolMockData = {
      id: 'school-123',
      vidya_grid_school_id: 'vg-school-999',
      plan: 'premium',
      settings: {
        language: 'te',
        board: 'SCERT-AP',
      },
      institution_id: null,
    };

    const studentsMockData = [
      {
        id: 'student-abc',
        name: 'Arjun Reddy',
        class: '9',
        parent_name: 'Srinivas Reddy',
        phone_parent: '9999999999',
      },
    ];

    const fromSpy = vi.spyOn(mockSupabaseClient, 'from');

    // Setup mock query responses sequence
    const mockSchoolQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: schoolMockData, error: null }),
    };

    const mockStudentsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      then: vi.fn((resolve) => resolve({ data: studentsMockData, error: null })),
    };

    const mockUpdateQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      then: vi.fn((resolve) => resolve({ data: [{ id: 'student-abc' }], error: null })),
    };

    const mockRemainingQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      then: vi.fn((resolve) => resolve({ count: 12, error: null })),
    };

    fromSpy.mockImplementation((table: string) => {
      if (table === 'schools') return mockSchoolQuery as any;
      if (table === 'students') {
        // Distinguish between select list query and count query
        // Or between select update query
        return {
          select: vi.fn().mockImplementation((proj: string, opts?: any) => {
            if (opts && opts.count === 'exact') {
              return mockRemainingQuery;
            }
            return mockStudentsQuery;
          }),
          update: vi.fn().mockReturnValue(mockUpdateQuery),
        } as any;
      }
      return {} as any;
    });

    mockEnrollStudent.mockResolvedValue({
      ok: true,
      status: 200,
      student_id: 'vg-user-777',
      erp_student_id: 'student-abc',
    });

    const req = new NextRequest(new URL('http://localhost/api/admin/vidya-grid/sync'), {
      method: 'POST',
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.processed).toBe(1);
    expect(data.linked).toBe(1);
    expect(data.remaining_eligible_unlinked).toBe(12);

    expect(mockEnrollStudent).toHaveBeenCalledWith({
      erp_student_id: 'student-abc',
      school_id: 'vg-school-999',
      student_name: 'Arjun Reddy',
      class_level: '9',
      parent_name: 'Srinivas Reddy',
      parent_contact: '9999999999',
      board: 'SCERT-AP',
      language: 'te',
      plan: 'paid', // 'premium' mapped to 'paid'
    });
  });
});
