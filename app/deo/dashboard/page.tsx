'use client';
// DEO (District Education Officer) Dashboard — "District Governance Console"
// Governance: DEO oversees ALL MEOs in the district. NEVER shows private schools.
// Read-only: DEO sees aggregated compliance, escalations, vacancies, risk scores.
// This is the highest level of government school oversight in EdProSys.

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';

interface MandalSummary {
  mandal_code: string;
  mandal_name: string;
  school_count: number;
  avg_compliance: number;
  critical_schools: number;
  teacher_vacancies: number;
  open_action_items: number;
  inspections_due: number;
  worst_school: string;
}

interface DistrictData {
  district_name: string;
  total_mandals: number;
  total_schools: number;
  avg_district_compliance: number;
  mandals: MandalSummary[];
  date: string;
}

function ComplianceBadge({ score }: { score: number }) {
  const color = score >= 90 ? '#15803D' : score >= 75 ? '#D97706' : '#B91C1C';
  const bg    = score >= 90 ? '#F0FDF4' : score >= 75 ? '#FFF7ED' : '#FEF2F2';
  return (
    <span style={{ fontSize: 13, fontWeight: 800, color, background: bg, padding: '3px 10px', borderRadius: 8, display: 'inline-block' }}>
      {score}%
    </span>
  );
}

export default function DEODashboardPage() {
  const [data, setData]     = useState<DistrictData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [sortBy, setSortBy] = useState<'compliance' | 'vacancies' | 'actions'>('compliance');
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/deo/dashboard');
      if (r.ok) { const d = await r.json() as DistrictData; setData(d); setError(''); }
      else { const d = await r.json() as { error?: string }; setError(d.error ?? 'Unavailable'); }
    } catch { setError('Network error'); }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const mandals = (data?.mandals ?? []).slice().sort((a, b) => {
    if (sortBy === 'compliance') return a.avg_compliance - b.avg_compliance;
    if (sortBy === 'vacancies')  return b.teacher_vacancies - a.teacher_vacancies;
    return b.open_action_items - a.open_action_items;
  });

  const totalCritical   = mandals.reduce((s, m) => s + m.critical_schools, 0);
  const totalVacancies  = mandals.reduce((s, m) => s + m.teacher_vacancies, 0);
  const totalActions    = mandals.reduce((s, m) => s + m.open_action_items, 0);
  const avgDistrict     = data?.avg_district_compliance ?? 0;

  return (
    <Layout title="DEO Dashboard" subtitle={data?.district_name ?? 'District Overview'}>
      <style>{`
        .filter-btn{padding:5px 12px;border-radius:20px;border:none;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}
        .filter-btn.active{background:#1E3A8A;color:#fff}
        .filter-btn:not(.active){background:#F3F4F6;color:#374151}
      `}</style>

      {/* Header banner */}
      <div style={{ background: 'linear-gradient(135deg, #1E3A8A 0%, #1E40AF 100%)', borderRadius: 14, padding: '16px 18px', marginBottom: 14, color: '#fff' }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 3 }}>
          DEO District Governance Console
        </div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>{data?.district_name ?? '—'}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>{today}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 14 }}>
          {[
            { v: data?.total_mandals ?? '—', l: 'Mandals' },
            { v: data?.total_schools ?? '—', l: 'Schools' },
            { v: `${avgDistrict}%`, l: 'Dist. Avg' },
            { v: totalCritical, l: '🔴 Critical' },
          ].map(s => (
            <div key={s.l} style={{ background: 'rgba(255,255,255,0.14)', borderRadius: 8, padding: '8px 4px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{s.v}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* District KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Critical Schools', value: totalCritical, color: totalCritical > 0 ? '#B91C1C' : '#15803D', bg: totalCritical > 0 ? '#FEF2F2' : '#F0FDF4' },
          { label: 'Teacher Vacancies', value: totalVacancies, color: totalVacancies > 0 ? '#D97706' : '#15803D', bg: totalVacancies > 0 ? '#FFF7ED' : '#F0FDF4' },
          { label: 'Open Actions', value: totalActions, color: totalActions > 0 ? '#7C3AED' : '#15803D', bg: totalActions > 0 ? '#F5F3FF' : '#F0FDF4' },
        ].map(k => (
          <div key={k.label} style={{ background: k.bg, borderRadius: 11, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Sort controls */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF' }}>SORT BY:</span>
        {(['compliance','vacancies','actions'] as const).map(s => (
          <button key={s} onClick={() => setSortBy(s)} className={`filter-btn${sortBy===s?' active':''}`}>
            {s === 'compliance' ? '📊 Compliance' : s === 'vacancies' ? '🧑‍🏫 Vacancies' : '📋 Actions'}
          </button>
        ))}
      </div>

      {/* Mandal heatmap list */}
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading district data…</div>
      ) : error ? (
        <div style={{ padding: 20, background: '#F9FAFB', borderRadius: 12, color: '#6B7280', fontSize: 13 }}>
          <p style={{ fontWeight: 700 }}>DEO Dashboard</p>
          <p>District aggregation is available once MEO mandal mappings are populated. Each MEO must be provisioned in the system.</p>
          <Link href="/meo/dashboard" style={{ color: '#1E40AF', fontWeight: 700, textDecoration: 'none' }}>→ View MEO Dashboard</Link>
        </div>
      ) : mandals.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', background: '#F9FAFB', borderRadius: 12 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🏛️</div>
          <div style={{ fontWeight: 700, color: '#374151', marginBottom: 4 }}>No mandal data yet</div>
          <div style={{ fontSize: 12 }}>Provision MEO users and mandal mappings to enable district aggregation.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {mandals.map((m, i) => {
            const riskColor = m.avg_compliance < 75 ? '#B91C1C' : m.avg_compliance < 90 ? '#D97706' : '#15803D';
            const rowBg = m.avg_compliance < 75 ? '#FFF5F5' : m.avg_compliance < 90 ? '#FFFBEB' : '#fff';
            return (
              <div key={m.mandal_code} style={{ background: rowBg, border: `1px solid ${m.avg_compliance < 75 ? '#FECACA' : m.avg_compliance < 90 ? '#FDE68A' : '#E5E7EB'}`, borderRadius: 13, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                      {i < 3 && m.avg_compliance < 75 && <span style={{ fontSize: 11, marginRight: 4 }}>🔴</span>}
                      {m.mandal_name}
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
                      {m.school_count} schools · Worst: {m.worst_school || 'N/A'}
                    </div>
                  </div>
                  <ComplianceBadge score={m.avg_compliance} />
                </div>
                {/* Compliance bar */}
                <div style={{ height: 6, borderRadius: 3, background: '#E5E7EB', overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ width: `${Math.min(m.avg_compliance, 100)}%`, height: '100%', background: riskColor, borderRadius: 3 }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                  {[
                    { icon: '🔴', v: m.critical_schools, l: 'Critical' },
                    { icon: '🧑‍🏫', v: m.teacher_vacancies, l: 'Vacancies' },
                    { icon: '📋', v: m.open_action_items, l: 'Actions' },
                  ].map(s => (
                    <div key={s.l} style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: s.v > 0 ? '#B91C1C' : '#15803D' }}>{s.v}</div>
                      <div style={{ fontSize: 10, color: '#9CA3AF' }}>{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Export */}
      <div style={{ marginTop: 14 }}>
        <a href="/api/deo/compliance-export?format=csv" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 10, background: '#1E3A8A', color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
          📥 Export District Report CSV
        </a>
      </div>
    </Layout>
  );
}
