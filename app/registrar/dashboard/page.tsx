'use client';
// Registrar / COE Dashboard — "Examination Operations Console"
// Governance: Chancellor → Registrar → COE → Dean → HOD
// Institution: Universities, autonomous colleges, degree colleges
// COE handles: exam scheduling, hall tickets, result publishing, revaluation
// Registrar handles: academic calendar, enrollment, degree/provisional certs

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';

interface ExamSchedule {
  id: string; exam_name: string; semester: string; exam_type: string;
  start_date: string; end_date: string; status: string;
  hall_ticket_date: string | null; result_date: string | null; total_students: number;
}
interface RegistrarData {
  upcoming_exams: ExamSchedule[];
  ongoing_exams: ExamSchedule[];
  pending_results: ExamSchedule[];
  total_enrolled: number;
  certificates_pending: number;
  revaluation_pending: number;
  academic_year: string;
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  scheduled: { bg: '#EFF6FF', color: '#2563EB' },
  ongoing:   { bg: '#FFF7ED', color: '#D97706' },
  completed: { bg: '#F0FDF4', color: '#15803D' },
  result_published: { bg: '#DCFCE7', color: '#15803D' },
};

function ExamCard({ exam }: { exam: ExamSchedule }) {
  const ss = STATUS_STYLE[exam.status] ?? STATUS_STYLE.scheduled;
  const daysToStart = Math.ceil((new Date(exam.start_date).getTime() - Date.now()) / 86400000);
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '12px 14px', marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{exam.exam_name}</div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>
            Sem {exam.semester} · {exam.exam_type} · {exam.total_students} students
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
            {exam.start_date} → {exam.end_date}
            {exam.hall_ticket_date && <span style={{ marginLeft: 8 }}>Hall tickets: {exam.hall_ticket_date}</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 8, background: ss.bg, color: ss.color, display: 'inline-block' }}>
            {exam.status.replace('_', ' ')}
          </span>
          {daysToStart > 0 && daysToStart <= 30 && (
            <div style={{ fontSize: 11, color: '#D97706', fontWeight: 700, marginTop: 3 }}>{daysToStart}d</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RegistrarDashboard() {
  const [data, setData]     = useState<RegistrarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]       = useState<'upcoming' | 'ongoing' | 'results'>('upcoming');
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/registrar/dashboard');
      if (r.ok) setData(await r.json() as RegistrarData);
    } catch {/**/}
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const urgentAlerts: { icon: string; text: string; href: string }[] = [];
  if ((data?.revaluation_pending ?? 0) > 0) urgentAlerts.push({ icon: '📋', text: `${data!.revaluation_pending} revaluation request(s) pending`, href: '/admin/assessments' });
  if ((data?.certificates_pending ?? 0) > 0) urgentAlerts.push({ icon: '🎓', text: `${data!.certificates_pending} degree/provisional certificate(s) pending`, href: '/admin/certificates' });

  return (
    <Layout title="Registrar / COE" subtitle="Examination Operations Console">
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1F2937 0%, #374151 100%)', borderRadius: 14, padding: '16px 18px', marginBottom: 14, color: '#fff' }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 3 }}>Registrar / Controller of Examinations</div>
        <div style={{ fontSize: 17, fontWeight: 800 }}>Examination Operations Console</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>{today} · AY {data?.academic_year ?? '—'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 14 }}>
          {[
            { v: loading ? '—' : (data?.total_enrolled ?? 0), l: 'Enrolled' },
            { v: loading ? '—' : (data?.upcoming_exams.length ?? 0), l: 'Upcoming' },
            { v: loading ? '—' : (data?.ongoing_exams.length ?? 0), l: 'Ongoing' },
            { v: loading ? '—' : (data?.revaluation_pending ?? 0), l: '📋 Reval.' },
          ].map(s => (
            <div key={s.l} style={{ background: 'rgba(255,255,255,0.13)', borderRadius: 8, padding: '8px 4px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{s.v}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Urgent alerts */}
      {urgentAlerts.map((a, i) => (
        <Link key={i} href={a.href} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, border: '1px solid #FECACA', background: '#FEF2F2', marginBottom: 8, textDecoration: 'none', color: '#B91C1C', fontWeight: 600, fontSize: 13 }}>
          <span>{a.icon} {a.text}</span>
          <span>→</span>
        </Link>
      ))}
      {urgentAlerts.length > 0 && <div style={{ marginBottom: 10 }} />}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {([
          ['upcoming',`📅 Upcoming (${data?.upcoming_exams.length ?? 0})`],
          ['ongoing',`⏳ Ongoing (${data?.ongoing_exams.length ?? 0})`],
          ['results',`📊 Results (${data?.pending_results?.length ?? 0})`]
        ] as [typeof tab, string][]).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '6px 12px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: tab===t ? '#374151' : '#F3F4F6', color: tab===t ? '#fff' : '#374151', fontFamily: 'inherit' }}>
            {l}
          </button>
        ))}
      </div>

      {loading ? <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div> : (
        tab === 'upcoming' ? (
          (data?.upcoming_exams.length ?? 0) === 0
            ? <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', background: '#F9FAFB', borderRadius: 12 }}>No upcoming exams scheduled</div>
            : data!.upcoming_exams.map(e => <ExamCard key={e.id} exam={e} />)
        ) : tab === 'ongoing' ? (
          (data?.ongoing_exams.length ?? 0) === 0
            ? <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', background: '#F9FAFB', borderRadius: 12 }}>No ongoing exams</div>
            : data!.ongoing_exams.map(e => <ExamCard key={e.id} exam={e} />)
        ) : (
          (data?.pending_results?.length ?? 0) === 0
            ? <div style={{ padding: 32, textAlign: 'center', color: '#15803D', background: '#F0FDF4', borderRadius: 12 }}>✅ No pending results</div>
            : data!.pending_results.map(e => <ExamCard key={e.id} exam={e} />)
        )
      )}

      {/* Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginTop: 14 }}>
        {[
          { href: '/admin/assessments', icon: '📅', label: 'Schedule Exam',   color: '#1D4ED8' },
          { href: '/admin/hall-tickets', icon: '🎫', label: 'Hall Tickets',  color: '#D97706' },
          { href: '/admin/results',     icon: '📊', label: 'Publish Results', color: '#15803D' },
          { href: '/analytics',         icon: '📈', label: 'Analytics',       color: '#7C3AED' },
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
