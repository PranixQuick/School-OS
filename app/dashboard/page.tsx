'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { DEMO_KPIS, DEMO_LEADS, DEMO_EVALS, DEMO_EVENTS } from '@/lib/demoData';

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

const PRIORITY_BADGE: Record<string, string> = { high: 'badge badge-high', medium: 'badge badge-medium', low: 'badge badge-low' };
const SOURCE_LABEL: Record<string, string> = { referral: 'Referral', google: 'Google', website: 'Website', instagram: 'Instagram', facebook: 'Facebook', 'walk-in': 'Walk-in', other: 'Other' };

const MODULES = [
  { title: 'Report Cards', desc: 'Generate AI narratives for every student. Download as HTML for printing.', href: '/report-cards', btn: 'Generate Reports', color: '#15803D', bg: '#DCFCE7', icon: '📄' },
  { title: 'Teacher Evaluation', desc: 'Upload classroom audio. Get instant quality scores and coaching feedback.', href: '/teacher-eval', btn: 'Analyse Classroom', color: '#1D4ED8', bg: '#DBEAFE', icon: '🎙' },
  { title: 'Admissions CRM', desc: 'AI-scored leads sorted by priority. Track from inquiry to admission.', href: '/admissions/crm', btn: 'View CRM', color: '#6D28D9', bg: '#EDE9FE', icon: '👥' },
  { title: 'WhatsApp Bot', desc: 'Parent assistant deployed and answering attendance, fees, events 24/7.', href: '/whatsapp', btn: 'View Config', color: '#065F46', bg: '#D1FAE5', icon: '💬' },
];

// KPI cards — each links to its corresponding module
const KPI_CARDS = [
  { label: 'Total Students', sub_key: 'enrolments', color: '#4F46E5', bg: '#EEF2FF', href: '/students' },
  { label: 'Pending Fees',   sub_key: 'fees',        color: '#B91C1C', bg: '#FEF2F2', href: '/billing' },
  { label: 'Total Leads',    sub_key: 'leads',        color: '#6D28D9', bg: '#F5F3FF', href: '/admissions/crm' },
  { label: 'Reports Generated', sub_key: 'reports',   color: '#065F46', bg: '#ECFDF5', href: '/report-cards' },
];

