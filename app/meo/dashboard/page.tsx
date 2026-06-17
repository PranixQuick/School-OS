'use client';
// MEO Dashboard — "Mandal Governance Monitor"
// Government schools ONLY — private schools never appear here.
// Read-only: MEO cannot edit school data; only view and export.
// Sections: summary KPIs → urgent action items → school risk ranking → export.

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';

interface SchoolSummary {
  institution_id: string; school_id: string; school_name: string;
  udise_code: string; school_mode: string; mandal_code: string;
  present_today: number; total_students: number;
  teachers_checked_in: number; total_teachers: number;
  teachers_late_today: number; compliance_score: number;
  attendance_as_of: string | null; has_attendance: boolean;
}
interface MEOData {
  mandal_name: string; district_name: string;
  schools: SchoolSummary[];
  date: string;
  action_items_pending: number;
  inspections_due: number;
  teacher_vacancies_total: number;
  infrastructure_deficiencies: number;
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 90 ? '#15803D' : score >= 75 ? '#D97706' : '#B91C1C';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#E5E7EB', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(score, 100)}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 800, color, minWidth: 36, textAlign: 'right' }}>{score}%</span>
    </div>
  );
}

export default function MEODashboardPage() {
  const [data, setData]     = useState<MEOData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [filter, setFilter] = useState<'all'|'critical'|'warning'>('all');
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/meo/dashboard');
      if (r.ok) { const d = await r.json() as MEOData; setData(d); setError(''); }
      else { const d = await r.json() as { error?: string }; setError(d.error ?? 'Failed'); }
    } catch { setError('Network error'); }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const schools = data?.schools ?? [];
  const compliant = schools.filter(s => s.compliance_score >= 90).length;
  const warning   = schools.filter(s => s.compliance_score >= 75 && s.compliance_score < 90).length;
  const critical  = schools.filter(s => s.compliance_score < 75).length;
  const avgScore  = schools.length > 0 ? Math.round(schools.reduce((s, x) => s + x.compliance_score, 0) / schools.length) : 0;

  const filteredSchools = schools
    .filter(s => {
      if (filter === 'critical') return s.compliance_score < 75;
      if (filter === 'warning') return s.compliance_score < 90;
      return true;
    })
    .sort((a, b) => a.compliance_score - b.compliance_score); // worst first

  // Governance alerts
  const govAlerts: { icon: string; text: string; sev: 'red'|'amber' }[] = [];
  if (critical > 0) govAlerts.push({ icon: '🔴', text: `${critical} school(s) below 75% compliance`, sev: 'red' });
  if ((data?.action_items_pending ?? 0) > 0) govAlerts.push({ icon: '📋', text: `${data!.action_items_pending} action item(s) pending closure`, sev: 'amber' });
  if ((data?.inspections_due ?? 0) > 0) govAlerts.push({ icon: '🔍', text: `${data!.inspections_due} school inspection(s) due`, sev: 'amber' });
  if ((data?.teacher_vacancies_total ?? 0) > 0) govAlerts.push({ icon: '🧑‍🏫', text: `${data!.teacher_vacancies_total} teacher vacancy(ies) in mandal`, sev: 'amber' });
  if ((data?.infrastructure_deficiencies ?? 0) > 0) govAlerts.push({ icon: '🏗️', text: `${data!.infrastructure_deficiencies} infrastructure issue(s) reported`, sev: 'amber' });

  const SEV = {
    red:   { bg: '#FEF2F2', border: '#FECACA', color: '#B91C1C' },
    amber: { bg: '#FFF7ED', border: '#FED7AA', color: '#C2410C' },
  };

  return (
    <Layout title="MEO Dashboard" subtitle={data?.mandal_name ?? '…'}>
      <style>{`
        .filter-btn{padding:5px 14px;border-radius:20px;border:none;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}
        .filter-btn.active{background:#1E40AF;color:#fff}
        .filter-btn:not(.active){background:#F3F4F6;color:#374151}
      `}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1E40AF 0%, #1E3A8A 100%)', borderRadius: 14, padding: '16px 18px', marginBottom: 14, color: '#fff' }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>MEO Mandal Governance Monitor</div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>{data?.mandal_name ?? '—'}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>{data?.district_name ?? '—'} · {today}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 14 }}>
          {[
            { v: schools.length, l: 'Schools' },
            { v: `${avgScore}%`, l: 'Avg Score' },
            { v: compliant, l: '✅ Compliant' },
            { v: critical, l: '🔴 Critical' },
          ].map(s => (
            <div key={s.l} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 4px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{s.v}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* GOVERNANCE ALERTS */}
      {govAlerts.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 8 }}>
            ⚡ Governance Actions Required
          </div>
          {govAlerts.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, border: '1px solid', background: SEV[a.sev].bg, borderColor: SEV[a.sev].border, marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: SEV[a.sev].color }}>{a.icon} {a.text}</span>
            </div>
          ))}
          <div style={{ marginBottom: 14 }} />
        </>
      )}

      {/* EXTRA KPI STRIP */}
      {data && (data.action_items_pending > 0 || data.teacher_vacancies_total > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
          {[
            { label: 'Action Items', value: data.action_items_pending, color: data.action_items_pending > 0 ? '#B91C1C' : '#15803D', bg: data.action_items_pending > 0 ? '#FEF2F2' : '#F0FDF4' },
            { label: 'Vacancies', value: data.teacher_vacancies_total, color: data.teacher_vacancies_total > 0 ? '#D97706' : '#15803D', bg: data.teacher_vacancies_total > 0 ? '#FFF7ED' : '#F0FDF4' },
            { label: 'Infra Issues', value: data.infrastructure_deficiencies, color: data.infrastructure_deficiencies > 0 ? '#D97706' : '#15803D', bg: data.infrastructure_deficiencies > 0 ? '#FFF7ED' : '#F0FDF4' },
          ].map(e => (
            <div key={e.label} style={{ background: e.bg, borderRadius: 11, padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: e.color }}>{e.value}</div>
              <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>{e.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* FILTER TABS */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {(['all','warning','critical'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`filter-btn${filter===f?' active':''}`}>
            {f === 'all' ? `All (${schools.length})` : f === 'warning' ? `⚠ <90% (${warning+critical})` : `🔴 Critical (${critical})`}
          </button>
        ))}
        <button onClick={() => void load()} style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 20, border: '1px solid #E5E7EB', background: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
          🔄
        </button>
      </div>

      {/* SCHOOL LIST */}
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading mandal data…</div>
      ) : error ? (
        <div style={{ padding: 20, background: '#FEF2F2', borderRadius: 12, color: '#B91C1C', fontSize: 13, fontWeight: 600 }}>⚠️ {error}</div>
      ) : filteredSchools.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏫</div>
          <div>No schools found. UDISE codes may not be configured.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredSchools.map((s, i) => {
            const sc = s.compliance_score ?? 0;
            const rowColor = sc < 75 ? '#FFF5F5' : sc < 90 ? '#FFFBEB' : '#fff';
            return (
              <div key={s.school_id} style={{ background: rowColor, border: `1px solid ${sc < 75 ? '#FECACA' : sc < 90 ? '#FDE68A' : '#E5E7EB'}`, borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{s.school_name}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
                      UDISE: {s.udise_code}
                      {s.teachers_late_today > 0 && <span style={{ color: '#D97706', marginLeft: 8 }}>⏰ {s.teachers_late_today} late</span>}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, background: '#F3F4F6', color: '#6B7280', padding: '2px 8px', borderRadius: 6, flexShrink: 0 }}>
                    #{i+1}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: '#6B7280' }}>
                    👩‍🎓 <b style={{ color: '#111827' }}>{s.present_today}/{s.total_students}</b> students
                  </div>
                  <div style={{ fontSize: 11, color: '#6B7280' }}>
                    🧑‍🏫 <b style={{ color: '#111827' }}>{s.teachers_checked_in}/{s.total_teachers}</b> teachers in
                  </div>
                </div>
                <ScoreBar score={sc} />
              </div>
            );
          })}
        </div>
      )}

      {/* EXPORT */}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <a href="/api/reports/meo/compliance-export?format=csv"
          style={{ flex: 1, height: 44, borderRadius: 10, background: '#1E40AF', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
          📥 Export Compliance CSV
        </a>
      </div>
    </Layout>
  );
}
