'use client';
// app/hod/subjects/page.tsx
// HOD — Subjects & Faculty. Read-only department view.
// Data: /api/hod/departments, /api/hod/staff, /api/hod/roster (for distinct subjects).

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface Dept { id: string; name: string; school_id: string; }
interface Staff { id: string; name: string; email: string; department: string; }
interface RosterRow { subjects?: { name?: string } | null; classes?: { grade_level?: string; section?: string } | null; }

export default function HodSubjectsPage() {
  const [depts, setDepts] = useState<Dept[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dRes, sRes, rRes] = await Promise.allSettled([
        fetch('/api/hod/departments').then(r => r.ok ? r.json() : Promise.reject(new Error('departments failed'))),
        fetch('/api/hod/staff').then(r => r.ok ? r.json() : { staff: [] }),
        fetch('/api/hod/roster').then(r => r.ok ? r.json() : { roster: [] }),
      ]);
      if (dRes.status === 'fulfilled') setDepts(dRes.value.departments ?? []);
      else setError('Could not load your department. If you were just given HOD access, sign out and back in.');
      if (sRes.status === 'fulfilled') setStaff(sRes.value.staff ?? []);
      if (rRes.status === 'fulfilled') {
        const names = new Set<string>();
        for (const row of (rRes.value.roster ?? []) as RosterRow[]) {
          const n = row.subjects?.name;
          if (n) names.add(n);
        }
        setSubjects([...names].sort());
      }
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <Layout title="Subjects & Faculty" subtitle="Your department at a glance">
      {loading ? (
        <div style={{ padding: 28, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 16, background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', borderRadius: 12, fontSize: 13, fontWeight: 600 }}>{error}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <section>
            <h2 style={{ fontSize: 13, fontWeight: 800, color: '#111827', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '.04em' }}>Departments</h2>
            {depts.length === 0 ? (
              <div style={{ padding: 16, background: '#F9FAFB', border: '1px dashed #E5E7EB', borderRadius: 12, color: '#6B7280', fontSize: 13 }}>No department is mapped to you yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {depts.map(d => (
                  <div key={d.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>🏛️</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{d.name}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 style={{ fontSize: 13, fontWeight: 800, color: '#111827', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '.04em' }}>Subjects taught ({subjects.length})</h2>
            {subjects.length === 0 ? (
              <div style={{ padding: 16, background: '#F9FAFB', border: '1px dashed #E5E7EB', borderRadius: 12, color: '#6B7280', fontSize: 13 }}>No subjects found on the timetable for your department yet.</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {subjects.map(s => (
                  <span key={s} style={{ background: '#EEF2FF', color: '#4338CA', borderRadius: 99, padding: '6px 12px', fontSize: 13, fontWeight: 600 }}>{s}</span>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 style={{ fontSize: 13, fontWeight: 800, color: '#111827', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '.04em' }}>Faculty ({staff.length})</h2>
            {staff.length === 0 ? (
              <div style={{ padding: 16, background: '#F9FAFB', border: '1px dashed #E5E7EB', borderRadius: 12, color: '#6B7280', fontSize: 13 }}>No faculty mapped to your department yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {staff.map(t => (
                  <div key={t.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '12px 14px' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{t.email}{t.department ? ` · ${t.department}` : ''}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>
      )}
    </Layout>
  );
}
