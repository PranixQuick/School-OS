'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';

interface Analytics {
  totals: {
    students: number; staff: number; reports_generated: number;
    evaluations_done: number; total_leads: number; high_priority_leads: number;
    broadcasts_sent: number; parents_reached: number;
    at_risk_students: number; critical_risk: number;
  };
  leads_by_status: Record<string, number>;
  recent_activity: { action: string; module: string; actor_email: string; created_at: string }[];
}

const MODULE_COLOR: Record<string, string> = {
  report_cards: '#15803D', teacher_eval: '#A16207', admissions: '#6D28D9',
  broadcasts: '#B91C1C', risk: '#B45309', settings: '#6B7280', import: '#1D4ED8', auth: '#374151', ptm: '#065F46',
};

const MODULE_ICON: Record<string, string> = {
  report_cards: '📄', teacher_eval: '🎙', admissions: '👥',
  broadcasts: '📢', risk: '⚠️', settings: '⚙️', import: '📥', auth: '🔐', ptm: '🗓',
};

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics/summary')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const t = data?.totals;

  const KPI_CARDS = [
    { label: 'Total Students', value: t?.students ?? 0, icon: '👨‍🎓', color: '#4F46E5', bg: '#EEF2FF' },
    { label: 'Reports Generated', value: t?.reports_generated ?? 0, icon: '📄', color: '#15803D', bg: '#DCFCE7' },
    { label: 'Teacher Evaluations', value: t?.evaluations_done ?? 0, icon: '🎙', color: '#A16207', bg: '#FEF9C3' },
    { label: 'Total Leads', value: t?.total_leads ?? 0, icon: '👥', color: '#6D28D9', bg: '#F5F3FF' },
    { label: 'High Priority Leads', value: t?.high_priority_leads ?? 0, icon: '🔥', color: '#B91C1C', bg: '#FEE2E2' },
    { label: 'Parents Reached', value: t?.parents_reached ?? 0, icon: '📱', color: '#065F46', bg: '#ECFDF5' },
    { label: 'Broadcasts Sent', value: t?.broadcasts_sent ?? 0, icon: '📢', color: '#1D4ED8', bg: '#DBEAFE' },
    { label: 'At-Risk Students', value: t?.at_risk_students ?? 0, icon: '⚠️', color: '#B45309', bg: '#FFFBEB' },
  ];

  const leadStatus = data?.leads_by_status ?? {};

  return (
    <Layout
      title="Analytics"
      subtitle="Platform-wide insights and activity"
      actions={<Link href="/dashboard" className="btn btn-ghost btn-sm">← Dashboard</Link>}
    >
      {loading ? (
        <div className="card"><div className="empty-state"><div className="empty-state-icon">📊</div><div className="empty-state-title">Loading analytics...</div></div></div>
      ) : (
        <>
          {/* KPI grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            {KPI_CARDS.map(k => (
              <div key={k.label} className="kpi-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.03em' }}>{k.label.toUpperCase()}</span>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{k.icon}</div>
                </div>
                <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Bottom row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Leads funnel */}
            <div className="card">
              <div className="section-header">
                <div className="section-title">Admissions Funnel</div>
                <Link href="/admissions/crm" style={{ fontSize: 12, color: '#4F46E5', textDecoration: 'none', fontWeight: 600 }}>View CRM →</Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { key: 'new', label: 'New', color: '#4F46E5', bg: '#EEF2FF' },
                  { key: 'contacted', label: 'Contacted', color: '#A16207', bg: '#FEF9C3' },
                  { key: 'visit_scheduled', label: 'Visit Scheduled', color: '#065F46', bg: '#ECFDF5' },
                  { key: 'admitted', label: 'Admitted', color: '#15803D', bg: '#DCFCE7' },
                  { key: 'lost', label: 'Lost', color: '#B91C1C', bg: '#FEE2E2' },
                ].map(stage => {
                  const count = leadStatus[stage.key] ?? 0;
                  const total = t?.total_leads ?? 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={stage.key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                        <span style={{ fontWeight: 500, color: '#374151' }}>{stage.label}</span>
                        <span style={{ fontWeight: 700, color: stage.color }}>{count}</span>
                      </div>
                      <div style={{ height: 8, borderRadius: 4, background: '#F3F4F6', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: stage.color, borderRadius: 4 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent activity */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 18px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="section-title">Recent Activity</div>
                <Link href="/activity" style={{ fontSize: 12, color: '#4F46E5', textDecoration: 'none', fontWeight: 600 }}>View all →</Link>
              </div>
              {(data?.recent_activity ?? []).length === 0 ? (
                <div className="empty-state" style={{ padding: 32 }}>
                  <div className="empty-state-icon">📋</div>
                  <div className="empty-state-title">No activity yet</div>
                </div>
              ) : (
                (data?.recent_activity ?? []).map((log, i) => (
                  <div key={i} style={{ padding: '10px 18px', borderBottom: i < (data?.recent_activity ?? []).length - 1 ? '1px solid #F9FAFB' : 'none', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, marginTop: 1 }}>
                      {MODULE_ICON[log.module] ?? '📋'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{log.action}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                        <span style={{ color: MODULE_COLOR[log.module] ?? '#6B7280', fontWeight: 600 }}>{log.module.replace('_', ' ')}</span>
                        {' · '}{new Date(log.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
