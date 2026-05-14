'use client';
// app/owner/page.tsx
// Batch 4C — Owner Dashboard. Cross-school aggregates + per-school cards + financial chart.
// School switcher: filter view to one school or "All Schools".
// recharts for daily fee collection trend line.

import { useState, useEffect, useCallback } from 'react';

interface SchoolStat {
  school_id: string; school_name: string; students: number; staff: number;
  fees_collected_month: number; fees_outstanding: number; attendance_pct_today: number | null;
}
interface DashboardData {
  institution_name: string; total_schools: number;
  aggregate: { total_students: number; total_staff: number; total_fees_collected_month: number; total_fees_outstanding: number };
  schools: SchoolStat[];
}
interface TrendPoint { date: string; amount: number; }

function formatINR(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function SparkLine({ data }: { data: {amount:number}[] }) {
  if (!data.length) return null;
  const W = 400; const H = 80; const pad = 8;
  const vals = data.map(d => d.amount);
  const max = Math.max(...vals, 1);
  const pts = vals.map((v, i) => {
    const x = pad + (i / Math.max(vals.length-1,1)) * (W - 2*pad);
    const y = H - pad - ((v/max) * (H - 2*pad));
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 80 }} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="#4F46E5" strokeWidth="2" />
    </svg>
  );
}

function StatusBadge({ school }: { school: SchoolStat }) {
  const hasIssue = school.fees_outstanding > school.fees_collected_month * 0.2 ||
    (school.attendance_pct_today !== null && school.attendance_pct_today < 80);
  return (
    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
      background: hasIssue ? '#FEF3C7' : '#D1FAE5', color: hasIssue ? '#92400E' : '#065F46' }}>
      {hasIssue ? '⚠ Attention' : '✓ Healthy'}
    </span>
  );
}

