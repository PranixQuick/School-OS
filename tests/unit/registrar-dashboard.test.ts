import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../../app/api/registrar/dashboard/route';
import { NextRequest } from 'next/server';

const { mockGetSession, mockSupabaseClient } = vi.hoisted(() => {
  const mockGetSession = vi.fn();
  const queryBuilder: any = {
    select: vi.fn(() => queryBuilder),
    eq: vi.fn(() => queryBuilder),
    order: vi.fn(() => queryBuilder),
    limit: vi.fn(() => queryBuilder),
    then: vi.fn((resolve) => resolve({ status: 'fulfilled', value: { data: [], count: 0 } })),
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

describe('Registrar Dashboard Auth & Role Checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Rejects unauthenticated requests with 401', async () => {
    mockGetSession.mockResolvedValue(null);

    const req = new NextRequest(new URL('http://localhost/api/registrar/dashboard'));
    const res = await GET(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('Rejects disallowed roles (e.g. teacher) with 403', async () => {
    mockGetSession.mockResolvedValue({
      schoolId: 'school-123',
      userId: 'user-123',
      userRole: 'teacher',
    });

    const req = new NextRequest(new URL('http://localhost/api/registrar/dashboard'));
    const res = await GET(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('Forbidden');
  });

  it('Permits registrar role with 200', async () => {
    mockGetSession.mockResolvedValue({
      schoolId: 'school-123',
      userId: 'user-123',
      userRole: 'registrar',
    });

    const req = new NextRequest(new URL('http://localhost/api/registrar/dashboard'));
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total_enrolled).toBeDefined();
  });

  it('Permits admin role with 200', async () => {
    mockGetSession.mockResolvedValue({
      schoolId: 'school-123',
      userId: 'user-123',
      userRole: 'admin',
    });

    const req = new NextRequest(new URL('http://localhost/api/registrar/dashboard'));
    const res = await GET(req);
    expect(res.status).toBe(200);
  });
});
