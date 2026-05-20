'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { T, type Lang } from '@/lib/i18n';

interface KPIs {
  total_students: number; total_staff: number; pending_fees_count: number;
  pending_fees_amount: number; total_leads: number; high_priority_leads: number;
  evals_done: number; narratives_generated: number;
}
interface Lead { id: string; parent_name: string; child_name: string | null; child_age: number; target_class: string; source: string; score: number; priority: string; status: string; created_at: string; }
interface Eval { id: string; file_name: string; coaching_score: number | null; eval_report: string | null; status: string; uploaded_at: string; }
interface Event { id: string; title: string; event_date: string; is_holiday: boolean; description: string | null; }

function scoreColor(s: number) { return s >= 8 ? '#15803D' : s >= 6 ? '#A16207' : '#B91C1C'; }
function scoreBg(s: number) { return s >= 8 ? '#DCFCE7' : s >= 6 ? '#FEF9C3' : '#FEE2E2'; }

const SOURCE_LABEL: Record<string, string> = { referral: 'Referral', google: 'Google', website: 'Website', instagram: 'Instagram', facebook: 'Facebook', 'walk-in': 'Walk-in', other: 'Other' };

const MODULES = [
  { title: 'Report Cards', desc: 'AI narratives for every student.', href: '/report-cards', btn: 'Generate', color: '#15803D', bg: '#DCFCE7', icon: '📄' },
  { title: 'Teacher Eval', desc: 'Upload recordings, get scores.', href: '/teacher-eval', btn: 'Analyse', color: '#1D4ED8', bg: '#DBEAFE', icon: '🎙' },
  { title: 'Admissions', desc: 'AI-scored leads, track inquiries.', href: '/admissions/crm', btn: 'View CRM', color: '#6D28D9', bg: '#EDE9FE', icon: '👥' },
  { title: 'WhatsApp Bot', desc: 'Parent assistant, 24/7.', href: '/whatsapp', btn: 'Configure', color: '#065F46', bg: '#D1FAE5', icon: '💬' },
  { title: 'Event Gallery', desc: 'Share school event photos.', href: '/admin/events', btn: 'Open', color: '#9333EA', bg: '#F5F3FF', icon: '📸' },
];

const EMPTY_KPIS: KPIs = {
  total_students: 0, total_staff: 0, pending_fees_count: 0,
  pending_fees_amount: 0, total_leads: 0, high_priority_leads: 0,
  evals_done: 0, narratives_generated: 0,
};

