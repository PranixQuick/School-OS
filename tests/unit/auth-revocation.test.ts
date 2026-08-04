import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSupabaseClient, mockUpsert, mockMaybeSingle, mockSingle } = vi.hoisted(() => {
  const mockUpsert = vi.fn();
  const mockMaybeSingle = vi.fn();
  const mockSingle = vi.fn();

  const queryBuilder: any = {
    select: vi.fn(() => queryBuilder),
    eq: vi.fn(() => queryBuilder),
    maybeSingle: mockMaybeSingle,
    single: mockSingle,
    upsert: mockUpsert,
  };

  const mockSupabaseClient = {
    from: vi.fn(() => queryBuilder),
  };

  return { mockSupabaseClient, mockUpsert, mockMaybeSingle, mockSingle };
});

vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => mockSupabaseClient),
  };
});

vi.mock('@/lib/supabaseClient', () => {
  return {
    supabaseAdmin: mockSupabaseClient,
  };
});

import { getParentSession, revokeParentSession, signParentSession } from '../../lib/parent-auth';
import { verifyStudentSession, revokeStudentSession, issueStudentSession } from '../../lib/student-auth';
import { verifyVendorSession, revokeVendorSession, issueVendorSession } from '../../lib/vendor-auth';
import { NextRequest } from 'next/server';

describe('Session Revocation Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsert.mockResolvedValue({ error: null });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockSingle.mockResolvedValue({ data: null, error: null });
  });

  it('Parent session revocation flow', async () => {
    const parentPayload = {
      parentId: 'parent-123',
      schoolId: 'school-456',
      studentId: 'student-789',
      phone: '+919999999999',
    };

    const token = await signParentSession(parentPayload);

    // Test Revocation (Writes to DB)
    await revokeParentSession(token, { reason: 'manual_logout', ip: '127.0.0.1' });
    expect(mockUpsert).toHaveBeenCalledWith(
      {
        user_id: 'parent-123',
        issued_at: expect.any(Number),
        reason: 'manual_logout',
        ip: '127.0.0.1',
      },
      { onConflict: 'user_id,issued_at', ignoreDuplicates: true }
    );

    // Test Verification (Not Revoked)
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const reqNormal = new NextRequest(new URL('http://localhost'), {
      headers: { Cookie: `parent_session=${token}` },
    });
    const sessionNormal = await getParentSession(reqNormal);
    expect(sessionNormal).not.toBeNull();
    expect(sessionNormal?.parentId).toBe('parent-123');

    // Test Verification (Revoked in DB)
    mockMaybeSingle.mockResolvedValue({ data: { id: 'revoked-row' }, error: null });
    const reqRevoked = new NextRequest(new URL('http://localhost'), {
      headers: { Cookie: `parent_session=${token}` },
    });
    const sessionRevoked = await getParentSession(reqRevoked);
    expect(sessionRevoked).toBeNull();
  });

  it('Student session revocation flow', async () => {
    const studentInfo = {
      id: 'student-123',
      name: 'Rohan',
      class: 'Class 5',
      section: 'A',
      school_id: 'school-456',
    };

    const token = await issueStudentSession(studentInfo);

    // Test Revocation (Writes to DB)
    await revokeStudentSession(token, { reason: 'student_logout' });
    expect(mockUpsert).toHaveBeenCalledWith(
      {
        user_id: 'student-123',
        issued_at: expect.any(Number),
        reason: 'student_logout',
        ip: null,
      },
      { onConflict: 'user_id,issued_at', ignoreDuplicates: true }
    );

    // Test Verification (Not Revoked)
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const sessionNormal = await verifyStudentSession(token);
    expect(sessionNormal).not.toBeNull();
    expect(sessionNormal?.studentId).toBe('student-123');

    // Test Verification (Revoked in DB)
    mockMaybeSingle.mockResolvedValue({ data: { id: 'revoked-row' }, error: null });
    const sessionRevoked = await verifyStudentSession(token);
    expect(sessionRevoked).toBeNull();
  });

  it('Vendor session revocation flow', async () => {
    const vendorInfo = {
      id: 'vendor-123',
      name: 'Canteen Services',
      school_id: 'school-456',
      institution_id: 'inst-789',
    };

    const token = await issueVendorSession(vendorInfo);

    // Test Revocation (Writes to DB)
    await revokeVendorSession(token);
    expect(mockUpsert).toHaveBeenCalledWith(
      {
        user_id: 'vendor-123',
        issued_at: expect.any(Number),
        reason: 'logout',
        ip: null,
      },
      { onConflict: 'user_id,issued_at', ignoreDuplicates: true }
    );

    // Test Verification (Not Revoked)
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const sessionNormal = await verifyVendorSession(token);
    expect(sessionNormal).not.toBeNull();
    expect(sessionNormal?.vendorId).toBe('vendor-123');

    // Test Verification (Revoked in DB)
    mockMaybeSingle.mockResolvedValue({ data: { id: 'revoked-row' }, error: null });
    const sessionRevoked = await verifyVendorSession(token);
    expect(sessionRevoked).toBeNull();
  });
});
