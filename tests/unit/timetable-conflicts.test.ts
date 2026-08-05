import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, PATCH } from '../../app/api/admin/timetable/route';
import { PUT } from '../../app/api/admin/timetable/[id]/route';
import { NextRequest } from 'next/server';

const { mockSupabaseClient, queryBuilder } = vi.hoisted(() => {
  const queryBuilder: any = {};
  queryBuilder.select = vi.fn(() => queryBuilder);
  queryBuilder.eq = vi.fn(() => queryBuilder);
  queryBuilder.order = vi.fn(() => queryBuilder);
  queryBuilder.insert = vi.fn(() => queryBuilder);
  queryBuilder.update = vi.fn(() => queryBuilder);
  queryBuilder.single = vi.fn(() => queryBuilder);
  queryBuilder.maybeSingle = vi.fn(() => queryBuilder);
  queryBuilder.then = vi.fn((resolve) => resolve({ data: null, error: null }));

  const mockSupabaseClient = {
    from: vi.fn(() => queryBuilder),
  };
  return { mockSupabaseClient, queryBuilder };
});

vi.mock('@/lib/supabaseClient', () => {
  return {
    supabaseAdmin: mockSupabaseClient,
  };
});

vi.mock('@/lib/admin-auth', () => {
  return {
    requireAdminSession: vi.fn().mockResolvedValue({ schoolId: 'school-123' }),
    AdminAuthError: class extends Error {
      status = 401;
    },
  };
});

const VALID_ID = '00000000-0000-0000-0000-000000000001';
const VALID_CLASS_ID = '00000000-0000-0000-0000-000000000002';
const VALID_SUBJECT_ID = '00000000-0000-0000-0000-000000000003';
const OTHER_SUBJECT_ID = '00000000-0000-0000-0000-000000000004';
const VALID_STAFF_ID = '00000000-0000-0000-0000-000000000005';