export default function DashboardPage() {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [evals, setEvals] = useState<Eval[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [legalPendingCount, setLegalPendingCount] = useState(0);
  const [setupIncomplete, setSetupIncomplete] = useState(false);
  const [lang, setLang] = useState<Lang>('en');

  // Read language from localStorage (set by sidebar selector)
  useEffect(() => {
    const stored = localStorage.getItem('edprosys_lang') as Lang | null;
    if (stored) setLang(stored);
    const handler = () => {
      const updated = localStorage.getItem('edprosys_lang') as Lang | null;
      if (updated) setLang(updated);
    };
    window.addEventListener('edprosys_lang_change', handler);
    return () => window.removeEventListener('edprosys_lang_change', handler);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => { setLoading(false); if (!kpis) setKpis(EMPTY_KPIS); }, 8000);
    fetch('/api/dashboard/summary')
      .then(r => r.json())
      .then(d => {
        if (d?.kpis && typeof d.kpis.total_students === 'number') {
          setKpis(d.kpis); setLeads(d.recent_leads ?? []);
          setEvals(d.recent_evals ?? []); setEvents(d.upcoming_events ?? []);
        } else { setKpis(EMPTY_KPIS); }
      })
      .catch(() => { setKpis(EMPTY_KPIS); })
      .finally(() => { setLoading(false); clearTimeout(timeout); });
    return () => clearTimeout(timeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetch('/api/admin/legal/acceptance-status')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && !d.all_accepted) setLegalPendingCount((d.pending ?? []).length); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/admin/staff')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && (d.count === 0 || (Array.isArray(d.staff) && d.staff.length === 0))) setSetupIncomplete(true); })
      .catch(() => {});
  }, []);

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  if (loading && !kpis) {
    return (
      <div style={{ padding: 20 }}>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
          {[0,1,2,3].map(i => <div key={i} style={{ height: 80, borderRadius: 12, background: '#F3F4F6', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
        </div>
        <div style={{ height: 160, borderRadius: 12, background: '#F3F4F6', animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
    );
  }

  const safeKpis = kpis ?? EMPTY_KPIS;
  const hasFeeAlert = safeKpis.pending_fees_amount > 0;

  return (
    <Layout title={T('dashboard', lang)} subtitle={today}
      actions={<Link href="/admissions" style={{ padding: '8px 14px', background: '#4F46E5', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>+ New Inquiry</Link>}>

      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        .kpi-grid { display: grid; gap: 12px; grid-template-columns: repeat(2, 1fr); }
        @media(min-width:640px){ .kpi-grid { grid-template-columns: repeat(4, 1fr); } }
        .mod-grid { display: grid; gap: 12px; grid-template-columns: repeat(2, 1fr); }
        @media(min-width:640px){ .mod-grid { grid-template-columns: repeat(3, 1fr); } }
        @media(min-width:900px){ .mod-grid { grid-template-columns: repeat(5, 1fr); } }
        .bottom-grid { display: grid; gap: 14px; grid-template-columns: 1fr; }
        @media(min-width:768px){ .bottom-grid { grid-template-columns: 1fr 1fr 1fr; } }
        .kpi-card-inner { background: #fff; border: 1px solid #E5E7EB; border-radius: 14px; padding: 16px; cursor: pointer; transition: transform 0.12s, box-shadow 0.15s; }
        .kpi-card-inner:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
      `}</style>

      {setupIncomplete && (
        <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '12px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#1E40AF' }}>🚀 Complete your school setup</div>
            <div style={{ fontSize: 12, color: '#1E40AF', marginTop: 2 }}>Add staff, classes, and students to fully activate.</div>
          </div>
          <a href="/onboarding" style={{ padding: '7px 14px', background: '#4F46E5', color: '#fff', borderRadius: 7, fontSize: 12, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>Complete →</a>
        </div>
      )}

      {legalPendingCount > 0 && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#92400E' }}>⚠️ {legalPendingCount} document{legalPendingCount !== 1 ? 's' : ''} require re-acceptance</div>
          <a href="/onboarding#step7" style={{ padding: '7px 14px', background: '#92400E', color: '#fff', borderRadius: 7, fontSize: 12, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>Review →</a>
        </div>
      )}

      {hasFeeAlert && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#B91C1C' }}>💰 ₹{(safeKpis.pending_fees_amount / 1000).toFixed(1)}K fees outstanding</div>
            <div style={{ fontSize: 12, color: '#B91C1C', marginTop: 2 }}>{safeKpis.pending_fees_count} student{safeKpis.pending_fees_count !== 1 ? 's' : ''} with {T('pending', lang)} fees</div>
          </div>
          <a href="/admin/fees" style={{ padding: '7px 14px', background: '#B91C1C', color: '#fff', borderRadius: 7, fontSize: 12, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>View {T('fees', lang)} →</a>
        </div>
      )}

      {/* KPI grid — 2 col mobile, 4 col desktop */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        {[
          { label: T('students', lang), value: safeKpis.total_students, sub: 'Active enrolments', color: '#4F46E5', bg: '#EEF2FF', href: '/students' },
          { label: T('staff', lang), value: safeKpis.total_staff, sub: 'Active staff members', color: '#0284C7', bg: '#E0F2FE', href: '/admin/staff' },
          { label: T('fees', lang), value: safeKpis.pending_fees_count, sub: `₹${Math.round(safeKpis.pending_fees_amount / 1000)}K outstanding`, color: hasFeeAlert ? '#B91C1C' : '#15803D', bg: hasFeeAlert ? '#FEF2F2' : '#ECFDF5', href: '/admin/fees' },
          { label: 'Leads', value: safeKpis.total_leads, sub: `${safeKpis.high_priority_leads} high priority`, color: '#6D28D9', bg: '#F5F3FF', href: '/admissions/crm' },
        ].map(k => (
          <Link key={k.label} href={k.href} style={{ textDecoration: 'none' }}>
            <div className="kpi-card-inner">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</div>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: k.color }} />
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: k.color, lineHeight: 1, marginBottom: 4 }}>{loading ? '—' : k.value}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>{k.sub}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Module shortcuts */}
      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>Platform</div>
      <div className="mod-grid" style={{ marginBottom: 24 }}>
        {MODULES.map(mod => (
          <Link key={mod.title} href={mod.href} style={{ textDecoration: 'none' }}>
            <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '16px 14px', cursor: 'pointer' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: mod.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 10 }}>{mod.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#111827', marginBottom: 3 }}>{mod.title}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.4 }}>{mod.desc}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Bottom 3-col */}
      <div className="bottom-grid">
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Top Leads</div>
            <Link href="/admissions/crm" style={{ fontSize: 12, color: '#4F46E5', textDecoration: 'none', fontWeight: 600 }}>View all →</Link>
          </div>
          {leads.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 16px', color: '#9CA3AF', fontSize: 13 }}>👥 No leads yet</div>
          ) : leads.slice(0, 5).map((l, i) => (
            <div key={l.id} style={{ padding: '10px 16px', borderBottom: i < 4 ? '1px solid #F9FAFB' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: scoreBg(l.score / 10), border: `2px solid ${scoreColor(l.score / 10)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: scoreColor(l.score / 10), flexShrink: 0 }}>{l.score}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{l.parent_name}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>Cl {l.target_class} · {SOURCE_LABEL[l.source] ?? l.source}</div>
                </div>
              </div>
              <div style={{ padding: '2px 7px', borderRadius: 8, fontSize: 10, fontWeight: 700, background: l.priority === 'high' ? '#FEE2E2' : l.priority === 'medium' ? '#FEF9C3' : '#F3F4F6', color: l.priority === 'high' ? '#B91C1C' : l.priority === 'medium' ? '#A16207' : '#6B7280' }}>
                {l.priority.toUpperCase()}
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Teacher Evals</div>
            <Link href="/teacher-eval" style={{ fontSize: 12, color: '#4F46E5', textDecoration: 'none', fontWeight: 600 }}>View all →</Link>
          </div>
          {evals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 16px', color: '#9CA3AF', fontSize: 13 }}>🎙 No evaluations yet</div>
          ) : evals.map((ev, i) => {
            const score = ev.coaching_score ?? 0;
            return (
              <div key={ev.id} style={{ padding: '12px 16px', borderBottom: i < evals.length - 1 ? '1px solid #F9FAFB' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 2 }}>{ev.file_name}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>{new Date(ev.uploaded_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                </div>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: scoreBg(score), border: `2px solid ${scoreColor(score)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: scoreColor(score) }}>{score}</div>
              </div>
            );
          })}
        </div>

        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Upcoming Events</div>
          </div>
          {events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 16px', color: '#9CA3AF', fontSize: 13 }}>📅 No upcoming events</div>
          ) : events.map((ev, i) => {
            const d = new Date(ev.event_date);
            return (
              <div key={ev.id} style={{ padding: '11px 16px', borderBottom: i < events.length - 1 ? '1px solid #F9FAFB' : 'none', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 36, height: 36, borderRadius: 8, background: ev.is_holiday ? '#FEF9C3' : '#EEF2FF', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: ev.is_holiday ? '#A16207' : '#4F46E5', lineHeight: 1 }}>{d.getDate()}</span>
                  <span style={{ fontSize: 9, color: ev.is_holiday ? '#A16207' : '#4F46E5', fontWeight: 600 }}>{d.toLocaleString('en-IN', { month: 'short' })}</span>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{ev.title}</div>
                  {ev.description && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{ev.description.slice(0, 55)}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
