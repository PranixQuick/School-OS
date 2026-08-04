import { describe, it, expect, vi } from 'vitest';

// Replicated resolveRecipients logic from supabase/functions/notifications-dispatcher/index.ts
// so we can test it in node context.
async function resolveRecipientsMock(supabase: any, row: any): Promise<any[]> {
  const module = row.module ?? '';

  if (module === 'attendance' || row.type === 'attendance_alert') {
    if (!row.reference_id) return [];
    if (row.title.toLowerCase().includes('teacher')) {
      const { data, error } = await supabase
        .from('staff').select('phone, name')
        .eq('school_id', row.school_id).eq('is_active', true)
        .in('role', ['principal', 'admin_staff']);
      if (error) return [];
      return (data ?? []).filter((r: any) => r.phone).map((r: any) => ({ phone: r.phone, name: r.name }));
    } else {
      const { data: parent } = await supabase
        .from('parents').select('phone, name')
        .eq('id', row.reference_id).eq('school_id', row.school_id).maybeSingle();
      if (!parent?.phone) return [];
      return [{ phone: parent.phone, name: parent.name }];
    }
  }

  if (module === 'leave' || row.type === 'leave_status') {
    if (!row.reference_id) return [];
    if (row.title.toLowerCase().includes('new leave')) {
      const { data, error } = await supabase
        .from('staff').select('phone, name')
        .eq('school_id', row.school_id).eq('is_active', true)
        .in('role', ['principal', 'admin_staff']);
      if (error) return [];
      return (data ?? []).filter((r: any) => r.phone).map((r: any) => ({ phone: r.phone, name: r.name }));
    } else {
      const { data: leaveReq } = await supabase
        .from('leave_requests').select('staff_id')
        .eq('id', row.reference_id).maybeSingle();
      if (!leaveReq?.staff_id) return [];
      const { data: staff } = await supabase
        .from('staff').select('phone, name')
        .eq('id', leaveReq.staff_id).eq('school_id', row.school_id).maybeSingle();
      if (!staff?.phone) return [];
      return [{ phone: staff.phone, name: staff.name }];
    }
  }

  if (module === 'fees' || row.type === 'fee_reminder') {
    if (!row.reference_id) return [];
    if (row.title.toLowerCase().includes('payment received')) {
      const { data, error } = await supabase
        .from('staff').select('phone, name')
        .eq('school_id', row.school_id).eq('is_active', true)
        .in('role', ['admin', 'accountant', 'principal']);
      if (error) return [];
      return (data ?? []).filter((r: any) => r.phone).map((r: any) => ({ phone: r.phone, name: r.name }));
    } else {
      const { data: fee } = await supabase
        .from('fees').select('student_id')
        .eq('id', row.reference_id).eq('school_id', row.school_id).maybeSingle();
      if (!fee?.student_id) return [];
      const { data: parents } = await supabase
        .from('parents').select('phone, name')
        .eq('student_id', fee.student_id).eq('school_id', row.school_id).not('phone', 'is', null);
      return (parents ?? []).filter((p: any) => p.phone).map((p: any) => ({ phone: p.phone, name: p.name }));
    }
  }

  if (module === 'complaints') {
    if (!row.reference_id) return [];
    if (row.title.toLowerCase().includes('new parent') || row.title.toLowerCase().includes('escalated')) {
      const { data, error } = await supabase
        .from('staff').select('phone, name')
        .eq('school_id', row.school_id).eq('is_active', true)
        .in('role', ['admin', 'principal', 'admin_staff']);
      if (error) return [];
      return (data ?? []).filter((r: any) => r.phone).map((r: any) => ({ phone: r.phone, name: r.name }));
    } else {
      const { data: comp } = await supabase
        .from('parent_complaints').select('parent_phone')
        .eq('id', row.reference_id).maybeSingle();
      if (!comp) return [];
      const { data: p } = await supabase
        .from('parents').select('phone, name')
        .eq('phone', comp.parent_phone).eq('school_id', row.school_id).maybeSingle();
      if (!p?.phone) return [];
      return [{ phone: p.phone, name: p.name }];
    }
  }

  if (module === 'substitute') {
    if (!row.reference_id) return [];
    const { data: assignment } = await supabase
      .from('substitute_assignments').select('substitute_staff_id')
      .eq('id', row.reference_id).maybeSingle();
    if (!assignment?.substitute_staff_id) return [];
    const { data: staff } = await supabase
      .from('staff').select('phone, name')
      .eq('id', assignment.substitute_staff_id).eq('school_id', row.school_id).maybeSingle();
    if (!staff?.phone) return [];
    return [{ phone: staff.phone, name: staff.name }];
  }

  return [];
}