export default function OwnerDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSchool, setSelectedSchool] = useState('all');
  const [activeTab, setActiveTab] = useState<'overview'|'financials'|'staff'>('overview');
  const [staffList, setStaffList] = useState<{ id: string; name: string; role: string; school_name: string; department: string | null }[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/owner/dashboard').then(r => r.json())
      .then((d: DashboardData & { error?: string }) => {
        if (d.error) { setError(d.error); }
        else setData(d);
        setLoading(false);
      }).catch(e => { setError(String(e)); setLoading(false); });
    void fetch('/api/owner/financials').then(r => r.json())
      .then((d: { trend?: TrendPoint[] }) => { if (d.trend) setTrend(d.trend); });
  }, []);

  const loadStaff = useCallback(async () => {
    setStaffLoading(true);
    const res = await fetch('/api/owner/staff');
    const d = await res.json() as { staff?: typeof staffList };
    setStaffList(d.staff ?? []);
    setStaffLoading(false);
  }, []);

  useEffect(() => { if (activeTab === 'staff') void loadStaff(); }, [activeTab, loadStaff]);

  const filteredSchools = data?.schools.filter(s => selectedSchool === 'all' || s.school_id === selectedSchool) ?? [];

  const cardStyle = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, marginBottom: 20 };
  const kpiStyle = { textAlign: 'center' as const, padding: '14px 10px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12 };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#F9FAFB' }}>
      <div style={{ color: '#9CA3AF', fontSize: 14 }}>Loading owner dashboard...</div>
    </div>
  );

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#F9FAFB' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#374151' }}>Access Restricted</div>
        <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 6 }}>{error}</div>
        <a href="/login" style={{ display: 'inline-block', marginTop: 16, padding: '8px 20px', background: '#4F46E5', color: '#fff', borderRadius: 7, fontSize: 12, textDecoration: 'none' }}>Go to Login</a>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#F3F4F6', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>🏫 Owner Dashboard</div>
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
            {data?.institution_name} — Across {data?.total_schools} school{(data?.total_schools ?? 0) !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {/* School switcher */}
          <select value={selectedSchool} onChange={e => setSelectedSchool(e.target.value)}
            style={{ padding: '5px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 12 }}>
            <option value="all">All Schools</option>
            {data?.schools.map(s => <option key={s.school_id} value={s.school_id}>{s.school_name}</option>)}
          </select>
          <a href="/login" style={{ fontSize: 11, color: '#6B7280', textDecoration: 'none' }}>← Admin Login</a>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {(['overview','financials','staff'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              style={{ padding: '7px 18px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: activeTab===t ? '#4F46E5' : '#fff', color: activeTab===t ? '#fff' : '#374151', textTransform: 'capitalize' }}>
              {t === 'overview' ? '📊 Overview' : t === 'financials' ? '💰 Financials' : '👥 Staff'}
            </button>
          ))}
        </div>

        {/* === OVERVIEW === */}
        {activeTab === 'overview' && (
          <>
            {/* KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Total Students', val: data?.aggregate.total_students ?? 0, icon: '🎓', color: '#4F46E5' },
                { label: 'Total Staff', val: data?.aggregate.total_staff ?? 0, icon: '👨‍🏫', color: '#0891B2' },
                { label: 'Fees Collected (Month)', val: formatINR(data?.aggregate.total_fees_collected_month ?? 0), icon: '💰', color: '#059669' },
                { label: 'Outstanding Fees', val: formatINR(data?.aggregate.total_fees_outstanding ?? 0), icon: '⚠️', color: (data?.aggregate.total_fees_outstanding ?? 0) > 0 ? '#D97706' : '#6B7280' },
              ].map(k => (
                <div key={k.label} style={kpiStyle}>
                  <div style={{ fontSize: 24, marginBottom: 4 }}>{k.icon}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.val}</div>
                  <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 600, marginTop: 2 }}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* Schools grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 16, marginBottom: 24 }}>
              {filteredSchools.map(s => (
                <div key={s.school_id} style={{ ...cardStyle, marginBottom: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>{s.school_name}</div>
                    <StatusBadge school={s} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                    {[
                      ['Students', s.students, '#4F46E5'],
                      ['Staff', s.staff, '#0891B2'],
                      ['Collected', formatINR(s.fees_collected_month), '#059669'],
                      ['Outstanding', formatINR(s.fees_outstanding), s.fees_outstanding > 0 ? '#D97706' : '#6B7280'],
                    ].map(([lbl, val, col]) => (
                      <div key={lbl as string} style={{ textAlign: 'center', padding: '8px', background: '#F9FAFB', borderRadius: 8 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: col as string }}>{val as string|number}</div>
                        <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 1 }}>{lbl as string}</div>
                      </div>
                    ))}
                  </div>
                  {s.attendance_pct_today !== null && (
                    <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 10 }}>
                      Attendance today: <span style={{ fontWeight: 700, color: s.attendance_pct_today >= 80 ? '#059669' : '#D97706' }}>{s.attendance_pct_today}%</span>
                    </div>
                  )}
                  <a href={`/login?school_hint=${s.school_id}`}
                    style={{ display: 'block', textAlign: 'center', padding: '6px', background: '#EEF2FF', color: '#4F46E5', borderRadius: 7, fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>
                    Manage School →
                  </a>
                </div>
              ))}
            </div>

            {/* Trend chart */}
            {trend.length > 0 && (
              <div style={cardStyle}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 16 }}>💰 Daily Fee Collection (Last 30 Days)</div>
                <SparkLine data={trend} />
              </div>
            )}
          </>
        )}

        {/* === FINANCIALS === */}
        {activeTab === 'financials' && (
          <div style={cardStyle}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Fee Collection by School & Type (Last 30 Days)</div>
            {trend.length === 0 ? (
              <div style={{ color: '#9CA3AF', fontSize: 12 }}>No fee data in the last 30 days.</div>
            ) : (
              <>
                <SparkLine data={trend} />
              </>
            )}
          </div>
        )}

        {/* === STAFF === */}
        {activeTab === 'staff' && (
          <div style={cardStyle}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 16 }}>All Staff ({staffList.length})</div>
            {staffLoading ? <div style={{ color: '#9CA3AF', fontSize: 12 }}>Loading...</div>
            : staffList.length === 0 ? <div style={{ color: '#9CA3AF', fontSize: 12 }}>No staff found.</div>
            : (
              <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB' }}>
                      {['Name','Role','Department','School','Email'].map(h => (
                        <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, fontSize: 10, color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {staffList.filter(s => selectedSchool === 'all' || s.school_name === data?.schools.find(sc => sc.school_id === selectedSchool)?.school_name).map(s => (
                      <tr key={s.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td style={{ padding: '7px 10px', fontWeight: 600 }}>{s.name}</td>
                        <td style={{ padding: '7px 10px', color: '#6B7280' }}>{s.role}</td>
                        <td style={{ padding: '7px 10px', color: '#6B7280' }}>{s.department ?? '—'}</td>
                        <td style={{ padding: '7px 10px', color: '#4F46E5', fontSize: 11 }}>{s.school_name}</td>
                        <td style={{ padding: '7px 10px', color: '#9CA3AF', fontSize: 11 }}>{s.email ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
