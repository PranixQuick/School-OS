'use client';
// app/owner/page.tsx — Owner Dashboard: cross-school aggregates + health scores
// No external chart library — pure CSS bar chart for fee trend

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { T } from '@/lib/i18n';
import { useLang } from '@/lib/useLang';

interface SchoolStat {
  school_id: string; school_name: string; plan: string; is_active: boolean;
  students: number; staff: number;
  pending_fees: number; pending_fees_amount: number;
  attendance_today_pct: number | null;
  fee_collection_pct: number; admissions_30d: number;
  risk_count: number;
}
interface FeePoint { label: string; amount: number; }
interface OwnerData {
  school_stats: SchoolStat[];
  total_students: number; total_staff: number;
  total_pending_fees_amount: number;
  fee_collection_trend: FeePoint[];
}

function healthScore(s: SchoolStat): { score: number; grade: string; color: string; bg: string } {
  let score = 100;
  if ((s.attendance_today_pct ?? 100) < 75) score -= 25;
  else if ((s.attendance_today_pct ?? 100) < 85) score -= 10;
  if (s.fee_collection_pct < 60) score -= 20;
  else if (s.fee_collection_pct < 80) score -= 10;
  if (s.risk_count > 5) score -= 15;
  else if (s.risk_count > 0) score -= 5;
  score = Math.max(0, Math.min(100, score));
  if (score >= 85) return { score, grade: 'A', color: '#065F46', bg: '#D1FAE5' };
  if (score >= 70) return { score, grade: 'B', color: '#A16207', bg: '#FEF9C3' };
  if (score >= 55) return { score, grade: 'C', color: '#9333EA', bg: '#F5F3FF' };
  return { score, grade: 'D', color: '#B91C1C', bg: '#FEE2E2' };
}

