'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { T } from '@/lib/i18n';
import { useLang } from '@/lib/useLang';

interface KPIs {
  total_students: number; total_staff: number; pending_fees_count: number;
  pending_fees_amount: number; total_leads: number; high_priority_leads: number;
  evals_done: number; narratives_generated: number;
}
interface Lead { id: string; parent_name: string; child_name: string | null; child_age: number; target_class: string; source: string; score: number; priority: string; status: string; created_at: string; }
interface Eval { id: string; file_name: string; coaching_score: number | null; eval_report: string | null; status: string; uploaded_at: string; }
interface Event { id: string; title: string; event_date: string; is_holiday: boolean; description: string | null; }

// ── P3 STEP 3.2 — DASHBOARD WIDGET POLYMORPHISM ────────────────────────────
// Per the EdProSys Implementation Bible, the dashboard should filter widgets
// per institution_type. The Bible specifies a DASHBOARD_WIDGETS_BY_TYPE map
// that includes future backend KPIs (placement_status, hostel_occupancy,
// beneficiary_count, etc.). Until those backend KPIs ship, we filter the
// surfaces that *do* exist today: the 5 platform module tiles, the KPI cards,
// and the bottom-3 panels (top leads, teacher evals, upcoming events).
//
// Suchitra (school_k12 / private) sees all widgets shown — unchanged.
// Other institution types see only widgets that apply to their model.

const GOVT_TYPES = new Set(['govt_school', 'govt_aided_school', 'welfare_school', 'anganwadi']);
const HIGHER_ED_TYPES = new Set(['degree_college', 'engineering', 'polytechnic', 'mba', 'medical', 'university', 'junior_college', 'intermediate_college']);
const PRE_PRIMARY_TYPES = new Set(['pre_school', 'kg', 'anganwadi']);
const COACHING_TYPES = new Set(['coaching', 'coaching_center', 'tuition_center']);

interface InstitutionContext {
  type: string;
  ownership: string;
  isGovernment: boolean;
  isHigherEducation: boolean;
  isPrePrimary: boolean;
  isCoaching: boolean;
  isAnganwadi: boolean;
}

function buildInstitutionContext(type: string, ownership: string): InstitutionContext {
  return {
    type, ownership,
    isGovernment: GOVT_TYPES.has(type) || ownership === 'government',
    isHigherEducation: HIGHER_ED_TYPES.has(type),
    isPrePrimary: PRE_PRIMARY_TYPES.has(type),
    isCoaching: COACHING_TYPES.has(type),
    isAnganwadi: type === 'anganwadi',
  };
}

const DEFAULT_CTX: InstitutionContext = buildInstitutionContext('school_k12', 'private');
const ALWAYS_SHOW = (_ctx: InstitutionContext) => true;

function scoreColor(s: number) { return s >= 8 ? '#15803D' : s >= 6 ? '#A16207' : '#B91C1C'; }
function scoreBg(s: number) { return s >= 8 ? '#DCFCE7' : s >= 6 ? '#FEF9C3' : '#FEE2E2'; }

const SOURCE_LABEL: Record<string, string> = { referral: 'Referral', google: 'Google', website: 'Website', instagram: 'Instagram', facebook: 'Facebook', 'walk-in': 'Walk-in', other: 'Other' };

const EMPTY_KPIS: KPIs = { total_students: 0, total_staff: 0, pending_fees_count: 0, pending_fees_amount: 0, total_leads: 0, high_priority_leads: 0, evals_done: 0, narratives_generated: 0 };