export default function DashboardPage() {
  const [kpis, setKpis] = useState<KPIs>(DEMO_KPIS);
  const [leads, setLeads] = useState<Lead[]>(DEMO_LEADS);
  const [evals, setEvals] = useState<Eval[]>(DEMO_EVALS);
  const [events, setEvents] = useState<Event[]>(DEMO_EVENTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/summary')
      .then(r => r.json())
      .then(d => {
        if (d.kpis) {
          setKpis(d.kpis.total_students > 0 ? d.kpis : DEMO_KPIS);
          setLeads(d.recent_leads?.length ? d.recent_leads : DEMO_LEADS);
          setEvals(d.recent_evals?.length ? d.recent_evals : DEMO_EVALS);
          setEvents(d.upcoming_events?.length ? d.upcoming_events : DEMO_EVENTS);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  // Compute values from KPIs
  const kpiValues = [
    kpis.total_students,
    kpis.pending_fees_count,
    kpis.total_leads,
    kpis.narratives_generated,
  ];
  const kpiSubs = [
    'Active enrolments',
    `₹${Math.round(kpis.pending_fees_amount / 1000)}K outstanding`,
    `${kpis.high_priority_leads} high priority`,
    `${kpis.evals_done} teacher evals`,
  ];

  return (
    <Layout
      title="Dashboard"
      subtitle={today}
      actions={
        <Link href="/admissions" className="btn btn-primary btn-sm">
          + New Inquiry
        </Link>
      }
    >
      {/* KPI grid — each card is a clickable link */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        {KPI_CARDS.map((k, i) => (
          <Link key={k.label} href={k.href} style={{ textDecoration: 'none' }}>
            <div className="kpi-card" style={{ cursor: 'pointer', transition: 'box-shadow 0.15s, transform 0.12s' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.09)';
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = '';
                (e.currentTarget as HTMLDivElement).style.transform = '';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <span className="kpi-label">{k.label}</span>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: k.color }} />
                </div>
              </div>
              <div className="kpi-value" style={{ color: k.color }}>{loading ? '—' : kpiValues[i]}</div>
              <div className="kpi-sub">{kpiSubs[i]}</div>
              <div style={{ marginTop: 8, fontSize: 11, fontWeight: 600, color: k.color, opacity: 0.7 }}>View →</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Module cards */}
      <div className="section-header" style={{ marginBottom: 14 }}>
        <div>
          <div className="section-title">Platform Modules</div>
          <div className="section-sub">All AI-powered tools in one place</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        {MODULES.map(mod => (
          <div key={mod.title} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16, padding: '20px 18px', display: 'flex', flexDirection: 'column', transition: 'box-shadow 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: mod.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{mod.icon}</div>
              <span className="badge badge-done" style={{ fontSize: 10 }}>Live</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 6 }}>{mod.title}</div>
            <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.55, marginBottom: 16, flex: 1 }}>{mod.desc}</div>
            <Link href={mod.href} className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center', color: mod.color, borderColor: mod.bg, background: mod.bg }}>
              {mod.btn}
            </Link>
          </div>
        ))}
      </div>

      {/* Bottom 3-col */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>

        {/* Top leads */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="section-title" style={{ fontSize: 13 }}>Top Leads</div>
            <Link href="/admissions/crm" style={{ fontSize: 12, color: '#4F46E5', textDecoration: 'none', fontWeight: 600 }}>View all →</Link>
          </div>
          {leads.slice(0, 5).map((l, i) => (
            <div key={l.id} style={{ padding: '10px 18px', borderBottom: i < 4 ? '1px solid #F9FAFB' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: scoreBg(l.score / 10), border: `2px solid ${scoreColor(l.score / 10)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: scoreColor(l.score / 10), flexShrink: 0 }}>
                  {l.score}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{l.parent_name}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>Cl {l.target_class} · {SOURCE_LABEL[l.source] ?? l.source}</div>
                </div>
              </div>
              <span className={PRIORITY_BADGE[l.priority] ?? 'badge badge-gray'} style={{ fontSize: 10 }}>{l.priority.toUpperCase()}</span>
            </div>
          ))}
        </div>

        {/* Teacher evals */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="section-title" style={{ fontSize: 13 }}>Teacher Evaluations</div>
            <Link href="/teacher-eval" style={{ fontSize: 12, color: '#4F46E5', textDecoration: 'none', fontWeight: 600 }}>View all →</Link>
          </div>
          {evals.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🎙</div>
              <div className="empty-state-title">No evals yet</div>
              <div className="empty-state-sub" style={{ marginBottom: 12 }}>Upload your first recording</div>
              <Link href="/teacher-eval" className="btn btn-primary btn-sm">Go to Teacher Eval →</Link>
            </div>
          ) : evals.map((ev, i) => {
            const score = ev.coaching_score ?? 0;
            return (
              <div key={ev.id} style={{ padding: '12px 18px', borderBottom: i < evals.length - 1 ? '1px solid #F9FAFB' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 2 }}>{ev.file_name.replace(/sample_classroom_\d+/, 'Sample Recording')}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>{new Date(ev.uploaded_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                </div>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: scoreBg(score), border: `2px solid ${scoreColor(score)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: scoreColor(score) }}>
                  {score}
                </div>
              </div>
            );
          })}
        </div>

        {/* Events */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #F3F4F6' }}>
            <div className="section-title" style={{ fontSize: 13 }}>Upcoming Events</div>
          </div>
          {events.map((ev, i) => {
            const d = new Date(ev.event_date);
            return (
              <div key={ev.id} style={{ padding: '11px 18px', borderBottom: i < events.length - 1 ? '1px solid #F9FAFB' : 'none', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 38, height: 38, borderRadius: 10, background: ev.is_holiday ? '#FEF9C3' : '#EEF2FF', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: ev.is_holiday ? '#A16207' : '#4F46E5', lineHeight: 1 }}>{d.getDate()}</span>
                  <span style={{ fontSize: 9, color: ev.is_holiday ? '#A16207' : '#4F46E5', fontWeight: 600 }}>{d.toLocaleString('en-IN', { month: 'short' })}</span>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{ev.title}</div>
                  {ev.description && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{ev.description.slice(0, 55)}{ev.description.length > 55 ? '...' : ''}</div>}
                  {ev.is_holiday && <span className="badge badge-medium" style={{ fontSize: 9, marginTop: 3, display: 'inline-block' }}>HOLIDAY</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
                                                                                                                                           }
