'use client';
// app/admin/ops/page.tsx
// Batch 12 — Admin Operations Console.
// Auto-refreshes every 30 seconds. Displays notification queue, cron jobs,
// payment stats, and quick actions. No SQL required for routine operations.

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';

interface NotifSummary {
  pending: number; dispatched_24h: number; awaiting_template: number;
  failed: number; skipped: number;
  recent_failures: { id: string; type: string; module: string | null; dispatch_error: string | null; created_at: string }[];
}
interface CronRow { job_name: string; last_status: string; last_run: string | null; last_duration_ms: number | null; last_error: string | null; }
interface PaymentStats { online_paid: number; pending_verification: number; overdue: number; refund_processing: number; }
interface AiBriefing { last_generated: string | null; last_status: string | null; last_error: string | null; }
interface OpsSummary { notifications: NotifSummary; cron: CronRow[]; payments: PaymentStats; ai_briefings: AiBriefing; }

type ActionState = 'idle' | 'loading' | 'done' | 'error';

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '10px 14px', background: '#fff', border: `1px solid ${color}30`, borderRadius: 10 }}>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 600, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, [string, string]> = {
    success: ['#D1FAE5','#065F46'],
    failed: ['#FEE2E2','#991B1B'],
    skipped: ['#F3F4F6','#6B7280'],
    running: ['#EFF6FF','#1D4ED8'],
  };
  const [bg, fg] = cfg[status] ?? ['#F3F4F6','#374151'];
  return <span style={{ background: bg, color: fg, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5 }}>{status}</span>;
}

