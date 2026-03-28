'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { DEMO_RISK_FLAGS } from '@/lib/demoData';
import Link from 'next/link';

interface RiskFlag {
  id: string; student_id: string; risk_level: string; risk_factors: string[];
  ai_summary: string; attendance_pct: number; avg_score: number; fee_overdue: boolean;
  flagged_at: string; students: { name: string; class: string; section: string } | null;
}

const RISK_BADGE: Record<string, string> = { low: 'badge-gray', medium: 'badge-medium', high: 'badge-low', critical: 'badge-low' };
const RISK_COLOR: Record<string, string> = { low: '#6B7280', medium: '#A16207', high: '#B91C1C', critical: '#7F1D1D' };
const RISK_BG: Record<string, string> = { low: '#F9FAFB', medium: '#FFFBEB', high: '#FEF2F2', critical: '#FFF1F2' };

export default function RiskPage() {
  const [flags, setFlags] = useState<RiskFlag[]>([]);
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [scanResult, setScanResult] = useState<{ total_scanned: number; at_risk: number; breakdown: Record<string, number> } | null>(null);

  useEffect(() => { fetchFlags(); }, []);

  async function fetchFlags() {
    try {
      const res = await fetch('/api/risk/detect');
      if (!res.ok) throw new Error('fetch failed');
      const d = await res.json() as { flags?: RiskFlag[]; error?: string };
      if (d.error) throw new Error(d.error);
      setFlags(d.flags?.length ? d.flags : DEMO_RISK_FLAGS as RiskFlag[]);
    } catch {
      setFlags(DEMO_RISK_FLAGS as RiskFlag[]);
    }
  }

  async function runScan() {
    setScanning(true);
    try {
      const res = await fetch('/api/risk/detect', { method: 'POST' });
      const d = await res.json() as { total_scanned: number; at_risk: number; breakdown: Record<string, number> };
      setScanResult(d);
      fetchFlags();
    } finally { setScanning(false); }
  }

  const filtered = filter === 'all' ? flags : flags.filter(f => f.risk_level === filter);
  const counts = { critical: flags.filter(f => f.risk_level === 'critical').length, high: flags.filter(f => f.risk_level === 'high').length, medium: flags.filter(f => f.risk_level === 'medium').length };

  return (
    <Layout title="At-Risk Students" subtitle="AI-powered early warning system"
      actions={<div style={{ display: 'flex', gap: 8 }}><Link href="/automation" className="btn btn-ghost btn-sm">← Automation</Link><button onClick={runScan} disabled={scanning} className="btn btn-primary btn-sm">{scanning ? 'Scanning...' : '⚡ Run AI Scan'}</button></div>}
    >
      {scanResult && (
        <div className="alert alert-info" style={{ marginBottom: 16 }}>
          Scanned <strong>{scanResult.total_scanned}</strong> students — found <strong>{scanResult.at_risk}</strong> at risk: {scanResult.breakdown.critical ?? 0} critical, {scanResult.breakdown.high ?? 0} high, {scanResult.breakdown.medium ?? 0} medium.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
        {([['critical','🔴 Critical', '#FFF1F2', '#B91C1C'], ['high','🟠 High', '#FEF2F2', '#DC2626'], ['medium','🟡 Medium', '#FFFBEB', '#A16207']] as const).map(([level, label, bg, color]) => (
          <button key={level} onClick={() => setFilter(filter === level ? 'all' : level)}
            style={{ padding: '16px 18px', textAlign: 'left', borderRadius: 14, background: filter === level ? bg : '#fff', border: `1px solid ${filter === level ? color : '#E5E7EB'}`, cursor: 'pointer', fontFamily: 'inherit' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color, marginBottom: 4 }}>{counts[level]}</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>{label}</div>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.length === 0 && (
          <div className="card"><div className="empty-state"><div className="empty-state-icon">✅</div><div className="empty-state-title">{flags.length === 0 ? 'No scan run yet' : 'No students in this category'}</div><div className="empty-state-sub">{flags.length === 0 ? 'Click "Run AI Scan" to detect at-risk students.' : 'All clear for this risk level.'}</div></div></div>
        )}
        {filtered.map(flag => (
          <div key={flag.id} style={{ background: RISK_BG[flag.risk_level] ?? '#fff', border: `1px solid ${RISK_COLOR[flag.risk_level]}30`, borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: RISK_COLOR[flag.risk_level] + '20', border: `2px solid ${RISK_COLOR[flag.risk_level]}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: RISK_COLOR[flag.risk_level] }}>
                  {flag.risk_level === 'critical' ? '!!' : flag.risk_level === 'high' ? '!' : '~'}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{flag.students?.name ?? 'Unknown'}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>Class {flag.students?.class}-{flag.students?.section}</div>
                </div>
              </div>
              <span className={`badge ${RISK_BADGE[flag.risk_level]}`} style={{ fontSize: 11, fontWeight: 800 }}>{flag.risk_level.toUpperCase()} RISK</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
              {[{ label: 'Attendance', value: `${flag.attendance_pct}%`, warn: flag.attendance_pct < 75 }, { label: 'Avg Score', value: `${flag.avg_score}%`, warn: flag.avg_score < 50 }, { label: 'Fee Status', value: flag.fee_overdue ? 'Overdue' : 'Clear', warn: flag.fee_overdue }].map(m => (
                <div key={m.label} style={{ background: m.warn ? RISK_COLOR[flag.risk_level] + '10' : '#F9FAFB', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', marginBottom: 3 }}>{m.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: m.warn ? RISK_COLOR[flag.risk_level] : '#111827' }}>{m.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: flag.ai_summary ? 10 : 0 }}>
              {flag.risk_factors.map(f => <span key={f} className="badge badge-low" style={{ fontSize: 11 }}>{f}</span>)}
            </div>

            {flag.ai_summary && (
              <div style={{ background: '#EEF2FF', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#3730A3', borderLeft: '3px solid #4F46E5' }}>
                <span style={{ fontWeight: 700 }}>AI Recommendation: </span>{flag.ai_summary}
              </div>
            )}
          </div>
        ))}
      </div>
    </Layout>
  );
}
