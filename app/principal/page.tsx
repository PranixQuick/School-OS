'use client';

// PATH: app/principal/page.tsx
//
// Principal Dashboard — real-time decision-focused view.
// Shows attendance %, fee collection %, at-risk students,
// admissions funnel, and teacher performance.

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';

interface AttData { today_pct: number | null; today_present: number; today_total: number; today_marked: boolean; month_avg_pct: number; status: string; }
interface FeeData { pending_amount: number; pending_students: number; overdue_count: number; collected_month: number; collection_pct: number; status: string; }
interface RiskCase { name: string; class: string; risk_level: string; summary: string; }
interface RiskData { critical: number; high: number; medium: number; total: number; top_cases: RiskCase[]; }
interface AdmissionsData { total_30d: number; new: number; contacted: number; visit_scheduled: number; high_priority: number; admitted_month: number; conversion_rate: number; }
interface TeacherData { present_today: number; total_tracked: number; absent_today: string[]; avg_eval_score: number | null; evals_this_week: number; status: string; }
interface Event { title: string; event_date: string; is_holiday: boolean; }
interface Briefing { briefing_text: string; generated_at: string; }

// Item #6 minimum additions — 3 new KPIs + 2 drill-down sections
interface ExtraKPIs {
  pending_leave_count: number;
  proofs_to_review_count: number;
  comm_last_24h_count: number;
}

// Item #6 PR #2 — drill-down section interfaces
interface AdmissionsStatusGroup { status: string; count: number; avg_score: number; oldest_age_days: number; high_priority: number; }
interface AdmissionsInquiry { id: string; parent_name: string | null; child_name: string | null; priority: string | null; status: string | null; score: number | null; age_days: number; }
interface OverdueFee { id: string; student_name: string; class_label: string; amount: number; fee_type: string | null; status: string; due_date: string; days_past_due: number; intervention_status: string | null; intervention_notes: string | null; }
interface LeaveItem { id: string; staff_name: string; leave_type: string; from_date: string; to_date: string; reason: string | null; }
interface ProofItem { id: string; staff_name: string; class_label: string; taken_at: string; signed_url: string | null; }
interface CommGroup { module: string; total: number; last_24h: number; }

interface DashboardData {
  as_of: string;
  today: string;
  attendance: AttData;
  fees: FeeData;
  risk: RiskData;
  admissions: AdmissionsData;
  teachers: TeacherData;
  upcoming_events: Event[];
  briefing: Briefing | null;
}

const STATUS_COLOR = {
  good:    { bg: '#DCFCE7', color: '#15803D', dot: '#22C55E' },
  warning: { bg: '#FEF9C3', color: '#A16207', dot: '#F59E0B' },
  critical:{ bg: '#FEE2E2', color: '#B91C1C', dot: '#EF4444' },
  not_marked:{ bg: '#F3F4F6', color: '#6B7280', dot: '#9CA3AF' },
};

const RISK_BADGE: Record<string, { bg: string; color: string }> = {
  critical: { bg: '#FEE2E2', color: '#B91C1C' },
  high:     { bg: '#FEF9C3', color: '#A16207' },
  medium:   { bg: '#EEF2FF', color: '#4F46E5' },
  low:      { bg: '#F3F4F6', color: '#6B7280' },
};

function StatusDot({ status }: { status: string }) {
  const s = STATUS_COLOR[status as keyof typeof STATUS_COLOR] ?? STATUS_COLOR.not_marked;
  return <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot, display: 'inline-block', marginRight: 6 }} />;
}

function MetricCard({ label, value, sub, status, href, icon }: {
  label: string; value: string | number; sub: string; status: string; href?: string; icon: string;
}) {
  const s = STATUS_COLOR[status as keyof typeof STATUS_COLOR] ?? STATUS_COLOR.not_marked;
  const inner = (
    <div className="card" style={{ borderLeft: `4px solid ${s.dot}`, cursor: href ? 'pointer' : 'default' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#6B7280' }}>{label}</span>
        <span style={{ fontSize: 20 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 36, fontWeight: 900, color: s.color, lineHeight: 1, marginBottom: 6 }}>{value}</div>
      <div style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: '#6B7280' }}>
        <StatusDot status={status} />
        {sub}
      </div>
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: 'none' }}>{inner}</Link> : inner;
}

