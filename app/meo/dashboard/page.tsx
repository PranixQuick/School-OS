'use client';
// app/meo/dashboard/page.tsx
// MEO (Mandal Education Officer) compliance dashboard.
// Read-only view — MEO sees all schools in their mandal.
// Sourced from v_meo_school_summary view via /api/meo/dashboard.
// RLS-scoped to MEO's mandal_code from meo_mandal_mapping.

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';

interface SchoolSummary {
  institution_id: string; school_id: string; school_name: string;
  udise_code: string; school_mode: string; mandal_code: string;
  present_today: number; total_students: number;
  teachers_checked_in: number; total_teachers: number;
  teachers_late_today: number; compliance_score: number;
}
interface MEOData {
  mandal_name: string; district_name: string;
  schools: SchoolSummary[];
  date: string;
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 90 ? '#15803D' : score >= 75 ? '#D97706' : '#B91C1C';
  const bg    = score >= 90 ? '#F0FDF4' : score >= 75 ? '#FFF7ED' : '#FEF2F2';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#E5E7EB', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(score, 100)}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.5s' }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color, background: bg, padding: '2px 8px', borderRadius: 6, minWidth: 44, textAlign: 'center' }}>
        {score}%
      </span>
    </div>
  );
}

export default function MEODashboardPage() {
  const [data, setData]     = useState<MEOData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/meo/dashboard');
      if (r.ok) { const d = await r.json() as MEOData; setData(d); }
      else { const d = await r.json() as { error?: string }; setError(d.error ?? 'Failed to load'); }
    } catch { setError('Network error'); }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const schools = data?.schools ?? [];
  const compliant   = schools.filter(s => s.compliance_score >= 90).length;
  const warning     = schools.filter(s => s.compliance_score >= 75 && s.compliance_score < 90).length;
  const critical    = schools.filter(s => s.compliance_score < 75).length;
  const avgScore    = schools.length > 0
    ? Math.round(schools.reduce((sum, s) => sum + (s.compliance_score ?? 0), 0) / schools.length)
    : 0;

  return (
    <Layout title="MEO Dashboard" subtitle={data?.mandal_name ?? 'Loading…'}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1E40AF 0%, #1E3A8A 100%)', borderRadius: 14, padding: '16px 18px', marginBottom: 16, color: '#fff' }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '.06em' }}>
          MEO Compliance Dashboard
        </div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>{data?.mandal_name ?? '—'}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
          {data?.district_name ?? '—'} | {today}
        </div>
      </div>

      {/* Summary tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Schools', value: schools.length, color: '#4F46E5', bg: '#EEF2FF' },
          { label: 'Avg Score', value: `${avgScore}%`, color: avgScore >= 90 ? '#15803D' : avgScore >= 75 ? '#D97706' : '#B91C1C', bg: avgScore >= 90 ? '#F0FDF4' : avgScore >= 75 ? '#FFF7ED' : '#FEF2F2' },
          { label: 'Compliant', value: compliant, color: '#15803D', bg: '#F0FDF4' },
          { label: 'Critical', value: critical, color: '#B91C1C', bg: '#FEF2F2' },
        ].map(t => (
          <div key={t.label} style={{ background: t.bg, borderRadius: 12, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: t.color }}>{t.value}</div>
            <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>{t.label}</div>
          </div>
        ))}
      </div>

      {/* School-by-school list */}
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading mandal data…</div>
      ) : error ? (
        <div style={{ padding: 20, background: '#FEF2F2', borderRadius: 12, color: '#B91C1C', fontSize: 13, fontWeight: 600 }}>
          ⚠️ {error}
        </div>
      ) : schools.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏫</div>
          <div>No schools found for this mandal. Check UDISE codes in school settings.</div>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden' }}>
          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px', gap: 8, padding: '10px 14px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>School</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textAlign: 'center' }}>Students</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textAlign: 'center' }}>Teachers</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textAlign: 'center' }}>Score</span>
          </div>
          {schools
            .sort((a, b) => (a.compliance_score ?? 0) - (b.compliance_score ?? 0)) // worst first
            .map((s, i) => {
              const scoreColor = (s.compliance_score ?? 0) >= 90 ? '#15803D' : (s.compliance_score ?? 0) >= 75 ? '#D97706' : '#B91C1C';
              const scoreBg    = (s.compliance_score ?? 0) >= 90 ? '#F0FDF4' : (s.compliance_score ?? 0) >= 75 ? '#FFF7ED' : '#FEF2F2';
              const rowBg      = (s.compliance_score ?? 0) < 75 ? '#FFF5F5' : i % 2 === 0 ? '#fff' : '#FAFAFA';
              return (
                <div key={s.school_id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px', gap: 8, padding: '12px 14px', borderBottom: '1px solid #F3F4F6', background: rowBg, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{s.school_name}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
                      UDISE: {s.udise_code}
                      {s.teachers_late_today > 0 && <span style={{ color: '#D97706', marginLeft: 8 }}>⏰ {s.teachers_late_today} late</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{s.present_today}/{s.total_students}</div>
                    <div style={{ fontSize: 10, color: '#9CA3AF' }}>present</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{s.teachers_checked_in}/{s.total_teachers}</div>
                    <div style={{ fontSize: 10, color: '#9CA3AF' }}>checked in</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: scoreColor, background: scoreBg, padding: '3px 8px', borderRadius: 8, display: 'inline-block' }}>
                      {s.compliance_score ?? 0}%
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Refresh + export */}
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button onClick={() => void load()} disabled={loading}
          style={{ flex: 1, height: 44, borderRadius: 10, border: 'none', background: '#4F46E5', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          🔄 {loading ? 'Refreshing…' : 'Refresh'}
        </button>
        <a href="/api/reports/meo/compliance-export?format=csv"
          style={{ flex: 1, height: 44, borderRadius: 10, background: '#F3F4F6', border: 'none', color: '#374151', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
          📥 Export CSV
        </a>
      </div>
    </Layout>
  );
}
