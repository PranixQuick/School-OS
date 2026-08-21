import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../../app/api/import/students/route';
import { NextRequest } from 'next/server';

const { mockGetSession, mockGetInstitutionForSchool, mockSupabaseAdmin } = vi.hoisted(() => {
  const mockGetSession = vi.fn();
  const mockGetInstitutionForSchool = vi.fn();

  const queryBuilder: any = {
    insert: vi.fn(() => queryBuilder),
    update: vi.fn(() => queryBuilder),
    select: vi.fn(() => queryBuilder),
    eq: vi.fn(() => queryBuilder),
    single: vi.fn(),
    then: vi.fn((resolve) => resolve({ data: null, error: null })),
  };

  const mockSupabaseAdmin = {
    from: vi.fn(() => queryBuilder),
  };

  return {
    mockGetSession,
    mockGetInstitutionForSchool,
    mockSupabaseAdmin,
  };
});

vi.mock('@/lib/auth', () => ({
  getSession: mockGetSession,
  logActivity: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logActivity: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('@/lib/tenant-lookup', () => ({
  getInstitutionForSchool: mockGetInstitutionForSchool,
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabaseAdmin: mockSupabaseAdmin,
}));

function createMockFormData(filename: string, content: string, size?: number) {
  const formData = new FormData();
  const file = new File([content], filename, { type: 'text/csv' });
  if (size !== undefined) {
    Object.defineProperty(file, 'size', { value: size });
  }
  formData.append('file', file);
  return formData;
}


describe('Student CSV Import Chaos Certification Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ schoolId: 'school-123', userRole: 'admin' });
    mockGetInstitutionForSchool.mockResolvedValue({
      institution_id: 'inst-123',
      academic_year_id: 'year-2026',
    });
  });

  it('rejects request when no session is present (Session Expiry)', async () => {
    mockGetSession.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/import/students', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('No session');
  });

  it('rejects when role lacks import permission (D-11)', async () => {
    mockGetSession.mockResolvedValue({ schoolId: 'school-123', userRole: 'teacher' });
    const req = new NextRequest('http://localhost/api/import/students', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('rejects when CSV file is missing', async () => {
    const req = new NextRequest('http://localhost/api/import/students', {
      method: 'POST',
      body: new FormData(),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('CSV file required');
  });

  it('rejects non-csv files (Malformed/Invalid Format)', async () => {
    const formData = createMockFormData('students.xlsx', 'name,class\nArjun,5');
    const req = new NextRequest('http://localhost/api/import/students', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Only CSV files accepted');
  });

  it('rejects files larger than 2MB (Large CSV / Size Boundary)', async () => {
    const largeContent = 'name,class\n' + 'a'.repeat(2.1 * 1024 * 1024); // 2.1MB
    const formData = createMockFormData('students.csv', largeContent);
    const req = new NextRequest('http://localhost/api/import/students', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('File too large. Max 2MB.');
  });


  it('rejects empty or header-only CSVs', async () => {
    const formData = createMockFormData('students.csv', 'name,class');
    const req = new NextRequest('http://localhost/api/import/students', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('No valid rows found');
  });

  it('imports valid rows, quarantines duplicates and malformed admission numbers', async () => {
    const csvContent = [
      'name,class,section,phone_parent,parent_name,roll_number,admission_number',
      'Asha Sharma,5,A,9999900001,Rajesh Sharma,10,2026/001',             // Valid Row 1
      'Bad Student,5,A,9999900002,Father,11,2026@XYZ',                     // Invalid Admission Number (Illegal char '@')
      'Duplicate Student,5,A,9999900003,Other,12,2026/001',                // Duplicate Admission Number (Conflicting with Row 1)
      'Rahul Kumar,5,A,9999900004,Suresh Kumar,13,2026/002',               // Valid Row 4
    ].join('\n');

    const formData = createMockFormData('students.csv', csvContent);

    // Mock import job creation
    const mockJob = { id: 'job-789' };
    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: mockJob, error: null }),
      }),
    });

    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const studentsInsertMock = vi.fn().mockResolvedValue({ error: null });

    vi.spyOn(mockSupabaseAdmin, 'from').mockImplementation((table: string) => {
      const q: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockJob, error: null }),
        then: vi.fn((resolve) => resolve({ data: mockJob, error: null })),
      };

      if (table === 'import_jobs') {
        return {
          insert: insertMock,
          update: updateMock,
        } as any;
      }
      if (table === 'students') {
        return {
          insert: studentsInsertMock,
        } as any;
      }
      return q;
    });

    const req = new NextRequest('http://localhost/api/import/students', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.total).toBe(4);
    expect(body.imported).toBe(2); // Asha Sharma and Rahul Kumar
    expect(body.failed).toBe(2);   // Bad Student and Duplicate Student

    // Verify correct calls were made to Supabase
    expect(studentsInsertMock).toHaveBeenCalledTimes(2);
    expect(studentsInsertMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      name: 'Asha Sharma',
      admission_number: '2026/001',
    }));
    expect(studentsInsertMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      name: 'Rahul Kumar',
      admission_number: '2026/002',
    }));

    // Verify import job finalization update
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      imported_rows: 2,
      failed_rows: 2,
      status: 'done',
    }));
  });

  it('handles network loss mid-operation gracefully (Try-Catch per row)', async () => {
    const csvContent = [
      'name,class,section,phone_parent,parent_name,roll_number,admission_number',
      'Row 1 Student,5,A,9999900001,Rajesh Sharma,10,2026/001',
      'Row 2 Student,5,A,9999900002,Father,11,2026/002',
    ].join('\n');

    const formData = createMockFormData('students.csv', csvContent);
    const mockJob = { id: 'job-789' };

    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const studentsInsertMock = vi.fn()
      .mockResolvedValueOnce({ error: null }) // Row 1 succeeds
      .mockRejectedValueOnce(new Error('Network connection lost')); // Row 2 throws network error

    vi.spyOn(mockSupabaseAdmin, 'from').mockImplementation((table: string) => {
      if (table === 'import_jobs') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockJob, error: null }),
            }),
          }),
          update: updateMock,
        } as any;
      }
      if (table === 'students') {
        return {
          insert: studentsInsertMock,
        } as any;
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockJob, error: null }),
        then: vi.fn((resolve) => resolve({ data: mockJob, error: null })),
      } as any;
    });

    const req = new NextRequest('http://localhost/api/import/students', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.total).toBe(2);
    expect(body.imported).toBe(1);
    expect(body.failed).toBe(1);
    expect(body.errors[0].error).toContain('Network connection lost');

    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      imported_rows: 1,
      failed_rows: 1,
      status: 'done',
    }));
  });

  it('handles concurrent duplicate writes gracefully via DB unique constraint violation', async () => {
    const csvContent = [
      'name,class,section,phone_parent,parent_name,roll_number,admission_number',
      'Row 1 Student,5,A,9999900001,Rajesh Sharma,10,2026/001',
    ].join('\n');

    const formData = createMockFormData('students.csv', csvContent);
    const mockJob = { id: 'job-789' };

    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    // DB throws unique constraint violation error (concurrency conflict)
    const studentsInsertMock = vi.fn().mockResolvedValueOnce({
      error: { message: 'duplicate key value violates unique constraint "students_school_admission_number_key"' },
    });

    vi.spyOn(mockSupabaseAdmin, 'from').mockImplementation((table: string) => {
      if (table === 'import_jobs') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockJob, error: null }),
            }),
          }),
          update: updateMock,
        } as any;
      }
      if (table === 'students') {
        return {
          insert: studentsInsertMock,
        } as any;
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockJob, error: null }),
        then: vi.fn((resolve) => resolve({ data: mockJob, error: null })),
      } as any;
    });

    const req = new NextRequest('http://localhost/api/import/students', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.total).toBe(1);
    expect(body.imported).toBe(0);
    expect(body.failed).toBe(1);
    expect(body.errors[0].error).toContain('duplicate key value violates unique constraint');

    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      imported_rows: 0,
      failed_rows: 1,
      status: 'done',
    }));
  });

  it('handles storage full or database failure during job creation cleanly', async () => {
    const csvContent = [
      'name,class,section,phone_parent,parent_name,roll_number,admission_number',
      'Row 1 Student,5,A,9999900001,Rajesh Sharma,10,2026/001',
    ].join('\n');

    const formData = createMockFormData('students.csv', csvContent);

    // DB throws error on job creation (e.g. disk full, lock acquired timeout, database offline)
    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: new Error('database disk space is full') }),
      }),
    });

    vi.spyOn(mockSupabaseAdmin, 'from').mockImplementation((table: string) => {
      if (table === 'import_jobs') {
        return {
          insert: insertMock,
        } as any;
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        then: vi.fn((resolve) => resolve({ data: null, error: null })),
      } as any;
    });

    const req = new NextRequest('http://localhost/api/import/students', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(req);
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.error).toContain('Failed to create import job');
  });
});