export default function DashboardPage() {
  // Single hook — replaces useState<Lang> + duplicated useEffect
  const { lang } = useLang();

  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [evals, setEvals] = useState<Eval[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [legalPendingCount, setLegalPendingCount] = useState(0);
  const [setupIncomplete, setSetupIncomplete] = useState(false);
  // P3 3.2: institution context drives widget filtering
  const [ctx, setCtx] = useState<InstitutionContext>(DEFAULT_CTX);

  useEffect(() => {
    const timeout = setTimeout(() => { setLoading(false); if (!kpis) setKpis(EMPTY_KPIS); }, 8000);
    fetch('/api/dashboard/summary')
      .then(r => r.json())
      .then(d => {
        // API returns a flat summary ({ total_students, ... }).
        // Older builds nested it under d.kpis — accept both so neither regresses.
        const src = (d?.kpis && typeof d.kpis.total_students === 'number') ? d.kpis
                  : (d && typeof d.total_students === 'number') ? d
                  : null;
        if (src) {
          setKpis({
            total_students:       src.total_students,
            total_staff:          src.total_staff ?? 0,
            pending_fees_count:   src.pending_fees_count ?? 0,
            pending_fees_amount:  src.pending_fees_amount ?? 0,
            total_leads:          src.total_leads ?? 0,
            high_priority_leads:  src.high_priority_leads ?? 0,
            evals_done:           src.evals_done ?? 0,
            narratives_generated: src.narratives_generated ?? 0,
          });
          setLeads(d.recent_leads ?? []);
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

  // P3 3.2: fetch institution context to drive widget visibility
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && (d.institution_type || d.ownership_type)) {
          setCtx(buildInstitutionContext(
            d.institution_type ?? 'school_k12',
            d.ownership_type ?? 'private',
          ));
        }
      })
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

  // P3 3.2: KPI card definitions with showFor predicates. Defaults to "show
  // for all" so Suchitra is byte-equivalent.
  const allKpiCards = [
    {
      key: 'students',
      value: safeKpis.total_students,
      sub: T('active_enrolments', lang),
      color: '#4F46E5',
      bg: '#EEF2FF',
      href: '/students',
      showFor: ALWAYS_SHOW,
    },
    {
      key: 'staff',
      value: safeKpis.total_staff,
      sub: T('active_staff', lang),
      color: '#0284C7',
      bg: '#E0F2FE',
      href: '/admin/staff',
      showFor: ALWAYS_SHOW,
    },
    {
      key: 'fees',
      value: safeKpis.pending_fees_count,
      sub: `₹${Math.round(safeKpis.pending_fees_amount / 1000)}K ${T('outstanding', lang)}`,
      color: hasFeeAlert ? '#B91C1C' : '#15803D',
      bg: hasFeeAlert ? '#FEF2F2' : '#ECFDF5',
      href: '/admin/fees',
      // Govt and anganwadi don't run platform-managed fees.
      showFor: (c: InstitutionContext) => !c.isGovernment && !c.isAnganwadi,
    },
    {
      key: 'leads_hp',
      value: safeKpis.total_leads,
      sub: `${safeKpis.high_priority_leads} ${T('leads_hp', lang)}`,
      color: '#6D28D9',
      bg: '#F5F3FF',
      href: '/admissions/crm',
      // Anganwadi doesn't run an admissions funnel.
      showFor: (c: InstitutionContext) => !c.isAnganwadi,
    },
  ];
  const visibleKpiCards = allKpiCards.filter(k => k.showFor(ctx));

  // P3 3.2: Platform module tiles with showFor predicates.
  const allModules = [
    {
      key: 'report_cards', href: '/report-cards', icon: '📄',
      color: '#15803D', bg: '#DCFCE7',
      // Anganwadi tracks developmental milestones separately; coaching uses
      // test series rather than report cards.
      showFor: (c: InstitutionContext) => !c.isAnganwadi && !c.isCoaching,
    },
    {
      key: 'teacher_eval', href: '/teacher-eval', icon: '🎙',
      color: '#1D4ED8', bg: '#DBEAFE',
      // Teacher evaluation applies to all institution types.
      showFor: ALWAYS_SHOW,
    },
    {
      key: 'admissions', href: '/admissions/crm', icon: '👥',
      color: '#6D28D9', bg: '#EDE9FE',
      // No admissions funnel for anganwadi.
      showFor: (c: InstitutionContext) => !c.isAnganwadi,
    },
    {
      key: 'whatsapp_bot', href: '/whatsapp', icon: '💬',
      color: '#065F46', bg: '#D1FAE5',
      showFor: ALWAYS_SHOW,
    },
    {
      key: 'events_gallery', href: '/admin/events', icon: '📸',
      color: '#9333EA', bg: '#F5F3FF',
      showFor: ALWAYS_SHOW,
    },
  ];
  const visibleModules = allModules.filter(m => m.showFor(ctx));

  // P3 3.2: Bottom-panel visibility. Top leads only when admissions makes
  // sense; teacher evals everywhere; upcoming events everywhere.
  const showTopLeadsPanel = !ctx.isAnganwadi;
  const showTeacherEvalsPanel = true;
  const showUpcomingEventsPanel = true;
  const visibleBottomCount = [showTopLeadsPanel, showTeacherEvalsPanel, showUpcomingEventsPanel].filter(Boolean).length;

  return (
    <Layout title={T('dashboard', lang)} subtitle={today}
      actions={
        !ctx.isAnganwadi ? (
          <Link href="/admissions" style={{ padding: '8px 14px', background: '#4F46E5', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>+ {T('new_inquiry', lang)}</Link>
        ) : null
      }>

      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        .kpi-grid { display: grid; gap: 12px; grid-template-columns: repeat(2, 1fr); }
        @media(min-width:640px){ .kpi-grid { grid-template-columns: repeat(${Math.max(visibleKpiCards.length, 1)}, 1fr); } }
        .mod-grid { display: grid; gap: 12px; grid-template-columns: repeat(2, 1fr); }
        @media(min-width:640px){ .mod-grid { grid-template-columns: repeat(3, 1fr); } }
        @media(min-width:900px){ .mod-grid { grid-template-columns: repeat(${Math.max(visibleModules.length, 1)}, 1fr); } }
        .bottom-grid { display: grid; gap: 14px; grid-template-columns: 1fr; }
        @media(min-width:768px){ .bottom-grid { grid-template-columns: repeat(${Math.max(visibleBottomCount, 1)}, 1fr); } }
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

      {/* P3 3.2: hide fee alert for institutions that don't run platform fees */}
      {hasFeeAlert && !ctx.isGovernment && !ctx.isAnganwadi && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#B91C1C' }}>💰 ₹{(safeKpis.pending_fees_amount / 1000).toFixed(1)}K {T('fees_outstanding', lang)}</div>
            <div style={{ fontSize: 12, color: '#B91C1C', marginTop: 2 }}>{safeKpis.pending_fees_count} {T('students', lang)} · {T('pending', lang)}</div>
          </div>
          <a href="/admin/fees" style={{ padding: '7px 14px', background: '#B91C1C', color: '#fff', borderRadius: 7, fontSize: 12, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>View {T('fees', lang)} →</a>
        </div>
      )}

      {/* KPI cards */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        {visibleKpiCards.map(k => (
          <Link key={k.key} href={k.href} style={{ textDecoration: 'none' }}>
            <div className="kpi-card-inner">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{T(k.key, lang)}</div>
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

      {/* Platform modules */}
      {visibleModules.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>{T('platform', lang)}</div>
          <div className="mod-grid" style={{ marginBottom: 24 }}>
            {visibleModules.map(mod => (
              <Link key={mod.key} href={mod.href} style={{ textDecoration: 'none' }}>
                <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '16px 14px', cursor: 'pointer' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: mod.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 10 }}>{mod.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#111827', marginBottom: 3 }}>{T(mod.key, lang)}</div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Bottom panels */}
      <div className="bottom-grid">
        {showTopLeadsPanel && (
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{T('top_leads', lang)}</div>
              <Link href="/admissions/crm" style={{ fontSize: 12, color: '#4F46E5', textDecoration: 'none', fontWeight: 600 }}>{T('view_all', lang)} →</Link>
            </div>
            {leads.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 16px', color: '#9CA3AF', fontSize: 13 }}>👥 {T('no_leads', lang)}</div>
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
        )}

        {showTeacherEvalsPanel && (
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{T('teacher_evals', lang)}</div>
              <Link href="/teacher-eval" style={{ fontSize: 12, color: '#4F46E5', textDecoration: 'none', fontWeight: 600 }}>{T('view_all', lang)} →</Link>
            </div>
            {evals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 16px', color: '#9CA3AF', fontSize: 13 }}>🎙 {T('no_eval', lang)}</div>
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
        )}

        {showUpcomingEventsPanel && (
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{T('upcoming_events', lang)}</div>
            </div>
            {events.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 16px', color: '#9CA3AF', fontSize: 13 }}>📅 {T('no_events', lang)}</div>
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
        )}
      </div>
    </Layout>
  );
}
