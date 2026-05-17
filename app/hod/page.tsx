'use client';
// app/hod/page.tsx — Head of Department portal
// HOD sees: their department staff, batches, and can record student attendance overview
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Department { id: string; code: string; name: string; hod_staff_id: string | null; }
interface StaffRow { id: string; name: string; role: string; email: string | null; department_id: string | null; }
interface Batch { id: string; label: string; entry_year: number | null; student_count: number; }

export default function HODPage() {
  const router = useRouter();
  const [dept, setDept] = useState<Department | null>(null);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [dR, sR, bR] = await Promise.all([
        fetch('/api/admin/departments'),
        fetch('/api/admin/staff'),
        fetch('/api/admin/batches'),
      ]);
      const [dD, sD, bD] = await Promise.all([dR.json(), sR.json(), bR.json()]);
      // HOD sees their own department — first active dept (in real flow, session has dept_id)
      const depts: Department[] = dD.departments ?? [];
      const staffList: StaffRow[] = sD.staff ?? [];
      const batchList: Batch[] = bD.batches ?? [];
      if (depts.length > 0) {
        const myDept = depts[0];
        setDept(myDept);
        setStaff(staffList.filter(s => s.department_id === myDept.id));
        setBatches(batchList);
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><div style={{ fontSize: 18, fontWeight: 800 }}>🏛 Department</div><div style={{ fontSize: 12, color: '#6B7280' }}>HOD Portal</div></div>
        <button onClick={() => { fetch('/api/auth/logout', { method: 'POST' }); router.push('/login'); }} style={{ padding: '6px 12px', border: '1px solid #E5E7EB', borderRadius: 7, background: '#fff', fontSize: 12, cursor: 'pointer' }}>Sign out</button>
      </div>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: 20 }}>
        {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>Loading...</div> : !dept ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>No department assigned. Contact admin.</div>
        ) : (
          <>
            <div style={{ background: '#4F46E5', borderRadius: 12, padding: 20, color: '#fff', marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.7, marginBottom: 4 }}>YOUR DEPARTMENT</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{dept.name}</div>
              <div style={{ fontSize: 14, opacity: 0.8, marginTop: 4 }}>{dept.code}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#4F46E5' }}>{staff.length}</div>
                <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600, marginTop: 2 }}>FACULTY IN DEPT</div>
              </div>
              <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#0891B2' }}>{batches.length}</div>
                <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600, marginTop: 2 }}>ACTIVE BATCHES</div>
              </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Faculty</div>
              {staff.length === 0 ? <div style={{ color: '#9CA3AF', fontSize: 13 }}>No faculty assigned to this department.</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {staff.map(s => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#F9FAFB', borderRadius: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                        {s.email && <div style={{ fontSize: 11, color: '#6B7280' }}>{s.email}</div>}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, background: '#E0E7FF', color: '#3730A3', padding: '2px 8px', borderRadius: 5 }}>{s.role}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Batches</div>
              {batches.length === 0 ? <div style={{ color: '#9CA3AF', fontSize: 13 }}>No batches yet.</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {batches.map(b => (
                    <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#F9FAFB', borderRadius: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{b.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#4F46E5' }}>{b.student_count} students</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
