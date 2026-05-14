'use client';
// PATH: app/admin/observability/page.tsx
// Batch 4 — Observability dashboard.
// 4-card grid: Notifications | Payments | Cron Jobs | Errors
// Auto-refresh every 60s.

import { NLOpsBar } from '@/components/NLOpsBar';
import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface ObsData {
  checked_at: string;
  notifications: {
    pending: number; dispatched: number; failed: number;
    awaiting_template: number; skipped: number; stuck_pending: number;
    recent_failures: { id: string; type: string; title: string; dispatch_error: string | null; created_at: string }[];
  };
  payments: { online_paid: number; pending_verification: number; overdue: number };
  cron_jobs: { job_name: string; status: string; started_at: string; completed_at: string | null; duration_ms: number | null; error_message: string | null }[];
  errors: { last_24h_count: number; recent: { source: string; message: string; created_at: string }[] };
  health: { db_ok: boolean };
}

const CRON_BADGE: Record<string, { bg: string; fg: string }> = {
  succeeded: { bg: '#D1FAE5', fg: '#065F46' },
  failed:    { bg: '#FEE2E2', fg: '#991B1B' },
  running:   { bg: '#DBEAFE', fg: '#1E40AF' },
  skipped:   { bg: '#F3F4F6', fg: '#6B7280' },
};

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 64 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: color ?? '#111827' }}>{value}</div>
      <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 600, marginTop: 2, whiteSpace: 'nowrap' }}>{label}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, color: '#111827' }}>{title}</div>
      {children}
    </div>
  );
}

