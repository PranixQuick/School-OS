'use client';
// HOD Dashboard — "Department Operations & Analytics Center"
// Governance: Chairman → Principal → Dean → HOD → Faculty → Student
// Institution: Engineering, Medical, Degree colleges, Universities
// Role-native: HOD sees ONLY their department data
// Workflows: faculty workload, attendance shortage, internships, placement, accreditation

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';

interface DeptStats {
  dept_name: string; dept_code: string;
  total_faculty: number; total_students: number;
  avg_attendance: number; attendance_shortage_count: number;
  active_internships: number; placed_this_year: number;
  accreditation_body: string | null; accreditation_grade: string | null; accreditation_expiry: string | null;
  pending_assignments: number; exam_upcoming: number;
}

interface FacultyLoad { id: string; name: string; subjects: number; weekly_hours: number; pending_evaluations: number; }
interface AttRisk { name: string; class: string; attendance_pct: number; }
interface InternshipRecord { student: string; company: string; status: string; end_date: string; }

interface HODData {
  dept: DeptStats;
  faculty_load: FacultyLoad[];
  att_risk_students: AttRisk[];
  active_internships: InternshipRecord[];
}

export default function HODDashboardPage() {
  const [data, setData]     = useState<HODData | null>(null);
  const [loading, setLoading] = useState(true);
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/hod/dashboard');
      if (r.ok) setData(await r.json() as HODData);
    } catch {/**/}
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const dept = data?.dept;
  const daysUntilExpiry = dept?.accreditation_expiry
    ? Math.ceil((new Date(dept.accreditation_expiry).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <Layout title="HOD Dashboard" subtitle={dept?.dept_name ?? 'Department Operations'}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}.skel{background:#F3F4F6;border-radius:8px;animation:pulse 1.5s ease-in-out infinite}`}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 100%)', borderRadius: 14, padding: '16px 18px', marginBottom: 14, color: '#fff' }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 3 }}>HOD Command Center</div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>{loading ? '…' : (dept?.dept_name ?? '—')}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>{today}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 14 }}>
          {[
            { v: dept?.total_faculty ?? '—', l: 'Faculty' },
            { v: dept?.total_students ?? '—', l: 'Students' },
            { v: `${dept?.avg_attendance ?? 0}%`, l: 'Avg Att.' },
            { v: dept?.attendance_shortage_count ?? 0, l: '⚠ Shortage' },
          ].map(s => (
            <div key={s.l} style={{ background: 'rgba(255,255,255,0.14)', borderRadius: 8, padding: '8px 4px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{loading ? '—' : s.v}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Accreditation status */}
      {dept?.accreditation_body && (
        <div style={{ background: daysUntilExpiry !== null && daysUntilExpiry < 180 ? '#FFF7ED' : '#F0FDF4', border: `1px solid ${daysUntilExpiry !== null && daysUntilExpiry < 180 ? '#FED7AA' : '#BBF7D0'}`, borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>🏛️ {dept.accreditation_body} Accreditation</div>
              <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                Grade: <strong>{dept.accreditation_grade ?? 'N/A'}</strong> · Expires: {dept.accreditation_expiry ?? 'N/A'}
              </div>
            </div>
            {daysUntilExpiry !== null && (
              <div style={{ fontSize: 13, fontWeight: 800, color: daysUntilExpiry < 90 ? '#B91C1C' : daysUntilExpiry < 180 ? '#D97706' : '#15803D' }}>
                {daysUntilExpiry < 0 ? 'EXPIRED' : `${daysUntilExpiry}d`}
              </div>
            )}
          </div>
        </div>
      )}

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Internships', value: dept?.active_internships ?? 0, icon: '🏭', href: '/admin/internships', color: '#0284C7' },
          { label: 'Placed', value: dept?.placed_this_year ?? 0, icon: '💼', href: '/admin/placement', color: '#15803D' },
          { label: 'Exam Due', value: dept?.exam_upcoming ?? 0, icon: '📝', href: '/admin/assessments', color: dept?.exam_upcoming ? '#D97706' : '#15803D' },
        ].map(k => (
          <Link key={k.label} href={k.href} style={{ textDecoration: 'none', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 11, padding: '10px 8px', textAlign: 'center', display: 'block' }}>
            <div style={{ fontSize: 18, marginBottom: 2 }}>{k.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 10, color: '#9CA3AF' }}>{k.label}</div>
          </Link>
        ))}
      </div>

      {/* Faculty workload */}
      {(data?.faculty_load?.length ?? 0) > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 8 }}>Faculty Workload</div>
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
            {data!.faculty_load.map((f, i) => (
              <div key={f.id} style={{ padding: '10px 14px', borderBottom: i < data!.faculty_load.length-1 ? '1px solid #F9FAFB' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{f.name}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>{f.subjects} subjects · {f.weekly_hours}h/week</div>
                </div>
                {f.pending_evaluations > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#FEF3C7', color: '#D97706' }}>
                    {f.pending_evaluations} pending
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Attendance shortage */}
      {(data?.att_risk_students?.length ?? 0) > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 8 }}>
            ⚠️ Attendance Shortage (&lt;75%)
          </div>
          <div style={{ background: '#fff', border: '1px solid #FECACA', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
            {data!.att_risk_students.slice(0, 5).map((s, i) => (
              <div key={i} style={{ padding: '10px 14px', borderBottom: i < 4 ? '1px solid #FFF5F5' : 'none', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>{s.class}</div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#B91C1C', background: '#FEF2F2', padding: '3px 10px', borderRadius: 8 }}>
                  {s.attendance_pct}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Active internships */}
      {(data?.active_internships?.length ?? 0) > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 8 }}>Active Internships</div>
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
            {data!.active_internships.slice(0, 4).map((r, i) => (
              <div key={i} style={{ padding: '10px 14px', borderBottom: i < 3 ? '1px solid #F9FAFB' : 'none', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{r.student}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>{r.company}</div>
                </div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>Ends {r.end_date}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        {[
          { href: '/students', icon: '👩‍🎓', label: 'Students',       color: '#4F46E5' },
          { href: '/admin/assessments', icon: '📝', label: 'Exams',       color: '#D97706' },
          { href: '/admin/internships', icon: '🏭', label: 'Internships', color: '#0D9488' },
          { href: '/admin/placement',   icon: '💼', label: 'Placement',   color: '#15803D' },
          { href: '/admin/accreditation', icon: '🏛️', label: 'Accreditation', color: '#7C3AED' },
          { href: '/analytics',         icon: '📊', label: 'Analytics',   color: '#0284C7' },
        ].map(a => (
          <Link key={a.href} href={a.href} style={{ textDecoration: 'none', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>{a.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: a.color }}>{a.label}</span>
          </Link>
        ))}
      </div>
    </Layout>
  );
}