describe('Timetable Conflict Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/admin/timetable', () => {
    it('blocks genuine double-booking (different subject)', async () => {
      queryBuilder.then = vi.fn().mockImplementation((resolve) => {
        return resolve({
          data: [
            {
              class_id: VALID_CLASS_ID,
              subject_id: OTHER_SUBJECT_ID,
              start_time: '09:00',
              end_time: '10:00',
              classes: { grade_level: '11', section: 'A' },
            },
          ],
          error: null,
        });
      });

      const body = {
        class_id: VALID_CLASS_ID,
        subject_id: VALID_SUBJECT_ID,
        staff_id: VALID_STAFF_ID,
        day_of_week: 1,
        period: 1,
        start_time: '09:00',
        end_time: '10:00',
      };

      const req = new NextRequest('http://localhost/api/admin/timetable', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      const res = await POST(req);
      expect(res.status).toBe(409);
      const resData = await res.json();
      expect(resData.error).toContain('already assigned elsewhere');
    });

    it('allows legitimate shared-period (same subject and times)', async () => {
      const mockInserted = {
        id: 'slot-new',
        class_id: VALID_CLASS_ID,
        subject_id: VALID_SUBJECT_ID,
        staff_id: VALID_STAFF_ID,
        day_of_week: 1,
        period: 1,
        start_time: '09:00',
        end_time: '10:00',
      };

      let callCount = 0;
      queryBuilder.then = vi.fn().mockImplementation((resolve) => {
        callCount++;
        if (callCount === 1) {
          return resolve({
            data: [
              {
                class_id: VALID_CLASS_ID,
                subject_id: VALID_SUBJECT_ID,
                start_time: '09:00',
                end_time: '10:00',
                classes: { grade_level: '11', section: 'A' },
              },
            ],
            error: null,
          });
        } else {
          return resolve({
            data: mockInserted,
            error: null,
          });
        }
      });

      const body = {
        class_id: VALID_CLASS_ID,
        subject_id: VALID_SUBJECT_ID,
        staff_id: VALID_STAFF_ID,
        day_of_week: 1,
        period: 1,
        start_time: '09:00',
        end_time: '10:00',
      };

      const req = new NextRequest('http://localhost/api/admin/timetable', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      const res = await POST(req);
      expect(res.status).toBe(201);
      const resData = await res.json();
      expect(resData.shared_period_note).toBe('Sharing period with class 11-A');
    });
  });

  describe('PATCH /api/admin/timetable', () => {
    it('blocks genuine double-booking on update', async () => {
      const mockExisting = {
        id: VALID_ID,
        school_id: 'school-123',
        staff_id: VALID_STAFF_ID,
        day_of_week: 1,
        period: 1,
        subject_id: VALID_SUBJECT_ID,
        start_time: '09:00',
        end_time: '10:00',
      };

      let callCount = 0;
      queryBuilder.then = vi.fn().mockImplementation((resolve) => {
        callCount++;
        if (callCount === 1) {
          // fetchExisting query
          return resolve({ data: mockExisting, error: null });
        } else {
          // conflicts query: returns list with different subject
          return resolve({
            data: [
              {
                id: 'slot-other',
                class_id: VALID_CLASS_ID,
                subject_id: OTHER_SUBJECT_ID,
                start_time: '09:00',
                end_time: '10:00',
                classes: { grade_level: '11', section: 'A' },
              },
            ],
            error: null,
          });
        }
      });

      const body = {
        id: VALID_ID,
        subject_id: VALID_SUBJECT_ID,
      };

      const req = new NextRequest('http://localhost/api/admin/timetable', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });

      const res = await PATCH(req);
      expect(res.status).toBe(409);
      const resData = await res.json();
      expect(resData.error).toContain('already assigned elsewhere');
    });

    it('allows legitimate shared-period on update', async () => {
      const mockExisting = {
        id: VALID_ID,
        school_id: 'school-123',
        staff_id: VALID_STAFF_ID,
        day_of_week: 1,
        period: 1,
        subject_id: VALID_SUBJECT_ID,
        start_time: '09:00',
        end_time: '10:00',
      };

      const mockUpdated = {
        id: VALID_ID,
        school_id: 'school-123',
        staff_id: VALID_STAFF_ID,
        day_of_week: 1,
        period: 1,
        subject_id: VALID_SUBJECT_ID,
        start_time: '09:00',
        end_time: '10:00',
      };

      let callCount = 0;
      queryBuilder.then = vi.fn().mockImplementation((resolve) => {
        callCount++;
        if (callCount === 1) {
          // fetchExisting query
          return resolve({ data: mockExisting, error: null });
        } else if (callCount === 2) {
          // conflicts query: returns same subject/time
          return resolve({
            data: [
              {
                id: 'slot-other',
                class_id: VALID_CLASS_ID,
                subject_id: VALID_SUBJECT_ID,
                start_time: '09:00',
                end_time: '10:00',
                classes: { grade_level: '11', section: 'A' },
              },
            ],
            error: null,
          });
        } else {
          // update query
          return resolve({ data: mockUpdated, error: null });
        }
      });

      const body = {
        id: VALID_ID,
        subject_id: VALID_SUBJECT_ID,
      };

      const req = new NextRequest('http://localhost/api/admin/timetable', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });

      const res = await PATCH(req);
      expect(res.status).toBe(200);
      const resData = await res.json();
      expect(resData.shared_period_note).toBe('Sharing period with class 11-A');
    });
  });

  describe('PUT /api/admin/timetable/[id]', () => {
    it('blocks genuine double-booking on update', async () => {
      const mockExisting = {
        id: VALID_ID,
        school_id: 'school-123',
        class_id: VALID_CLASS_ID,
        staff_id: VALID_STAFF_ID,
        day_of_week: 1,
        period: 1,
        subject_id: VALID_SUBJECT_ID,
        start_time: '09:00',
        end_time: '10:00',
      };

      let callCount = 0;
      queryBuilder.then = vi.fn().mockImplementation((resolve) => {
        callCount++;
        if (callCount === 1) {
          // fetchExisting query
          return resolve({ data: mockExisting, error: null });
        } else {
          // conflicts query: returns list with different subject
          return resolve({
            data: [
              {
                id: 'slot-other',
                class_id: VALID_CLASS_ID,
                subject_id: OTHER_SUBJECT_ID,
                start_time: '09:00',
                end_time: '10:00',
                classes: { grade_level: '11', section: 'A' },
              },
            ],
            error: null,
          });
        }
      });

      const body = {
        subject_id: VALID_SUBJECT_ID,
      };

      const req = new NextRequest(`http://localhost/api/admin/timetable/${VALID_ID}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });

      const params = Promise.resolve({ id: VALID_ID });
      const res = await PUT(req, { params });
      expect(res.status).toBe(409);
      const resData = await res.json();
      expect(resData.error).toContain('already assigned elsewhere');
    });

    it('allows legitimate shared-period on update', async () => {
      const mockExisting = {
        id: VALID_ID,
        school_id: 'school-123',
        class_id: VALID_CLASS_ID,
        staff_id: VALID_STAFF_ID,
        day_of_week: 1,
        period: 1,
        subject_id: VALID_SUBJECT_ID,
        start_time: '09:00',
        end_time: '10:00',
      };

      const mockUpdated = {
        id: VALID_ID,
        school_id: 'school-123',
        class_id: VALID_CLASS_ID,
        staff_id: VALID_STAFF_ID,
        day_of_week: 1,
        period: 1,
        subject_id: VALID_SUBJECT_ID,
        start_time: '09:00',
        end_time: '10:00',
      };

      let callCount = 0;
      queryBuilder.then = vi.fn().mockImplementation((resolve) => {
        callCount++;
        if (callCount === 1) {
          // fetchExisting query
          return resolve({ data: mockExisting, error: null });
        } else if (callCount === 2) {
          // conflicts query: returns same subject/time
          return resolve({
            data: [
              {
                id: 'slot-other',
                class_id: VALID_CLASS_ID,
                subject_id: VALID_SUBJECT_ID,
                start_time: '09:00',
                end_time: '10:00',
                classes: { grade_level: '11', section: 'A' },
              },
            ],
            error: null,
          });
        } else {
          // update query
          return resolve({ data: mockUpdated, error: null });
        }
      });

      const body = {
        subject_id: VALID_SUBJECT_ID,
      };

      const req = new NextRequest(`http://localhost/api/admin/timetable/${VALID_ID}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });

      const params = Promise.resolve({ id: VALID_ID });
      const res = await PUT(req, { params });
      expect(res.status).toBe(200);
      const resData = await res.json();
      expect(resData.shared_period_note).toBe('Sharing period with class 11-A');
    });
  });
});