describe('EdProSys Notifications Dispatcher Recipient Routing Tests', () => {
  it('1. Attendance: teacher late check-in routes to principal & admin_staff', async () => {
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                in: () => Promise.resolve({
                  data: [
                    { phone: '+919999999990', name: 'Principal Reddy' },
                    { phone: '+919999999991', name: 'Admin Staff' }
                  ],
                  error: null
                })
              })
            })
          })
        };
      })
    };

    const row = {
      school_id: 'school-123',
      type: 'alert',
      title: 'Teacher late check-in',
      module: 'attendance',
      reference_id: 'event-123'
    };

    const recipients = await resolveRecipientsMock(mockSupabase, row);
    expect(recipients).toHaveLength(2);
    expect(recipients[0].name).toBe('Principal Reddy');
    expect(recipients[1].phone).toBe('+919999999991');
  });

  it('2. Leave: Principal decision routes to requesting teacher', async () => {
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'leave_requests') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: { staff_id: 'staff-789' } })
              })
            })
          };
        }
        if (table === 'staff') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: { phone: '+918888888888', name: 'Teacher Swathi' } })
                })
              })
            })
          };
        }
      })
    };

    const row = {
      school_id: 'school-123',
      type: 'leave_status',
      title: 'Leave request Approved',
      module: 'leave',
      reference_id: 'leave-123'
    };

    const recipients = await resolveRecipientsMock(mockSupabase, row);
    expect(recipients).toHaveLength(1);
    expect(recipients[0].name).toBe('Teacher Swathi');
    expect(recipients[0].phone).toBe('+918888888888');
  });

  it('3. Fees: parent payment received alert routes to accountants & admins', async () => {
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                in: () => Promise.resolve({
                  data: [
                    { phone: '+917777777777', name: 'Accountant Srinivasan' }
                  ],
                  error: null
                })
              })
            })
          })
        };
      })
    };

    const row = {
      school_id: 'school-123',
      type: 'fee_reminder',
      title: 'Fee payment received',
      module: 'fees',
      reference_id: 'fee-123'
    };

    const recipients = await resolveRecipientsMock(mockSupabase, row);
    expect(recipients).toHaveLength(1);
    expect(recipients[0].name).toBe('Accountant Srinivasan');
  });

  it('4. Complaints: parent resolution alert routes to parent', async () => {
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'parent_complaints') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: { parent_phone: '+916666666666' } })
              })
            })
          };
        }
        if (table === 'parents') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: { phone: '+916666666666', name: 'Parent Varma' } })
                })
              })
            })
          };
        }
      })
    };

    const row = {
      school_id: 'school-123',
      type: 'system',
      title: 'Your complaint has been resolved',
      module: 'complaints',
      reference_id: 'comp-123'
    };

    const recipients = await resolveRecipientsMock(mockSupabase, row);
    expect(recipients).toHaveLength(1);
    expect(recipients[0].name).toBe('Parent Varma');
    expect(recipients[0].phone).toBe('+916666666666');
  });

  it('5. Substitute: teacher assignment alert routes to substitute teacher', async () => {
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'substitute_assignments') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: { substitute_staff_id: 'sub-456' } })
              })
            })
          };
        }
        if (table === 'staff') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: { phone: '+915555555555', name: 'Sub Teacher' } })
                })
              })
            })
          };
        }
      })
    };

    const row = {
      school_id: 'school-123',
      type: 'alert',
      title: 'Substitute duty assigned',
      module: 'substitute',
      reference_id: 'sub-assignment-123'
    };

    const recipients = await resolveRecipientsMock(mockSupabase, row);
    expect(recipients).toHaveLength(1);
    expect(recipients[0].name).toBe('Sub Teacher');
    expect(recipients[0].phone).toBe('+915555555555');
  });
});
