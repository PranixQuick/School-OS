import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '../../app/api/teacher-eval/route';
import { NextRequest } from 'next/server';

const { mockGetSession, mockSupabaseClient, mockCallClaude } = vi.hoisted(() => {
  const mockGetSession = vi.fn();
  const mockCallClaude = vi.fn();
  const queryBuilder: any = {
    select: vi.fn(() => queryBuilder),
    eq: vi.fn(() => queryBuilder),
    is: vi.fn(() => queryBuilder),
    order: vi.fn(() => queryBuilder),
    single: vi.fn(),
    insert: vi.fn(() => queryBuilder),
    update: vi.fn(() => queryBuilder),
    upload: vi.fn(),
    getPublicUrl: vi.fn(() => ({ publicUrl: 'https://storage/recording.mp3' })),
    then: vi.fn((resolve) => resolve({ data: [], error: null })),
  };

  const mockSupabaseClient = {
    from: vi.fn(() => queryBuilder),
    storage: {
      from: vi.fn(() => queryBuilder),
    },
  };
  return { mockGetSession, mockSupabaseClient, mockCallClaude };
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

vi.mock('@/lib/claudeClient', () => {
  return {
    callClaude: mockCallClaude,
  };
});

vi.mock('@/lib/tenant-lookup', () => {
  return {
    getInstitutionForSchool: vi.fn().mockResolvedValue({ institution_id: 'inst-123' }),
  };
});

describe('Teacher AI Evaluation Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET returns teacher evaluations successfully', async () => {
    mockGetSession.mockResolvedValue({
      schoolId: 'school-123',
      userId: 'teacher-789',
      userName: 'Test Teacher',
      userRole: 'teacher',
    });

    const mockRecordings = [
      {
        id: 'rec-1',
        file_name: 'class_oct12.mp3',
        coaching_score: 8,
        status: 'done',
        uploaded_at: '2026-10-12T10:00:00Z',
        eval_report: JSON.stringify({
          score: 8,
          feedback: 'Excellent class structure.',
        }),
      },
    ];

    // Mock query builder execution for recordings select
    const selectBuilder = mockSupabaseClient.from('recordings');
    const selectSpy = vi.spyOn(selectBuilder, 'then');
    selectSpy.mockImplementation((resolve: any) => {
      resolve({ data: mockRecordings, error: null });
      return Promise.resolve({ data: mockRecordings, error: null }) as any;
    });

    const req = new NextRequest(new URL('http://localhost/api/teacher-eval'));
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.evals).toBeDefined();
    expect(data.evals.length).toBe(1);
    expect(data.evals[0].file_name).toBe('class_oct12.mp3');
    expect(data.evals[0].eval_report).toBe('Excellent class structure.');
  });

  it('POST rejects if OPENAI_API_KEY is missing', async () => {
    mockGetSession.mockResolvedValue({
      schoolId: 'school-123',
      userId: 'teacher-789',
    });

    const originalKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    try {
      const req = new NextRequest(new URL('http://localhost/api/teacher-eval'), {
        method: 'POST',
      });
      const res = await POST(req);
      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.error).toContain('requires OpenAI Whisper');
    } finally {
      process.env.OPENAI_API_KEY = originalKey;
    }
  });
});