function ActionBtn({ label, state, onClick }: { label: string; state: ActionState; onClick: () => void }) {
  const bg = state === 'loading' ? '#9CA3AF' : state === 'done' ? '#065F46' : state === 'error' ? '#991B1B' : '#4F46E5';
  const text = state === 'loading' ? '...' : state === 'done' ? '✓ Done' : state === 'error' ? '✗ Error' : label;
  return (
    <button onClick={onClick} disabled={state === 'loading'}
      style={{ padding: '6px 12px', background: bg, color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: state === 'loading' ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
      {text}
    </button>
  );
}

export default function OpsConsolePage() {
  const [data, setData] = useState<OpsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [dispatchResult, setDispatchResult] = useState<string | null>(null);
  const [requeueState, setRequeueState] = useState<ActionState>('idle');
  const [dispatchState, setDispatchState] = useState<ActionState>('idle');
  const [cancelIds, setCancelIds] = useState<Set<string>>(new Set());
  const [cronRetryState, setCronRetryState] = useState<Record<string, ActionState>>({});
  const [quickActionState, setQuickActionState] = useState<Record<string, ActionState>>({});

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ops/summary');
      const d = await res.json() as OpsSummary;
      if (res.ok) { setData(d); setLastRefresh(new Date()); }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadSummary();
    const iv = setInterval(() => void loadSummary(), 30_000);
    return () => clearInterval(iv);
  }, [loadSummary]);

  async function requeue(filter: string) {
    setRequeueState('loading');
    try {
      const res = await fetch('/api/admin/ops/notifications/requeue', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status_filter: filter }),
      });
      const d = await res.json() as { requeued?: number; error?: string };
      if (res.ok) { setRequeueState('done'); void loadSummary(); }
      else { setRequeueState('error'); }
    } catch { setRequeueState('error'); }
    setTimeout(() => setRequeueState('idle'), 3000);
  }

  async function triggerDispatch() {
    setDispatchState('loading'); setDispatchResult(null);
    try {
      const res = await fetch('/api/admin/ops/notifications/dispatch', { method: 'POST' });
      const d = await res.json() as { dispatched?: number; failed?: number; skipped?: number; awaiting_template?: number; mode?: string; error?: string };
      if (res.ok) {
        setDispatchState('done');
        setDispatchResult(`dispatched=${d.dispatched ?? 0} failed=${d.failed ?? 0} skipped=${d.skipped ?? 0} awaiting_template=${d.awaiting_template ?? 0}`);
        void loadSummary();
      } else { setDispatchState('error'); setDispatchResult(d.error ?? 'Failed'); }
    } catch { setDispatchState('error'); setDispatchResult('Network error'); }
    setTimeout(() => setDispatchState('idle'), 5000);
  }

  async function retryCron(jobName: string) {
    setCronRetryState(prev => ({ ...prev, [jobName]: 'loading' }));
    try {
      const res = await fetch('/api/admin/ops/cron/retry', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_name: jobName }),
      });
      setCronRetryState(prev => ({ ...prev, [jobName]: res.ok ? 'done' : 'error' }));
      if (res.ok) void loadSummary();
    } catch { setCronRetryState(prev => ({ ...prev, [jobName]: 'error' })); }
    setTimeout(() => setCronRetryState(prev => { const n = { ...prev }; delete n[jobName]; return n; }), 3000);
  }

  async function cancelNotification(id: string) {
    const res = await fetch('/api/admin/ops/notifications/cancel', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notification_ids: [id] }),
    });
    if (res.ok) { setCancelIds(prev => new Set([...prev, id])); void loadSummary(); }
  }

  async function quickAction(key: string, url: string) {
    setQuickActionState(prev => ({ ...prev, [key]: 'loading' }));
    try {
      const res = await fetch(url, { method: 'POST' });
      setQuickActionState(prev => ({ ...prev, [key]: res.ok ? 'done' : 'error' }));
      if (res.ok) void loadSummary();
    } catch { setQuickActionState(prev => ({ ...prev, [key]: 'error' })); }
    setTimeout(() => setQuickActionState(prev => { const n = { ...prev }; delete n[key]; return n; }), 4000);
  }

  const cardStyle = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, marginBottom: 20 };
  const sectionTitle = { fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 14 };

  if (loading) return <Layout title="Operations Console"><div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Loading...</div></Layout>;

  const notif = data?.notifications;
  const cron = data?.cron ?? [];
  const payments = data?.payments;
  const briefing = data?.ai_briefings;

  return (
    <Layout title="Operations Console" subtitle={`Auto-refresh 30s · Last: ${lastRefresh?.toLocaleTimeString('en-IN') ?? '—'}`}
      actions={<button onClick={() => void loadSummary()} style={{ padding: '5px 12px', background: '#F3F4F6', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>⟳ Refresh</button>}>

      {/* ── Section 1: Notification Queue ─────────────────────── */}
      <div style={cardStyle}>
        <div style={sectionTitle}>📬 Notification Queue</div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px,1fr))', gap: 8, marginBottom: 14 }}>
          <StatBox label="Pending" value={notif?.pending ?? 0} color="#4F46E5" />
          <StatBox label="Dispatched (24h)" value={notif?.dispatched_24h ?? 0} color="#065F46" />
          <StatBox label="Awaiting Template" value={notif?.awaiting_template ?? 0} color={(notif?.awaiting_template ?? 0) > 0 ? '#B45309' : '#9CA3AF'} />
          <StatBox label="Failed" value={notif?.failed ?? 0} color={(notif?.failed ?? 0) > 0 ? '#991B1B' : '#9CA3AF'} />
          <StatBox label="Skipped" value={notif?.skipped ?? 0} color="#6B7280" />
        </div>

        {/* Action row */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <ActionBtn label="🔄 Requeue Failed" state={requeueState} onClick={() => void requeue('failed')} />
          <ActionBtn label="🔄 Requeue All Stuck" state={requeueState} onClick={() => void requeue('all')} />
          <ActionBtn label="▶ Trigger Dispatch" state={dispatchState} onClick={() => void triggerDispatch()} />
        </div>
        {dispatchResult && (
          <div style={{ fontSize: 11, color: '#374151', background: '#F9FAFB', padding: '5px 10px', borderRadius: 6, marginBottom: 10 }}>
            Last dispatch: {dispatchResult}
          </div>
        )}

        {/* Awaiting template banner */}
        {(notif?.awaiting_template ?? 0) > 0 && (
          <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 11, color: '#92400E' }}>
            ⚠️ {notif!.awaiting_template} notifications waiting for Twilio template SIDs.
            Set <code>TWILIO_TEMPLATE_*</code> env vars in Supabase Edge Function secrets.
          </div>
        )}

        {/* Recent failures */}
        {(notif?.recent_failures?.length ?? 0) > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Recent Failures</div>
            <div style={{ border: '1px solid #FEE2E2', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: '#FEF2F2' }}>
                    {['Type','Module','Error','Created',''].map(h => (
                      <th key={h} style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, fontSize: 10, color: '#991B1B', borderBottom: '1px solid #FEE2E2' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {notif!.recent_failures.map(f => (
                    <tr key={f.id} style={{ borderBottom: '1px solid #FEF2F2', opacity: cancelIds.has(f.id) ? 0.4 : 1 }}>
                      <td style={{ padding: '5px 8px' }}>{f.type}</td>
                      <td style={{ padding: '5px 8px', color: '#6B7280' }}>{f.module ?? '—'}</td>
                      <td style={{ padding: '5px 8px', color: '#991B1B', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.dispatch_error ?? '—'}</td>
                      <td style={{ padding: '5px 8px', color: '#9CA3AF' }}>{new Date(f.created_at).toLocaleDateString('en-IN')}</td>
                      <td style={{ padding: '5px 8px' }}>
                        {!cancelIds.has(f.id) && (
                          <button onClick={() => void cancelNotification(f.id)}
                            style={{ padding: '2px 6px', background: '#FEE2E2', color: '#991B1B', border: 'none', borderRadius: 4, fontSize: 9, cursor: 'pointer' }}>
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 2: Cron Jobs ───────────────────────────────── */}
      <div style={cardStyle}>
        <div style={sectionTitle}>⏱ Cron Jobs</div>

        {/* Anthropic credits warning */}
        {cron.some(c => c.job_name === 'principal_briefing' && c.last_error?.includes('credit balance')) && (
          <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: '#92400E' }}>
            ⚠️ AI briefing is failing: Anthropic API credit balance exhausted.
            Add credits at <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" style={{ color: '#4F46E5', fontWeight: 700 }}>console.anthropic.com → Plans & Billing</a>
          </div>
        )}

        <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Job','Last Run','Duration','Status','Error',''].map(h => (
                  <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, fontSize: 10, color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cron.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '16px', textAlign: 'center', color: '#9CA3AF' }}>No cron runs found</td></tr>
              ) : cron.map(c => (
                <tr key={c.job_name} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '7px 10px', fontWeight: 600 }}>{c.job_name}</td>
                  <td style={{ padding: '7px 10px', color: '#6B7280' }}>
                    {c.last_run ? new Date(c.last_run).toLocaleString('en-IN', { hour12: false, dateStyle: 'short', timeStyle: 'short' }) : '—'}
                  </td>
                  <td style={{ padding: '7px 10px', color: '#6B7280' }}>{c.last_duration_ms ? `${c.last_duration_ms}ms` : '—'}</td>
                  <td style={{ padding: '7px 10px' }}><StatusBadge status={c.last_status} /></td>
                  <td style={{ padding: '7px 10px', color: '#991B1B', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.last_error ?? undefined}>
                    {c.last_error ? c.last_error.slice(0, 60) + (c.last_error.length > 60 ? '…' : '') : '—'}
                  </td>
                  <td style={{ padding: '7px 10px' }}>
                    <ActionBtn label="▶ Retry" state={cronRetryState[c.job_name] ?? 'idle'} onClick={() => void retryCron(c.job_name)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section 3: Payments ───────────────────────────────── */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={sectionTitle}>💳 Payments</div>
          <Link href="/automation/fees" style={{ fontSize: 11, color: '#4F46E5', fontWeight: 700 }}>→ View Fees</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px,1fr))', gap: 8 }}>
          <StatBox label="Online Paid" value={payments?.online_paid ?? 0} color="#065F46" />
          <StatBox label="Pending Verify" value={payments?.pending_verification ?? 0} color="#B45309" />
          <StatBox label="Overdue" value={payments?.overdue ?? 0} color={(payments?.overdue ?? 0) > 0 ? '#991B1B' : '#9CA3AF'} />
          <StatBox label="Refund Processing" value={payments?.refund_processing ?? 0} color="#4F46E5" />
        </div>
      </div>

      {/* ── Section 4: Quick Actions ──────────────────────────── */}
      <div style={cardStyle}>
        <div style={sectionTitle}>⚡ Quick Actions</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <ActionBtn
            label="🔄 Regenerate Today's Briefing"
            state={quickActionState['briefing'] ?? 'idle'}
            onClick={() => void quickAction('briefing', '/api/admin/principal-briefing/generate')}
          />
          <ActionBtn
            label="🚩 Run Risk Detection"
            state={quickActionState['risk'] ?? 'idle'}
            onClick={() => void quickAction('risk', '/api/admin/risk-flags/generate')}
          />
          <ActionBtn
            label="🏥 Run Health Check"
            state={quickActionState['health_check'] ?? 'idle'}
            onClick={() => void retryCron('school_health_monitor')}
          />
          <Link href="/admin/observability"
            style={{ padding: '6px 12px', background: '#F3F4F6', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 11, fontWeight: 700, color: '#374151', textDecoration: 'none' }}>
            📊 Observability →
          </Link>
        </div>

        {/* AI briefing status */}
        {briefing?.last_generated && (
          <div style={{ marginTop: 12, fontSize: 11, color: '#6B7280' }}>
            Last AI briefing: {new Date(briefing.last_generated).toLocaleString('en-IN')} ·{' '}
            <StatusBadge status={briefing.last_status ?? 'unknown'} />
          </div>
        )}
      </div>

    </Layout>
  );
}
