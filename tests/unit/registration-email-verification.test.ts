import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Registration email verification ("Option B", founder decision 18 Aug 2026).
//
// The property under test: when an email provider IS configured, registering an
// institution must NOT hand the caller working credentials for an address they
// have not proven they control. Before this change the response body contained
// login.password, so anyone could register naming someone else's email and read
// that person's password straight out of the JSON.
//
// Every assertion below fails against the previous implementation.

const { mockSupabaseClient, sendEmailMock } = vi.hoisted(() => {
  const mockSupabaseClient = {
    from: vi.fn(),
    auth: {
      admin: {
        createUser: vi.fn(),
        generateLink: vi.fn(),
        listUsers: vi.fn(),
        updateUserById: vi.fn(),
        deleteUser: vi.fn(),
      },
    },
  };
  const sendEmailMock = vi.fn();
  return { mockSupabaseClient, sendEmailMock };
});

vi.mock('@/lib/supabaseClient', () => ({ supabaseAdmin: mockSupabaseClient }));
vi.mock('@/lib/email', () => ({
  sendEmail: sendEmailMock,
  buildEmailHtml: (p: { body: string }) => `<html>${p.body}</html>`,
}));

import { POST } from '../../app/api/schools/create/route';

const ACTION_LINK = 'https://example.supabase.co/auth/v1/verify?token=abc&type=invite';

function wireTables() {
  const inserted: Record<string, unknown[]> = {};
  mockSupabaseClient.from.mockImplementation((table: string) => {
    const q: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn(),
      insert: vi.fn((payload: unknown) => {
        (inserted[table] ??= []).push(payload);
        return q;
      }),
      then: vi.fn((resolve: (v: unknown) => unknown) => resolve({ data: {}, error: null })),
    };
    if (table === 'organisations') q.single = vi.fn().mockResolvedValue({ data: { id: 'org-1' }, error: null });
    if (table === 'institutions') q.single = vi.fn().mockResolvedValue({ data: { id: 'inst-1' }, error: null });
    if (table === 'schools') {
      q.single = vi.fn().mockResolvedValue({
        data: { id: 'school-1', name: 'Verified High', slug: 'verified-high', plan: 'free' },
        error: null,
      });
    }
    return q;
  });
  return inserted;
}

function request(email = 'principal@verifiedhigh.edu.in') {
  return new NextRequest('http://localhost/api/schools/create', {
    method: 'POST',
    body: JSON.stringify({
      school_name: 'Verified High',
      admin_email: email,
      admin_name: 'A Principal',
      institution_type: 'school_k10',
      ownership_type: 'private',
    }),
  });
}

const savedProvider = process.env.EMAIL_PROVIDER;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.EMAIL_PROVIDER = 'resend';
});

afterEach(() => {
  if (savedProvider === undefined) delete process.env.EMAIL_PROVIDER;
  else process.env.EMAIL_PROVIDER = savedProvider;
});

describe('registration email verification — provider configured', () => {
  it('never returns a password, and says verification is required', async () => {
    wireTables();
    mockSupabaseClient.auth.admin.generateLink.mockResolvedValue({
      data: { user: { id: 'auth-1' }, properties: { action_link: ACTION_LINK } },
      error: null,
    });
    sendEmailMock.mockResolvedValue({ success: true, provider: 'resend', messageId: 'm1' });

    const res = await POST(request());
    expect(res.status).toBe(200);
    const body = await res.json();

    // The whole point.
    expect(body.login.password).toBeUndefined();
    expect(JSON.stringify(body)).not.toMatch(/password"\s*:\s*"[A-Za-z0-9_-]{20,}/);

    expect(body.verification.required).toBe(true);
    expect(body.verification.email_sent).toBe(true);
    expect(body.login.active).toBe(false);
    expect(body.login.awaiting_email_verification).toBe(true);
  });

  it('provisions via the invite flow, not createUser', async () => {
    wireTables();
    mockSupabaseClient.auth.admin.generateLink.mockResolvedValue({
      data: { user: { id: 'auth-1' }, properties: { action_link: ACTION_LINK } },
      error: null,
    });
    sendEmailMock.mockResolvedValue({ success: true, provider: 'resend' });

    await POST(request());

    expect(mockSupabaseClient.auth.admin.generateLink).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'invite', email: 'principal@verifiedhigh.edu.in' })
    );
    expect(mockSupabaseClient.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it('emails the activation link to the registered address', async () => {
    wireTables();
    mockSupabaseClient.auth.admin.generateLink.mockResolvedValue({
      data: { user: { id: 'auth-1' }, properties: { action_link: ACTION_LINK } },
      error: null,
    });
    sendEmailMock.mockResolvedValue({ success: true, provider: 'resend' });

    await POST(request());

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const msg = sendEmailMock.mock.calls[0][0];
    expect(msg.to).toBe('principal@verifiedhigh.edu.in');
    expect(msg.body).toContain(ACTION_LINK);
  });

  it('records the owner as unverified until the link is opened', async () => {
    const inserted = wireTables();
    mockSupabaseClient.auth.admin.generateLink.mockResolvedValue({
      data: { user: { id: 'auth-1' }, properties: { action_link: ACTION_LINK } },
      error: null,
    });
    sendEmailMock.mockResolvedValue({ success: true, provider: 'resend' });

    await POST(request());

    const userRow = (inserted['school_users'] ?? [])[0] as Record<string, unknown>;
    expect(userRow).toBeTruthy();
    expect(userRow.auth_verified).toBe(false);
    expect(userRow.invite_status).toBe('pending');
  });

  it('fails the registration if the activation email cannot be delivered', async () => {
    wireTables();
    mockSupabaseClient.auth.admin.generateLink.mockResolvedValue({
      data: { user: { id: 'auth-1' }, properties: { action_link: ACTION_LINK } },
      error: null,
    });
    sendEmailMock.mockResolvedValue({ success: false, provider: 'resend', error: 'domain not verified' });

    const res = await POST(request());

    // An account nobody can reach is worse than no account.
    expect(res.status).toBe(502);
    expect(mockSupabaseClient.auth.admin.deleteUser).toHaveBeenCalledWith('auth-1');
  });
});

describe('registration email verification — no provider configured', () => {
  beforeEach(() => {
    delete process.env.EMAIL_PROVIDER;
  });

  it('falls back to the previous behaviour rather than blocking signup', async () => {
    wireTables();
    mockSupabaseClient.auth.admin.createUser.mockResolvedValue({
      data: { user: { id: 'auth-1' } },
      error: null,
    });

    const res = await POST(request());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.verification.required).toBe(false);
    expect(typeof body.login.password).toBe('string');
    expect(mockSupabaseClient.auth.admin.generateLink).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
