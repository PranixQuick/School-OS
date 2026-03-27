'use client';

import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import Link from 'next/link';

interface KPIs {
  total_students: number;
  total_staff: number;
  pending_fees_count: number;
  pending_fees_amount: number;
  total_leads: number;
  high_priority_leads: number;
  evals_done: number;
  narratives_generated: number;
}

interface Lead {
  id: string;
  parent_name: string;
  child_name: string | null;
  child_age: number;
  target_class: string;
  source: string;
  score: number;
  priority: string;
  status: string;
  created_at: string;
}

interface Eval {
  id: string;
  file_name: string;
  coaching_score: number | null;
  eval_report: string | null;
  status: string;
  uploaded_at: string;
}

interface Event {
  id: string;
  title: string;
  event_date: string;
  is_holiday: boolean;
  description: string | null;
}

interface DashboardData {
  kpis: KPIs;
  recent_leads: Lead[];
  recent_evals: Eval[];
  upcoming_events: Event[];
}

const BTN: CSSProperties = { border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 };

const P_STYLE: Record<string, { bg: string; color: string }> = {
  high:   { bg: '#E1F5EE', color: '#0F6E56' },
  medium: { bg: '#FAEEDA', color: '#854F0B' },
  low:    { bg: '#FAECE7', color: '#993C1D' },
};

const SOURCE_ICON: Record<string, string> = {
  referral: 'R', google: 'G', website: 'W',
  instagram: 'I', facebook: 'F', 'walk-in': 'WI', other: 'O',
};

function scoreColor(s: number) { return s >= 8 ? '#0F6E56' : s >= 6 ? '#854F0B' : '#993C1D'; }
function scoreBg(s: number) { return s >= 8 ? '#E1F5EE' : s >= 6 ? '#FAEEDA' : '#FAECE7'; }

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard', active: true },
  { href: '/admissions/crm', label: 'Admissions' },
  { href: '/report-cards', label: 'Reports' },
  { href: '/teacher-eval', label: 'Teacher Eval' },
];