function MiniBarChart({ data }: { data: FeePoint[] }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.amount), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60, padding: '0 4px' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <div style={{ width: '100%', background: '#4F46E5', borderRadius: '3px 3px 0 0', height: `${Math.max(4, (d.amount / max) * 52)}px`, opacity: i === data.length - 1 ? 1 : 0.45 }} />
          <div style={{ fontSize: 9, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function OwnerPage() {
  const { lang } = useLang();
  const [data, setData] = useState<OwnerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSchool, setActiveSchool] = useState<string>('all');
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 8000);
    fetch('/api/owner/dashboard')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => { setLoading(false); clearTimeout(t); });
    return () => clearTimeout(t);
  }, []);

  const schools = data?.school_stats ?? [];
  const filtered = activeSchool === 'all' ? schools : schools.filter(s => s.school_id === activeSchool);

  const aggStudents = filtered.reduce((s, sc) => s + sc.students, 0);
  const aggStaff = filtered.reduce((s, sc) => s + sc.staff, 0);
  const aggFeesAmt = filtered.reduce((s, sc) => s + sc.pending_fees_amount, 0);
  const aggRisk = filtered.reduce((s, sc) => s + sc.risk_count, 0);

  if (loading && !data) {
    return (
      <Layout title={T('ov_owner_dashboard', lang)} subtitle={today}>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 16 }}>
          {[0,1,2,3].map(i => <div key={i} style={{ height: 80, borderRadius: 12, background: '#F3F4F6', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
        </div>
        <div style={{ height: 120, borderRadius: 12, background: '#F3F4F6', animation: 'pulse 1.5s ease-in-out infinite' }} />
      </Layout>
    );
  }

  return (
    <Layout title={T('ov_owner_dashboard', lang)} subtitle={today}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        .kpi2{display:grid;gap:12px;grid-template-columns:repeat(2,1fr)}
        @media(min-width:640px){.kpi2{grid-template-columns:repeat(4,1fr)}}
        .school-grid{display:grid;gap:14px;grid-template-columns:1fr}
        @media(min-width:640px){.school-grid{grid-template-columns:repeat(2,1fr)}}
        @media(min-width:900px){.school-grid{grid-template-columns:repeat(3,1fr)}}
      `}</style>

      {/* School switcher */}
      {schools.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          <button onClick={() => setActiveSchool('all')}
            style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: activeSchool === 'all' ? '#4F46E5' : '#F3F4F6', color: activeSchool === 'all' ? '#fff' : '#374151' }}>
            {T('ov_all_schools', lang)} ({schools.length})
          </button>
          {schools.map(s => (
            <button key={s.school_id} onClick={() => setActiveSchool(s.school_id)}
              style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: activeSchool === s.school_id ? '#4F46E5' : '#F3F4F6', color: activeSchool === s.school_id ? '#fff' : '#374151' }}>
              {s.school_name}
            </button>
          ))}
        </div>
      )}

      {/* KPI cards */}
      <div className="kpi2" style={{ marginBottom: 20 }}>
        {[
          { label: T('ov_total_students', lang), value: aggStudents, color: '#4F46E5', sub: T('ov_across_schools', lang).replace('{n}', String(filtered.length)) },
          { label: T('ov_total_staff', lang), value: aggStaff, color: '#0284C7', sub: T('ov_active_staff_members', lang) },
          { label: T('ov_fees_pending', lang), value: `₹${(aggFeesAmt / 1000).toFixed(1)}K`, color: aggFeesAmt > 0 ? '#B91C1C' : '#065F46', sub: aggFeesAmt > 0 ? T('ov_requires_followup', lang) : T('ov_all_collected', lang) },
          { label: T('ov_at_risk_students', lang), value: aggRisk, color: aggRisk > 0 ? '#B91C1C' : '#065F46', sub: aggRisk > 0 ? T('ov_needs_intervention', lang) : T('ov_no_alerts', lang) },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: loading ? '#D1D5DB' : k.color, marginBottom: 3 }}>{loading ? '—' : k.value}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Fee collection trend — inline bar chart, no library */}
      {data?.fee_collection_trend && data.fee_collection_trend.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: '16px 18px', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 14 }}>📈 {T('ov_fee_collection_trend', lang)}</div>
          <MiniBarChart data={data.fee_collection_trend} />
        </div>
      )}

      {/* Per-school health cards */}
      {filtered.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>{T('ov_school_health', lang)}</div>
          <div className="school-grid" style={{ marginBottom: 20 }}>
            {filtered.map(sc => {
              const h = healthScore(sc);
              return (
                <div key={sc.school_id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14, color: '#111827' }}>{sc.school_name}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{sc.plan.toUpperCase()} · {sc.students} {T('ov_students', lang)}</div>
                    </div>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: h.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 900, color: h.color, lineHeight: 1 }}>{h.grade}</div>
                      <div style={{ fontSize: 9, color: h.color }}>{h.score}</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                    {[
                      { label: T('ov_students', lang), val: sc.students, color: '#4F46E5' },
                      { label: T('ov_attendance', lang), val: sc.attendance_today_pct !== null ? `${Math.round(sc.attendance_today_pct)}%` : T('ov_na', lang), color: (sc.attendance_today_pct ?? 100) >= 85 ? '#065F46' : '#D97706' },
                      { label: T('ov_risk_cases', lang), val: sc.risk_count, color: sc.risk_count > 0 ? '#B91C1C' : '#065F46' },
                    ].map(k => (
                      <div key={k.label} style={{ background: '#F9FAFB', borderRadius: 8, padding: '8px 8px', textAlign: 'center' }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: k.color }}>{k.val}</div>
                        <div style={{ fontSize: 9, color: '#9CA3AF' }}>{k.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Link href="/dashboard"
                      style={{ flex: 1, textAlign: 'center', padding: '7px', borderRadius: 7, background: '#EEF2FF', color: '#4F46E5', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                      {T('ov_dashboard', lang)}
                    </Link>
                    <Link href="/admin/fees"
                      style={{ flex: 1, textAlign: 'center', padding: '7px', borderRadius: 7, background: sc.pending_fees > 0 ? '#FEF2F2' : '#F0FDF4', color: sc.pending_fees > 0 ? '#B91C1C' : '#065F46', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                      {sc.pending_fees > 0 ? T('ov_pending_count', lang).replace('{n}', String(sc.pending_fees)) : `${T('ov_fees', lang)} ✓`}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {[
          { href: '/admin/staff', icon: '👥', label: T('ov_view_all_staff', lang), color: '#0284C7' },
          { href: '/students', icon: '👨‍🎓', label: T('ov_view_all_students', lang), color: '#4F46E5' },
          { href: '/admin/fees', icon: '💰', label: T('ov_fee_collection', lang), color: '#065F46' },
          { href: '/analytics', icon: '📊', label: T('ov_analytics', lang), color: '#7C3AED' },
        ].map(a => (
          <Link key={a.href} href={a.href} style={{ textDecoration: 'none', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 22 }}>{a.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: a.color }}>{a.label}</div>
          </Link>
        ))}
      </div>
    </Layout>
  );
}
