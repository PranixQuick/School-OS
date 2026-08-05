import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireAdminSession, AdminAuthError } from '../../lib/admin-auth';
import { NextRequest } from 'next/server';

const { mockGetSession, mockSupabaseClient } = vi.hoisted(() => {
  const mockGetSession = vi.fn();
  const queryBuilder: any = {
    select: vi.fn(() => queryBuilder),
    eq: vi.fn(() => queryBuilder),
    maybeSingle: vi.fn(),
  };
  const mockSupabaseClient = {
    from: vi.fn(() => queryBuilder),
  };
  return { mockGetSession, mockSupabaseClient };
});

vi.mock('@/lib/auth', () => {
  return {
    getSession: mockGetSession,
  };
});

vi.mock('@/lib/supabaseClient', () => {
  return {
    supabaseAdmin: mockSupabaseClient,
  };
});

describe('requireAdminSession authorization rules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows owner, principal, admin_staff, admin without path limits', async () => {
    mockGetSession.mockResolvedValue({
      schoolId: 'school-123',
      userId: 'user-123',
      userRole: 'admin',
      userEmail: 'admin@school.com',
    });

    const mockUserRecord = {
      id: 'school-user-123',
      staff_id: 'staff-123',
      is_active: true,
      staff: { designation: 'Admin Assistant' },
    };

    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: mockUserRecord, error: null }),
    } as any);

    const req = new NextRequest('http://localhost/api/admin/hostel');
    const ctx = await requireAdminSession(req);
    expect(ctx.userRole).toBe('admin');
    expect(ctx.schoolId).toBe('school-123');
  });

  it('allows hostel_admin access to /api/admin/hostel prefix', async () => {
    mockGetSession.mockResolvedValue({
      schoolId: 'school-123',
      userId: 'user-123',
      userRole: 'hostel_admin',
      userEmail: 'hostel@school.com',
    });

    const mockUserRecord = {
      id: 'school-user-123',
      staff_id: 'staff-123',
      is_active: true,
      staff: null,
    };

    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: mockUserRecord, error: null }),
    } as any);

    const req = new NextRequest('http://localhost/api/admin/hostel');
    const ctx = await requireAdminSession(req);
    expect(ctx.userRole).toBe('hostel_admin');
  });

  it('blocks hostel_admin access to non-hostel routes (e.g., /api/admin/staff)', async () => {
    mockGetSession.mockResolvedValue({
      schoolId: 'school-123',
      userId: 'user-123',
      userRole: 'hostel_admin',
      userEmail: 'hostel@school.com',
    });

    const mockUserRecord = {
      id: 'school-user-123',
      staff_id: 'staff-123',
      is_active: true,
      staff: null,
    };

    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: mockUserRecord, error: null }),
    } as any);

    const req = new NextRequest('http://localhost/api/admin/staff');
    await expect(requireAdminSession(req)).rejects.toThrowError(AdminAuthError);
  });

  it('blocks non-admin roles (e.g., teacher) from requireAdminSession', async () => {
    mockGetSession.mockResolvedValue({
      schoolId: 'school-123',
      userId: 'user-123',
      userRole: 'teacher',
      userEmail: 'teacher@school.com',
    });

    const req = new NextRequest('http://localhost/api/admin/hostel');
    await expect(requireAdminSession(req)).rejects.toThrowError(AdminAuthError);
  });
});