const MODULES = [
  {
    title: 'Report Cards',
    desc: 'AI-generated personalised narratives for every student. Export as PDF.',
    href: '/report-cards',
    btnLabel: 'Generate Reports',
    color: '#0F6E56',
    bg: '#E1F5EE',
    borderColor: '#1D9E75',
    status: 'Live',
    icon: '📄',
  },
  {
    title: 'Teacher Evaluation',
    desc: 'Upload classroom recordings. Get quality scores and coaching feedback instantly.',
    href: '/teacher-eval',
    btnLabel: 'Analyse Classroom',
    color: '#854F0B',
    bg: '#FAEEDA',
    borderColor: '#EF9F27',
    status: 'Live',
    icon: '🎙',
  },
  {
    title: 'Admissions CRM',
    desc: 'AI-scored leads sorted by priority. Track parent inquiries from first contact to admission.',
    href: '/admissions/crm',
    btnLabel: 'View Leads',
    color: '#3C3489',
    bg: '#EEEDFE',
    borderColor: '#7F77DD',
    status: 'Live',
    icon: '👥',
  },
  {
    title: 'WhatsApp Bot',
    desc: 'AI parent assistant answering attendance, fees, and events 24/7 via WhatsApp.',
    href: '#',
    btnLabel: 'Configure Bot',
    color: '#5F5E5A',
    bg: '#F1EFE8',
    borderColor: '#B4B2A9',
    status: 'Deployed',
    icon: '💬',
  },
];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/summary')
      .then(r => r.json())
      .then((d: DashboardData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const kpis = data?.kpis;
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div style={{ minHeight: '100vh', background: '#F8F7F4', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* Top nav */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #E8E6DF', height: 56, display: 'flex', alignItems: 'center', padding: '0 32px', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: '#0F6E56', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>S</span>
            </div>
            <span style={{ fontWeight: 800, fontSize: 16, color: '#1A1A18', letterSpacing: '-0.3px' }}>School OS</span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {NAV_LINKS.map(link => (
              <Link key={link.href} href={link.href}
                style={{ textDecoration: 'none', padding: '6px 14px', borderRadius: 8, fontSize: 14, fontWeight: link.active ? 600 : 400, color: link.active ? '#0F6E56' : '#5F5E5A', background: link.active ? '#E1F5EE' : 'none' }}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: '#888780' }}>Suchitra Academy</span>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#0F6E56', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>A</span>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '36px 24px' }}>

        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1A1A18', margin: '0 0 4px', letterSpacing: '-0.5px' }}>
              Good morning 👋
            </h1>
            <p style={{ fontSize: 14, color: '#888780', margin: 0 }}>{today}</p>
          </div>
          <Link href="/admissions"
            style={{ ...BTN, height: 38, padding: '0 18px', borderRadius: 8, background: '#0F6E56', color: '#fff', fontSize: 14, display: 'flex', alignItems: 'center', textDecoration: 'none', gap: 6 }}>
            + New Inquiry
          </Link>
        </div>

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
          {[
            { label: 'Total Students', value: loading ? '—' : String(kpis?.total_students ?? 0), sub: 'Active enrolments', color: '#0F6E56', bg: '#E1F5EE' },
            { label: 'Pending Fees', value: loading ? '—' : String(kpis?.pending_fees_count ?? 0), sub: `₹${((kpis?.pending_fees_amount ?? 0) / 1000).toFixed(0)}K outstanding`, color: '#993C1D', bg: '#FAECE7' },
            { label: 'Total Leads', value: loading ? '—' : String(kpis?.total_leads ?? 0), sub: `${kpis?.high_priority_leads ?? 0} high priority`, color: '#3C3489', bg: '#EEEDFE' },
            { label: 'Reports Generated', value: loading ? '—' : String(kpis?.narratives_generated ?? 0), sub: `${kpis?.evals_done ?? 0} teacher evals done`, color: '#854F0B', bg: '#FAEEDA' },
          ].map(k => (
            <div key={k.label} style={{ background: '#fff', border: '1px solid #E8E6DF', borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#888780', letterSpacing: '0.04em' }}>{k.label.toUpperCase()}</span>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: k.color }} />
                </div>
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: k.color, lineHeight: 1, marginBottom: 4 }}>{k.value}</div>
              <div style={{ fontSize: 12, color: '#888780' }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Module cards */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A18', margin: '0 0 14px', letterSpacing: '-0.3px' }}>Platform Modules</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {MODULES.map(mod => (
              <div key={mod.title} style={{ background: '#fff', border: `1px solid #E8E6DF`, borderRadius: 14, padding: '20px 18px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: mod.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                    {mod.icon}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 10, background: mod.bg, color: mod.color }}>
                    {mod.status}
                  </span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#1A1A18', marginBottom: 6 }}>{mod.title}</div>
                <div style={{ fontSize: 12, color: '#888780', lineHeight: 1.5, marginBottom: 16, flex: 1 }}>{mod.desc}</div>
                <Link href={mod.href}
                  style={{ ...BTN, display: 'block', textAlign: 'center', padding: '9px 0', borderRadius: 8, background: mod.bg, color: mod.color, fontSize: 13, textDecoration: 'none' }}>
                  {mod.btnLabel}
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom section: 3 columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>

          {/* Recent Leads */}
          <div style={{ background: '#fff', border: '1px solid #E8E6DF', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid #F1EFE8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A18' }}>Top Leads</span>
              <Link href="/admissions/crm" style={{ fontSize: 12, color: '#3C3489', textDecoration: 'none', fontWeight: 600 }}>View all →</Link>
            </div>
            {loading ? (
              <div style={{ padding: '24px 18px', color: '#888780', fontSize: 13 }}>Loading...</div>
            ) : (data?.recent_leads ?? []).length === 0 ? (
              <div style={{ padding: '24px 18px', color: '#888780', fontSize: 13 }}>No leads yet.</div>
            ) : (
              (data?.recent_leads ?? []).slice(0, 5).map((lead, i) => {
                const ps = P_STYLE[lead.priority] ?? P_STYLE.medium;
                return (
                  <div key={lead.id} style={{ padding: '11px 18px', borderBottom: i < 4 ? '1px solid #F8F7F4' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: ps.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: ps.color }}>
                        {lead.score}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A18' }}>{lead.parent_name}</div>
                        <div style={{ fontSize: 11, color: '#888780' }}>Class {lead.target_class} · {SOURCE_ICON[lead.source] ?? lead.source}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: ps.bg, color: ps.color }}>
                      {lead.priority.toUpperCase()}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Recent Evals */}
          <div style={{ background: '#fff', border: '1px solid #E8E6DF', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid #F1EFE8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A18' }}>Teacher Evaluations</span>
              <Link href="/teacher-eval" style={{ fontSize: 12, color: '#854F0B', textDecoration: 'none', fontWeight: 600 }}>View all →</Link>
            </div>
            {loading ? (
              <div style={{ padding: '24px 18px', color: '#888780', fontSize: 13 }}>Loading...</div>
            ) : (data?.recent_evals ?? []).length === 0 ? (
              <div style={{ padding: '24px 18px' }}>
                <div style={{ color: '#888780', fontSize: 13, marginBottom: 14 }}>No evaluations yet.</div>
                <Link href="/teacher-eval"
                  style={{ ...BTN, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: '#FAEEDA', color: '#854F0B', fontSize: 13, textDecoration: 'none' }}>
                  Analyse first recording →
                </Link>
              </div>
            ) : (
              (data?.recent_evals ?? []).map((ev, i) => {
                const score = ev.coaching_score ?? 0;
                return (
                  <div key={ev.id} style={{ padding: '11px 18px', borderBottom: i < (data?.recent_evals ?? []).length - 1 ? '1px solid #F8F7F4' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A18' }}>{ev.file_name.slice(0, 22)}{ev.file_name.length > 22 ? '...' : ''}</div>
                      <div style={{ fontSize: 11, color: '#888780' }}>{new Date(ev.uploaded_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                    </div>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: scoreBg(score), border: `2px solid ${scoreColor(score)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: scoreColor(score) }}>
                      {score}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Upcoming Events */}
          <div style={{ background: '#fff', border: '1px solid #E8E6DF', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid #F1EFE8' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A18' }}>Upcoming Events</span>
            </div>
            {loading ? (
              <div style={{ padding: '24px 18px', color: '#888780', fontSize: 13 }}>Loading...</div>
            ) : (data?.upcoming_events ?? []).length === 0 ? (
              <div style={{ padding: '24px 18px', color: '#888780', fontSize: 13 }}>No upcoming events.</div>
            ) : (
              (data?.upcoming_events ?? []).map((ev, i) => {
                const date = new Date(ev.event_date);
                const day = date.toLocaleDateString('en-IN', { day: 'numeric' });
                const month = date.toLocaleDateString('en-IN', { month: 'short' });
                const isHoliday = ev.is_holiday;
                return (
                  <div key={ev.id} style={{ padding: '12px 18px', borderBottom: i < (data?.upcoming_events ?? []).length - 1 ? '1px solid #F8F7F4' : 'none', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 40, height: 40, borderRadius: 10, background: isHoliday ? '#FAEEDA' : '#E1F5EE', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: isHoliday ? '#854F0B' : '#0F6E56', lineHeight: 1 }}>{day}</span>
                      <span style={{ fontSize: 9, color: isHoliday ? '#854F0B' : '#0F6E56', fontWeight: 600 }}>{month}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A18' }}>{ev.title}</div>
                      {ev.description && <div style={{ fontSize: 11, color: '#888780', marginTop: 2, lineHeight: 1.4 }}>{ev.description.slice(0, 60)}{ev.description.length > 60 ? '...' : ''}</div>}
                      {isHoliday && <span style={{ fontSize: 10, fontWeight: 700, color: '#854F0B', background: '#FAEEDA', padding: '1px 6px', borderRadius: 4, marginTop: 3, display: 'inline-block' }}>HOLIDAY</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>

        {/* Footer */}
        <div style={{ marginTop: 32, padding: '16px 0', borderTop: '1px solid #E8E6DF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#B4B2A9' }}>School OS · Suchitra Academy · Powered by Claude AI</span>
          <div style={{ display: 'flex', gap: 16 }}>
            {[{ href: '/report-cards', label: 'Report Cards' }, { href: '/teacher-eval', label: 'Teacher Eval' }, { href: '/admissions/crm', label: 'CRM' }].map(l => (
              <Link key={l.href} href={l.href} style={{ fontSize: 12, color: '#888780', textDecoration: 'none' }}>{l.label}</Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
