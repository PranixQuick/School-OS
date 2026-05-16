'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Summary {
  total_schools: number; active_schools: number; total_users: number;
  total_reports_generated: number; total_broadcasts_sent: number; total_evaluations: number;
  plan_breakdown: { free: number; pro: number; enterprise: number };
}

interface School {
  id: string; name: string; plan: string; is_active: boolean;
  created_at: string; usage: { reports_generated: number; broadcasts_sent: number } | null;
}

interface UpgradeRequest {
  id: string; school_name: string; current_plan: string; requested_plan: string; status: string; created_at: string;
}

const PLAN_STYLE: Record<string, { bg: string; color: string }> = {
  free:       { bg: '#F3F4F6', color: '#6B7280' },
  starter:    { bg: '#F3F4F6', color: '#6B7280' },
  pro:        { bg: '#EEF2FF', color: '#4F46E5' },
  growth:     { bg: '#EEF2FF', color: '#4F46E5' },
  enterprise: { bg: '#ECFDF5', color: '#065F46' },
  campus:     { bg: '#ECFDF5', color: '#065F46' },
};

export default function AdminPanel() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [upgrades, setUpgrades] = useState<UpgradeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'schools' | 'upgrades'>('overview');

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then((d: { error?: string; summary: Summary; schools: School[]; recent_upgrades: UpgradeRequest[] }) => {
        if (d.error) { setError(d.error); return; }
        setSummary(d.summary);
        setSchools(d.schools);
        setUpgrades(d.recent_upgrades);
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const s = summary;

  return (
    <div style={{ minHeight: '100vh', background: '#0F172A', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* Admin nav */}
      <div style={{ background: '#1E293B', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff' }}>P</div>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>EdProSys Admin</span>
          <span style={{ fontSize: 11, fontWeight: 700, background: '#B91C1C', color: '#fff', padding: '2px 8px', borderRadius: 10 }}>INTERNAL</span>
        </div>
        <Link href="/dashboard" style={{ fontSize: 13, color: '#94A3B8', textDecoration: 'none', fontWeight: 600 }}>← Back to App</Link>
      </div>

      <div style={{ padding: 24 }}>

        {loading && (
          <div style={{ textAlign: 'center', padding: 80, color: '#94A3B8', fontSize: 15 }}>Loading admin data...</div>
        )}

        {error && (
          <div style={{ background: '#7F1D1D', border: '1px solid #991B1B', borderRadius: 12, padding: '16px 20px', color: '#FCA5A5', marginBottom: 20 }}>
            Access denied or error: {error}
          </div>
        )}

        {!loading && !error && s && (
          <>
            {/* KPI grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
              {[
                { label: 'Total Schools', value: s.total_schools, icon: '🏫', color: '#60A5FA' },
                { label: 'Active Schools', value: s.active_schools, icon: '✅', color: '#34D399' },
                { label: 'Total Users', value: s.total_users, icon: '👤', color: '#A78BFA' },
                { label: 'Reports Generated', value: s.total_reports_generated, icon: '📄', color: '#FBBF24' },
                { label: 'Broadcasts Sent', value: s.total_broadcasts_sent, icon: '📢', color: '#F87171' },
                { label: 'Evaluations Done', value: s.total_evaluations, icon: '🎙', color: '#FB923C' },
                { label: 'Free Plan', value: s.plan_breakdown.free, icon: '🆓', color: '#94A3B8' },
                { label: 'Pro Plan', value: s.plan_breakdown.pro, icon: '⭐', color: '#818CF8' },
              ].map(k => (
                <div key={k.label} style={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '16px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: '0.05em' }}>{k.label.toUpperCase()}</div>
                    <span style={{ fontSize: 18 }}>{k.icon}</span>
                  </div>
                  <div style={{ fontSize: 30, fontWeight: 900, color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              {(['overview', 'schools', 'upgrades'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '10px 18px', border: 'none', background: 'none', fontSize: 13, fontWeight: 600, color: activeTab === tab ? '#60A5FA' : '#64748B', borderBottom: activeTab === tab ? '2px solid #60A5FA' : '2px solid transparent', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize' }}>
                  {tab}
                </button>
              ))}
            </div>

            {/* Schools table */}
            {(activeTab === 'schools' || activeTab === 'overview') && (
              <div style={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 14, fontWeight: 700, color: '#E2E8F0' }}>
                  All Schools ({schools.length})
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                        {['School', 'Plan', 'Reports', 'Broadcasts', 'Created', 'Status'].map(h => (
                          <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: '0.06em', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{h.toUpperCase()}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {schools.map((school, i) => {
                        const ps = PLAN_STYLE[school.plan] ?? PLAN_STYLE.free;
                        return (
                          <tr key={school.id} style={{ borderBottom: i < schools.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ fontWeight: 600, fontSize: 14, color: '#E2E8F0' }}>{school.name}</div>
                              <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{school.id.slice(0, 8)}...</div>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 10, background: ps.bg + '20', color: ps.color, textTransform: 'capitalize' }}>{school.plan}</span>
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: 13, color: '#94A3B8' }}>{school.usage?.reports_generated ?? 0}</td>
                            <td style={{ padding: '12px 16px', fontSize: 13, color: '#94A3B8' }}>{school.usage?.broadcasts_sent ?? 0}</td>
                            <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748B' }}>
                              {new Date(school.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 10, background: school.is_active ? '#065F46' : '#7F1D1D', color: school.is_active ? '#6EE7B7' : '#FCA5A5' }}>
                                {school.is_active ? 'ACTIVE' : 'INACTIVE'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Upgrade requests */}
            {(activeTab === 'upgrades' || activeTab === 'overview') && upgrades.length > 0 && (
              <div style={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 14, fontWeight: 700, color: '#E2E8F0' }}>
                  Upgrade Requests ({upgrades.length})
                </div>
                {upgrades.map((req, i) => (
                  <div key={req.id} style={{ padding: '14px 20px', borderBottom: i < upgrades.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#E2E8F0', marginBottom: 3 }}>{req.school_name}</div>
                      <div style={{ fontSize: 12, color: '#64748B' }}>
                        {req.current_plan} → <strong style={{ color: '#60A5FA' }}>{req.requested_plan}</strong>
                        {' · '}{new Date(req.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 10, background: req.status === 'pending' ? '#78350F' : '#065F46', color: req.status === 'pending' ? '#FCD34D' : '#6EE7B7' }}>
                      {req.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}

          </>
        )}
      </div>
    </div>
  );
}