export default function ObservabilityPage() {
  const [data, setData] = useState<ObsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string>('');
  const [showFailures, setShowFailures] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await globalThis.fetch('/api/admin/observability');
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? `HTTP ${res.status}`); }
      else { setData(await res.json()); setError(null); }
    } catch (e) { setError(String(e)); }
    setLoading(false);
    setLastRefresh(new Date().toLocaleTimeString('en-IN'));
  }, []);

  useEffect(() => {
    void fetch();
    const t = setInterval(() => void fetch(), 60_000);
    return () => clearInterval(t);
  }, [fetch]);

  const n = data?.notifications;
  const p = data?.payments;
  const c = data?.cron_jobs ?? [];
  const e = data?.errors;

  return (
    <Layout title="Observability" subtitle="System health dashboard — auto-refreshes every 60s">

      <NLOpsBar />

      {/* Status bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {data && (
          <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6,
            background: data.health.db_ok ? '#D1FAE5' : '#FEE2E2',
            color: data.health.db_ok ? '#065F46' : '#991B1B', fontWeight: 700 }}>
            {data.health.db_ok ? '● DB healthy' : '● DB error'}
          </span>
        )}
        <span style={{ fontSize: 11, color: '#9CA3AF' }}>Last refreshed: {lastRefresh || '—'}</span>
        <button onClick={() => void fetch()} disabled={loading}
          style={{ padding: '4px 12px', background: '#4F46E5', color: '#fff', border: 'none',
            borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Refreshing…' : '↻ Refresh now'}
        </button>
        {error && <span style={{ fontSize: 11, color: '#B91C1C', fontWeight: 600 }}>Error: {error}</span>}
      </div>

      {/* 2×2 grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>

        {/* Card 1: Notifications */}
        <Card title="📬 Notifications">
          {n ? (
            <>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                <Stat label="Pending" value={n.pending} color={n.pending > 0 ? '#92400E' : '#111827'} />
                <Stat label="Dispatched" value={n.dispatched} />
                <Stat label="Failed" value={n.failed} color={n.failed > 0 ? '#B91C1C' : '#111827'} />
                <Stat label="Awaiting TPL" value={n.awaiting_template} color={n.awaiting_template > 0 ? '#92400E' : '#111827'} />
                <Stat label="Skipped" value={n.skipped} />
                <Stat label="Stuck >10m" value={n.stuck_pending} color={n.stuck_pending > 0 ? '#B91C1C' : '#111827'} />
              </div>
              {n.recent_failures.length > 0 && (
                <>
                  <button onClick={() => setShowFailures(s => !s)}
                    style={{ fontSize: 11, background: 'none', border: 'none', color: '#4F46E5', cursor: 'pointer', padding: 0, fontWeight: 700 }}>
                    {showFailures ? '▲ Hide' : '▼ Show'} {n.recent_failures.length} recent failure{n.recent_failures.length !== 1 ? 's' : ''}
                  </button>
                  {showFailures && (
                    <div style={{ marginTop: 8, borderTop: '1px solid #F3F4F6', paddingTop: 8 }}>
                      {n.recent_failures.map(f => (
                        <div key={f.id} style={{ marginBottom: 8, fontSize: 11 }}>
                          <div style={{ fontWeight: 600, color: '#374151' }}>{f.title}</div>
                          {f.dispatch_error && <div style={{ color: '#B91C1C', marginTop: 2 }}>{f.dispatch_error.slice(0, 120)}</div>}
                          <div style={{ color: '#9CA3AF', marginTop: 2 }}>{new Date(f.created_at).toLocaleString('en-IN')}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          ) : <div style={{ color: '#9CA3AF', fontSize: 12 }}>Loading…</div>}
        </Card>

        {/* Card 2: Payments */}
        <Card title="💳 Payments">
          {p ? (
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <Stat label="Online Paid" value={p.online_paid} color="#065F46" />
              <Stat label="Pending Verification" value={p.pending_verification}
                color={p.pending_verification > 0 ? '#92400E' : '#111827'} />
              <Stat label="Overdue" value={p.overdue}
                color={p.overdue > 0 ? '#B91C1C' : '#111827'} />
            </div>
          ) : <div style={{ color: '#9CA3AF', fontSize: 12 }}>Loading…</div>}
        </Card>

        {/* Card 3: Cron Jobs */}
        <Card title="⏱ Cron Jobs">
          {c.length === 0 ? (
            <div style={{ color: '#9CA3AF', fontSize: 12 }}>
              No cron history yet — runs will appear here after first execution.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: '#F9FAFB' }}>
                    {['Job', 'Status', 'Last Run', 'Duration'].map(h => (
                      <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#6B7280' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {c.slice(0, 10).map((r, i) => {
                    const badge = CRON_BADGE[r.status] ?? CRON_BADGE.skipped;
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 600, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.job_name}</td>
                        <td style={{ padding: '6px 8px' }}>
                          <span style={{ background: badge.bg, color: badge.fg, padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}>
                            {r.status}
                          </span>
                        </td>
                        <td style={{ padding: '6px 8px', color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                          {new Date(r.started_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '6px 8px', color: '#6B7280' }}>
                          {r.duration_ms != null ? `${r.duration_ms}ms` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Card 4: Errors */}
        <Card title="🚨 Errors">
          {e ? (
            <>
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: e.last_24h_count > 0 ? '#B91C1C' : '#065F46' }}>
                  {e.last_24h_count}
                </span>
                <span style={{ fontSize: 11, color: '#6B7280', marginLeft: 6 }}>in last 24h</span>
              </div>
              {e.recent.length === 0 ? (
                <div style={{ color: '#9CA3AF', fontSize: 12 }}>No errors logged.</div>
              ) : (
                <div>
                  {e.recent.map((r, i) => (
                    <div key={i} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: i < e.recent.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 10, background: '#F3F4F6', color: '#374151', padding: '1px 6px', borderRadius: 3, fontWeight: 700 }}>{r.source}</span>
                        <span style={{ fontSize: 10, color: '#9CA3AF' }}>{new Date(r.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.4 }}>{r.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : <div style={{ color: '#9CA3AF', fontSize: 12 }}>Loading…</div>}
        </Card>

      </div>
    </Layout>
  );
}
