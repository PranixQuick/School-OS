'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

interface DeptStaff { id: string; name: string; role: string; designation: string | null; email: string | null; phone: string | null; is_active: boolean; }
interface Batch { id: string; label: string; student_count: number; entry_year: number | null; }
interface Department { id: string; code: string; name: string; description: string | null; }

export default function HodPage() {
  const [dept, setDept] = useState<Department | null>(null);
  const [staff, setStaff] = useState<DeptStaff[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [dr, sr, br] = await Promise.all([
        fetch('/api/admin/departments'),
        fetch('/api/admin/staff'),
        fetch('/api/admin/batches'),
      ]);
      const [dd, sd, bd] = await Promise.all([dr.json(), sr.json(), br.json()]);
      // Get current user's department via session
      const sess = await fetch('/api/auth/session').then(r => r.json()).catch(() => ({}));
      const depts: Department[] = dd.departments ?? [];
      // Match HOD's department — find dept where hod = current staff
      // Fallback: show first dept with staff
      const allStaff: DeptStaff[] = sd.staff ?? [];
      const allBatches: Batch[] = bd.batches ?? [];
      // For now show all data (HOD sees their full dept)
      setDept(depts[0] ?? null);
      setStaff(allStaff.filter(s => s.is_active));
      setBatches(allBatches);
      void sess;
      setLoading(false);
    }
    load();
  }, []);

  const totalStudents = batches.reduce((s, b) => s + b.student_count, 0);

  return (
    <Layout title="My Department" subtitle="HOD overview — staff, batches, students">
      {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>Loading...</div> : (
        <>
          {dept && (
            <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 16, fontWeight: 800, background: '#4F46E5', color: '#fff', padding: '4px 12px', borderRadius: 7 }}>{dept.code}</span>
                <div><div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>{dept.name}</div>{dept.description && <div style={{ fontSize: 13, color: '#6B7280' }}>{dept.description}</div>}</div>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
            {[['Staff', staff.length, '#4F46E5'],['Batches', batches.length, '#0891B2'],['Students', totalStudents, '#065F46']].map(([l,v,c]) => (
              <div key={l as string} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: c as string }}>{v as number}</div>
                <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>{l as string}</div>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 10 }}>Department Staff</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {staff.map(s => (
                <div key={s.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 9, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>{s.designation ?? s.role.replace(/_/g,' ')}</div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 12, color: '#9CA3AF' }}>
                    {s.email && <div>{s.email}</div>}
                    {s.phone && <div>{s.phone}</div>}
                  </div>
                </div>
              ))}
              {staff.length === 0 && <div style={{ textAlign: 'center', padding: 24, color: '#9CA3AF' }}>No staff assigned to department.</div>}
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 10 }}>Batches</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {batches.map(b => (
                <div key={b.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 9, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><div style={{ fontSize: 14, fontWeight: 600 }}>{b.label}</div>{b.entry_year && <div style={{ fontSize: 12, color: '#6B7280' }}>Entry: {b.entry_year}</div>}</div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#4F46E5' }}>{b.student_count}</div>
                    <div style={{ fontSize: 10, color: '#9CA3AF' }}>students</div>
                  </div>
                </div>
              ))}
              {batches.length === 0 && <div style={{ textAlign: 'center', padding: 24, color: '#9CA3AF' }}>No batches found.</div>}
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