export default function PrincipalDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);
  // Item #6 additions
  const [extraKpis, setExtraKpis] = useState<ExtraKPIs | null>(null);
  // Item #6 PR #2 — drill-down state
  const [admissions, setAdmissions] = useState<{ by_status: AdmissionsStatusGroup[]; inquiries: AdmissionsInquiry[]; total: number; high_priority_count: number } | null>(null);
  const [overdueFees, setOverdueFees] = useState<{ fees: OverdueFee[]; total_count: number; total_amount: number; with_intervention_count: number } | null>(null);
  const [leaveList, setLeaveList] = useState<LeaveItem[] | null>(null);
  const [proofsList, setProofsList] = useState<ProofItem[] | null>(null);
  const [commGroups, setCommGroups] = useState<CommGroup[] | null>(null);

  useEffect(() => { fetch_data(); }, []);

  async function fetch_data() {
    setRefreshing(true);
    try {
      const [res, leaveRes, proofsRes, commRes, admRes, feesRes] = await Promise.all([
        fetch('/api/principal/dashboard'),
        fetch('/api/principal/leave-approvals').catch(() => null),
        fetch('/api/principal/classroom-proofs').catch(() => null),
        fetch('/api/principal/communications').catch(() => null),
        fetch('/api/principal/admissions-pipeline').catch(() => null),
        fetch('/api/principal/fees-overdue').catch(() => null),
      ]);
      const d = await res.json() as DashboardData;
      setData(d);
      // Item #6 extras — best-effort, silent failure
      const leaveJson = leaveRes && leaveRes.ok ? await leaveRes.json() : null;
      const proofsJson = proofsRes && proofsRes.ok ? await proofsRes.json() : null;
      const commJson = commRes && commRes.ok ? await commRes.json() : null;
      setExtraKpis({
        pending_leave_count: leaveJson?.pending_count ?? 0,
        proofs_to_review_count: proofsJson?.pending_count ?? 0,
        comm_last_24h_count: commJson?.total_last_24h ?? 0,
      });
      // Item #6 PR #2 — populate drill-down lists
      const admJson = admRes && admRes.ok ? await admRes.json() : null;
      const feesJson = feesRes && feesRes.ok ? await feesRes.json() : null;
      setAdmissions(admJson);
      setOverdueFees(feesJson);
      setLeaveList(leaveJson?.pending ?? []);
      setProofsList(proofsJson?.pending ?? []);
      setCommGroups(commJson?.by_module ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const d = data;

  return (
    <Layout
      title="Principal Dashboard"
      subtitle={d ? `Live · ${new Date(d.as_of).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Loading...'}
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          {d?.briefing && (
            <button onClick={() => setShowBriefing(true)} className="btn btn-ghost btn-sm">
              📋 Today's Briefing
            </button>
          )}
          <button onClick={fetch_data} disabled={refreshing} className="btn btn-ghost btn-sm">
            {refreshing ? '↻ Refreshing...' : '↻ Refresh'}
          </button>
        </div>
      }
    >
      {loading ? (
        <div className="card"><div className="empty-state"><div className="empty-state-icon">📊</div><div className="empty-state-title">Loading dashboard...</div></div></div>
      ) : !d ? (
        <div className="alert alert-error">Failed to load dashboard data.</div>
      ) : (
        <>
          {/* Top KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
            <MetricCard
              label="Student Attendance Today"
              value={d.attendance.today_pct !== null ? `${d.attendance.today_pct}%` : '—'}
              sub={d.attendance.today_marked
                ? `${d.attendance.today_present}/${d.attendance.today_total} students · ${d.attendance.month_avg_pct}% monthly avg`
                : 'Not marked yet today'}
              status={d.attendance.status}
              href="/students"
              icon="👨‍🎓"
            />
            <MetricCard
              label="Fee Collection (This Month)"
              value={`${d.fees.collection_pct}%`}
              sub={`₹${Math.round(d.fees.pending_amount / 1000)}K pending · ${d.fees.overdue_count} overdue`}
              status={d.fees.status}
              href="/billing"
              icon="💳"
            />
            <MetricCard
              label="At-Risk Students"
              value={d.risk.total}
              sub={`${d.risk.critical} critical · ${d.risk.high} high · ${d.risk.medium} medium`}
              status={d.risk.critical > 0 ? 'critical' : d.risk.high > 0 ? 'warning' : 'good'}
              href="/automation/risk"
              icon="⚠️"
            />
            <MetricCard
              label="Teacher Attendance"
              value={d.teachers.total_tracked > 0
                ? `${d.teachers.present_today}/${d.teachers.total_tracked}`
                : '—'}
              sub={d.teachers.total_tracked > 0
                ? `${d.teachers.absent_today.length > 0 ? `Absent: ${d.teachers.absent_today.slice(0, 2).join(', ')}` : 'All present'}`
                : 'Not marked yet'}
              status={d.teachers.status}
              href="/automation/teacher-attendance"
              icon="👩‍🏫"
            />
          </div>

          {/* Item #6 — Principal-specific operational KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
            <MetricCard
              label="Pending Leave Approvals"
              value={extraKpis?.pending_leave_count ?? '—'}
              sub={extraKpis && extraKpis.pending_leave_count > 0 ? 'Awaiting your decision' : 'All caught up'}
              status={extraKpis && extraKpis.pending_leave_count > 0 ? 'warning' : 'good'}
              href="#principal-leave-approvals"
              icon="🗓️"
            />
            <MetricCard
              label="Proofs to Review"
              value={extraKpis?.proofs_to_review_count ?? '—'}
              sub={extraKpis && extraKpis.proofs_to_review_count > 0 ? 'Classroom photos pending audit' : 'No proofs pending'}
              status={extraKpis && extraKpis.proofs_to_review_count > 0 ? 'warning' : 'good'}
              href="#principal-classroom-proofs"
              icon="📷"
            />
            <MetricCard
              label="Parent Communications (24h)"
              value={extraKpis?.comm_last_24h_count ?? '—'}
              sub={extraKpis && extraKpis.comm_last_24h_count > 0 ? 'Notifications sent today' : 'Quiet today'}
              status={'good'}
              href="#principal-communications"
              icon="💬"
            />
          </div>

          {/* Item 10: ops quick links */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
            <Link href="/automation/geofence" style={{ textDecoration: 'none' }}>
              <div className="card-sm" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer' }}>
                <span style={{ fontSize: 18 }}>📍</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Geofence & Presence</div>
                  <div style={{ fontSize: 11, color: '#6B7280' }}>Define school polygon, view today's teacher pings</div>
                </div>
              </div>
            </Link>
            {/* Item 11: substitute assignments quick link */}
            <Link href="/automation/substitutes" style={{ textDecoration: 'none' }}>
              <div className="card-sm" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer' }}>
                <span style={{ fontSize: 18 }}>⚡</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Substitute Assignments</div>
                  <div style={{ fontSize: 11, color: '#6B7280' }}>Assign coverage when teachers are late or absent</div>
                </div>
              </div>
            </Link>
            {/* Item 11: classroom proofs quick link */}
            <Link href="/automation/classroom-proofs" style={{ textDecoration: 'none' }}>
              <div className="card-sm" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer' }}>
                <span style={{ fontSize: 18 }}>📷</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Classroom Proofs</div>
                  <div style={{ fontSize: 11, color: '#6B7280' }}>Review photos teachers uploaded as proof of presence</div>
                </div>
              </div>
            </Link>
            {/* Item 12: lesson plan coverage quick link */}
            <Link href="/automation/lesson-plans-coverage" style={{ textDecoration: 'none' }}>
              <div className="card-sm" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer' }}>
                <span style={{ fontSize: 18 }}>📊</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Lesson Plan Coverage</div>
                  <div style={{ fontSize: 11, color: '#6B7280' }}>Per-class rollup of planned vs completed</div>
                </div>
              </div>
            </Link>
          </div>

          {/* Second row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>

            {/* Admissions funnel */}
            <div className="card">
              <div className="section-header">
                <div>
                  <div className="section-title">Admissions Funnel</div>
                  <div className="section-sub">Last 30 days · {d.admissions.total_30d} total leads</div>
                </div>
                <Link href="/admissions/crm" style={{ fontSize: 12, color: '#4F46E5', textDecoration: 'none', fontWeight: 600 }}>CRM →</Link>
              </div>

              {[
                { label: 'New Enquiries', count: d.admissions.new, color: '#4F46E5', bg: '#EEF2FF' },
                { label: 'Contacted', count: d.admissions.contacted, color: '#A16207', bg: '#FEF9C3' },
                { label: 'Visit Scheduled', count: d.admissions.visit_scheduled, color: '#065F46', bg: '#ECFDF5' },
                { label: 'Admitted This Month', count: d.admissions.admitted_month, color: '#15803D', bg: '#DCFCE7' },
              ].map(stage => (
                <div key={stage.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, color: '#374151' }}>{stage.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 80, height: 6, borderRadius: 3, background: '#F3F4F6', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${d.admissions.total_30d > 0 ? Math.min(100, Math.round((stage.count / d.admissions.total_30d) * 100)) : 0}%`, background: stage.color, borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 800, color: stage.color, minWidth: 28, textAlign: 'right' }}>{stage.count}</span>
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 10, padding: '8px 12px', background: '#F9FAFB', borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#6B7280' }}>High priority leads</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#4F46E5' }}>{d.admissions.high_priority}</span>
              </div>
            </div>

            {/* At-risk students detail */}
            <div className="card">
              <div className="section-header">
                <div>
                  <div className="section-title">Urgent: At-Risk Students</div>
                  <div className="section-sub">Needs immediate attention</div>
                </div>
                <Link href="/automation/risk" style={{ fontSize: 12, color: '#4F46E5', textDecoration: 'none', fontWeight: 600 }}>View all →</Link>
              </div>

              {d.risk.top_cases.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: '#9CA3AF', fontSize: 14 }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>✅</div>
                  No unresolved risk flags
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {d.risk.top_cases.slice(0, 4).map((c, i) => {
                    const badge = RISK_BADGE[c.risk_level] ?? RISK_BADGE.low;
                    return (
                      <div key={i} style={{ padding: '8px 10px', background: '#FAFAFA', borderRadius: 8, border: '1px solid #F3F4F6' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                          <span style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{c.name}</span>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={{ fontSize: 11, color: '#6B7280' }}>{c.class}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: badge.bg, color: badge.color }}>
                              {c.risk_level.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.4 }}>{c.summary?.slice(0, 80)}...</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Teacher performance + Events */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Teacher performance */}
              <div className="card">
                <div className="section-header">
                  <div className="section-title">Teacher Performance</div>
                  <Link href="/teacher-eval" style={{ fontSize: 12, color: '#4F46E5', textDecoration: 'none', fontWeight: 600 }}>Evals →</Link>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Avg Eval Score', value: d.teachers.avg_eval_score !== null ? `${d.teachers.avg_eval_score}/10` : '—', icon: '⭐' },
                    { label: 'Evals This Week', value: d.teachers.evals_this_week, icon: '🎙' },
                  ].map(m => (
                    <div key={m.label} style={{ background: '#F9FAFB', borderRadius: 10, padding: '10px 12px' }}>
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>{m.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>{m.icon} {m.value}</div>
                    </div>
                  ))}
                </div>
                {d.teachers.absent_today.length > 0 && (
                  <div style={{ marginTop: 10, padding: '8px 10px', background: '#FEF2F2', borderRadius: 8, fontSize: 12, color: '#B91C1C' }}>
                    <strong>Absent today:</strong> {d.teachers.absent_today.join(', ')}
                  </div>
                )}
              </div>

              {/* Upcoming events */}
              <div className="card">
                <div className="section-header">
                  <div className="section-title">Next 7 Days</div>
                </div>
                {d.upcoming_events.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#9CA3AF' }}>No events scheduled</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {d.upcoming_events.map((ev, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: ev.is_holiday ? '#FEE2E2' : '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: ev.is_holiday ? '#B91C1C' : '#4F46E5', flexShrink: 0, lineHeight: 1.1, textAlign: 'center' }}>
                          {new Date(ev.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }).split(' ').map((p, j) => <div key={j}>{p}</div>)}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{ev.title}</div>
                          {ev.is_holiday && <span style={{ fontSize: 10, fontWeight: 700, color: '#B91C1C' }}>HOLIDAY</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Fee details bar */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div className="section-title">Fee Collection Status</div>
                <div className="section-sub">Current month · {d.fees.collection_pct}% collected</div>
              </div>
              <Link href="/billing" style={{ fontSize: 12, color: '#4F46E5', textDecoration: 'none', fontWeight: 600 }}>View billing →</Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
              {[
                { label: 'Collected Month', value: `₹${Math.round(d.fees.collected_month / 1000)}K`, color: '#15803D', bg: '#DCFCE7' },
                { label: 'Pending Total', value: `₹${Math.round(d.fees.pending_amount / 1000)}K`, color: '#A16207', bg: '#FEF9C3' },
                { label: 'Overdue Accounts', value: d.fees.overdue_count, color: '#B91C1C', bg: '#FEE2E2' },
                { label: 'Students with Dues', value: d.fees.pending_students, color: '#374151', bg: '#F3F4F6' },
              ].map(k => (
                <div key={k.label} style={{ background: k.bg, borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: k.color }}>{k.value}</div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 3 }}>{k.label}</div>
                </div>
              ))}
            </div>
            <div className="progress-bar" style={{ height: 10 }}>
              <div className="progress-fill" style={{
                width: `${d.fees.collection_pct}%`,
                background: d.fees.collection_pct >= 80 ? '#22C55E' : d.fees.collection_pct >= 60 ? '#F59E0B' : '#EF4444',
              }} />
            </div>
          </div>
          {/* Item #6 PR #2 — Drill-down sections */}

          {/* Admissions Pipeline (Loop 1) */}
          <div id="principal-admissions-pipeline" className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div className="section-title">Admissions Pipeline (last 90 days)</div>
                <div className="section-sub">{admissions ? `${admissions.total} inquiries · ${admissions.high_priority_count} high priority` : 'Loading...'}</div>
              </div>
              <Link href="/automation/admissions" style={{ fontSize: 12, color: '#4F46E5', textDecoration: 'none', fontWeight: 600 }}>Full admissions →</Link>
            </div>
            {admissions && admissions.by_status.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 14 }}>
                {admissions.by_status.map(g => (
                  <div key={g.status} style={{ background: '#F3F4F6', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>{g.status}</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#374151' }}>{g.count}</div>
                    <div style={{ fontSize: 10, color: '#6B7280' }}>avg score {g.avg_score} · oldest {g.oldest_age_days}d</div>
                  </div>
                ))}
              </div>
            )}
            {admissions && admissions.inquiries.length > 0 ? (
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {admissions.inquiries.slice(0, 10).map(i => (
                  <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{i.parent_name || '—'} <span style={{ color: '#9CA3AF', fontWeight: 400 }}>for {i.child_name || '—'}</span></div>
                      <div style={{ fontSize: 11, color: '#6B7280' }}>{i.status} · {i.priority || 'normal'} · score {i.score ?? 0}</div>
                    </div>
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>{i.age_days}d ago</span>
                  </div>
                ))}
              </div>
            ) : admissions ? (
              <div style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: '12px 0' }}>No inquiries in the last 90 days.</div>
            ) : null}
          </div>

          {/* Overdue Fees with Intervention (Loop 2) */}
          <div id="principal-fees-overdue" className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div className="section-title">Overdue Fees · Intervention Tracking</div>
                <div className="section-sub">{overdueFees ? `${overdueFees.total_count} accounts · ₹${Math.round(overdueFees.total_amount / 1000)}K total · ${overdueFees.with_intervention_count} with intervention` : 'Loading...'}</div>
              </div>
              <Link href="/billing" style={{ fontSize: 12, color: '#4F46E5', textDecoration: 'none', fontWeight: 600 }}>Full billing →</Link>
            </div>
            {overdueFees && overdueFees.fees.length > 0 ? (
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {overdueFees.fees.slice(0, 15).map(f => (
                  <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F3F4F6', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{f.student_name} <span style={{ color: '#9CA3AF', fontWeight: 400 }}>· {f.class_label}</span></div>
                      <div style={{ fontSize: 11, color: '#6B7280' }}>{f.fee_type || 'Fee'} · due {f.due_date} · {f.days_past_due}d past due</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#B91C1C' }}>₹{Math.round(Number(f.amount))}</div>
                      {f.intervention_status ? (
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#15803D', background: '#DCFCE7', padding: '2px 6px', borderRadius: 4 }}>{f.intervention_status.replace(/_/g, ' ')}</span>
                      ) : (
                        <span style={{ fontSize: 10, color: '#9CA3AF' }}>no intervention</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : overdueFees ? (
              <div style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: '12px 0' }}>No overdue fees. Nice.</div>
            ) : null}
          </div>

          {/* Pending Leave Approvals (Loop 3) */}
          <div id="principal-leave-approvals" className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="section-title">Pending Leave Approvals</div>
              <Link href="/automation/teacher-attendance" style={{ fontSize: 12, color: '#4F46E5', textDecoration: 'none', fontWeight: 600 }}>Manage →</Link>
            </div>
            {leaveList && leaveList.length > 0 ? (
              <div>
                {leaveList.slice(0, 8).map(l => (
                  <div key={l.id} style={{ padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{l.staff_name} <span style={{ color: '#9CA3AF', fontWeight: 400 }}>· {l.leave_type}</span></div>
                    <div style={{ fontSize: 11, color: '#6B7280' }}>{l.from_date} → {l.to_date}{l.reason ? ' · ' + l.reason : ''}</div>
                  </div>
                ))}
              </div>
            ) : leaveList ? (
              <div style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: '12px 0' }}>No pending leave requests.</div>
            ) : null}
          </div>

          {/* Classroom Proofs to Review (Loop 4) */}
          <div id="principal-classroom-proofs" className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="section-title">Classroom Proofs to Review</div>
              <Link href="/automation/teacher-attendance" style={{ fontSize: 12, color: '#4F46E5', textDecoration: 'none', fontWeight: 600 }}>Manage →</Link>
            </div>
            {proofsList && proofsList.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                {proofsList.slice(0, 6).map(p => (
                  <div key={p.id} style={{ border: '1px solid #E5E7EB', borderRadius: 8, padding: 10 }}>
                    {p.signed_url && <img src={p.signed_url} alt="" style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 4, marginBottom: 6 }} />}
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{p.staff_name}</div>
                    <div style={{ fontSize: 10, color: '#6B7280' }}>{p.class_label} · {new Date(p.taken_at).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            ) : proofsList ? (
              <div style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: '12px 0' }}>No proofs pending review.</div>
            ) : null}
          </div>

          {/* Recent Parent Communications (Loop 5) */}
          <div id="principal-communications" className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="section-title">Parent Communications by Module (7d)</div>
              <Link href="/automation/notifications" style={{ fontSize: 12, color: '#4F46E5', textDecoration: 'none', fontWeight: 600 }}>Full log →</Link>
            </div>
            {commGroups && commGroups.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                {commGroups.map(g => (
                  <div key={g.module} style={{ background: '#F3F4F6', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', fontWeight: 700 }}>{g.module}</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#374151' }}>{g.total}</div>
                    <div style={{ fontSize: 10, color: '#6B7280' }}>{g.last_24h} in last 24h</div>
                  </div>
                ))}
              </div>
            ) : commGroups ? (
              <div style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: '12px 0' }}>No communications sent in the last 7 days.</div>
            ) : null}
          </div>
        </>
      )}

      {/* Briefing modal */}
      {showBriefing && d?.briefing && (
        <div className="modal-overlay" onClick={() => setShowBriefing(false)}>
          <div className="modal-box" style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 17, color: '#111827' }}>📋 Daily Briefing</div>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                  Generated {new Date(d.briefing.generated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <button onClick={() => setShowBriefing(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9CA3AF' }}>×</button>
            </div>
            <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '16px 18px', fontSize: 14, color: '#374151', lineHeight: 1.8, whiteSpace: 'pre-wrap', maxHeight: 420, overflowY: 'auto' }}>
              {d.briefing.briefing_text}
            </div>
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between' }}>
              <Link href="/automation/briefing" style={{ fontSize: 13, color: '#4F46E5', textDecoration: 'none', fontWeight: 600 }}>View briefing history →</Link>
              <button onClick={() => setShowBriefing(false)} className="btn btn-ghost btn-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
