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

  useEffect(() => { fetch_data(); }, []);

  async function fetch_data() {
    setRefreshing(true);
    try {
      const res = await fetch('/api/principal/dashboard');
      const d = await res.json() as DashboardData;
      setData(d);
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
