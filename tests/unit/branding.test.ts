import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '../../app/api/admin/schools/branding/route';
import { NextRequest } from 'next/server';

const { mockRequireAdminSession, mockSupabaseClient } = vi.hoisted(() => {
  const mockRequireAdminSession = vi.fn();
  const queryBuilder: any = {
    select: vi.fn(() => queryBuilder),
    eq: vi.fn(() => queryBuilder),
    single: vi.fn(() => Promise.resolve({ data: { logo_url: 'https://test.logo' }, error: null })),
    update: vi.fn(() => Promise.resolve({ error: null })),
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
    }
  };
});

vi.mock('@/lib/supabaseClient', () => {
  return {
    supabaseAdmin: mockSupabaseClient,
  };
});

describe('Branding GET/POST endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET returns school branding info when authenticated as admin', async () => {
    mockRequireAdminSession.mockResolvedValue({ schoolId: 'school-123' });

    const req = new NextRequest(new URL('http://localhost/api/admin/schools/branding'));
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.branding.logo_url).toBe('https://test.logo');
  });

  it('GET returns 404 when database error occurs', async () => {
    mockRequireAdminSession.mockResolvedValue({ schoolId: 'school-123' });
    mockSupabaseClient.from().single.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

    const req = new NextRequest(new URL('http://localhost/api/admin/schools/branding'));
    const res = await GET(req);
    expect(res.status).toBe(404);
  });
});
