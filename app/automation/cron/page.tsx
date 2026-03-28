'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';

interface CronRun {
  id: string;
  job_name: string;
  status: 'running' | 'success' | 'failed' | 'skipped';
  triggered_by: string;
  result: Record<string, unknown>;
  error: string | null;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
}

interface RunSummary { total: number; success: number; failed: number; skipped: number; }

interface DispatchStats {
  stats: { total: number; pending: number; dispatched: number; failed: number; skipped: number };
  pending_count: number;
  recent_log: { id: string; channel: string; recipient: string; status: string; provider: string; error: string | null; attempted_at: string }[];
}

const JOB_LABELS: Record<string, { label: string; icon: string }> = {
  fee_reminders:      { label: 'Fee Reminders',       icon: '💳' },
  risk_detection:     { label: 'Risk Detection',       icon: '⚠️' },
  principal_briefing: { label: 'Principal Briefing',   icon: '📋' },
  dispatch:           { label: 'Dispatch',             icon: '📤' },
};

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  success: { bg: '#DCFCE7', color: '#15803D', label: 'SUCCESS' },
  failed:  { bg: '#FEE2E2', color: '#B91C1C', label: 'FAILED' },
  skipped: { bg: '#F3F4F6', color: '#6B7280', label: 'SKIPPED' },
  running: { bg: '#DBEAFE', color: '#1D4ED8', label: 'RUNNING' },
};

const DISPATCH_STATUS: Record<string, { bg: string; color: string }> = {
  sent:    { bg: '#DCFCE7', color: '#15803D' },
  failed:  { bg: '#FEE2E2', color: '#B91C1C' },
  skipped: { bg: '#F3F4F6', color: '#6B7280' },
};

const JOBS = [
  { key: 'all',                label: 'Run All Jobs',          icon: '⚡', desc: 'Fee reminders + Risk + Briefing + Dispatch' },
  { key: 'fee_reminders',      label: 'Fee Reminders',         icon: '💳', desc: 'Generate & dispatch fee reminder messages' },
  { key: 'risk_detection',     label: 'Risk Scan',             icon: '⚠️', desc: 'Scan students and alert admins if critical' },
  { key: 'principal_briefing', label: 'Principal Briefing',    icon: '📋', desc: 'Generate briefing and email to principal' },
  { key: 'dispatch',           label: 'Dispatch Only',         icon: '📤', desc: 'Send all pending notifications now' },
];

export default function CronPage() {
  const [runs, setRuns] = useState<CronRun[]>([]);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [dispatch, setDispatch] = useState<DispatchStats | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [lastResult, setLastResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'jobs' | 'dispatch'>('jobs');

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    await Promise.all([fetchHistory(), fetchDispatch()]);
    setLoading(false);
  }

  async function fetchHistory() {
    const res = await fetch('/api/cron/run');
    const d = await res.json() as { runs: CronRun[]; summary: RunSummary };
    setRuns(d.runs ?? []);
    setSummary(d.summary ?? null);
  }

  async function fetchDispatch() {
    const res = await fetch('/api/dispatch');
    const d = await res.json() as DispatchStats;
    setDispatch(d);
  }

  async function triggerJob(job: string) {
    setRunning(job); setLastResult(null);
    try {
      const res = await fetch('/api/cron/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job }),
      });
      const d = await res.json() as Record<string, unknown>;
      setLastResult(d);
      fetchAll();
    } finally { setRunning(null); }
  }

  async function triggerDispatch() {
    setDispatching(true);
    try {
      await fetch('/api/dispatch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ limit: 50 }) });
      fetchDispatch();
    } finally { setDispatching(false); }
  }

  function formatDuration(ms: number | null) {
    if (!ms) return '—';
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  }

  function formatResult(result: Record<string, unknown>): string {
    if (!result) return '';
    const parts: string[] = [];
    if (typeof result.reminders_sent === 'number') parts.push(`${result.reminders_sent} reminders`);
    if (typeof result.flagged === 'number') parts.push(`${result.flagged} flagged`);
    if (result.briefing_id) parts.push('Briefing ✓');
    if (result.reason) parts.push(String(result.reason));
    if (result.skipped) parts.push('Skipped');
    if (result.processed !== undefined) parts.push(`${result.processed} dispatched`);
    return parts.join(' · ') || '—';
  }

  const ds = dispatch?.stats;

  return (
    <Layout
      title="Cron Jobs & Dispatch"
      subtitle="Autonomous AI automation and communication layer"
      actions={<Link href="/automation" className="btn btn-ghost btn-sm">← Automation</Link>}
    >
      {/* KPI row */}
      {summary && ds && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 24 }}>
          {[
            { label: 'Jobs Run', value: summary.total, color: '#4F46E5', bg: '#EEF2FF' },
            { label: 'Succeeded', value: summary.success, color: '#15803D', bg: '#DCFCE7' },
            { label: 'Failed', value: summary.failed, color: '#B91C1C', bg: '#FEE2E2' },
            { label: 'Notifications', value: ds.total, color: '#374151', bg: '#F9FAFB' },
            { label: 'Dispatched', value: ds.dispatched, color: '#15803D', bg: '#DCFCE7' },
            { label: 'Pending', value: ds.pending, color: '#A16207', bg: '#FEF9C3' },
          ].map(k => (
            <div key={k.label} style={{ background: k.bg, borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: '0.04em', marginBottom: 5 }}>{k.label.toUpperCase()}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="tabs">
        <button onClick={() => setActiveTab('jobs')} className={`tab-btn${activeTab === 'jobs' ? ' active' : ''}`}>Cron Jobs</button>
        <button onClick={() => setActiveTab('dispatch')} className={`tab-btn${activeTab === 'dispatch' ? ' active' : ''}`}>
          Dispatch Log {dispatch?.pending_count ? `(${dispatch.pending_count} pending)` : ''}
        </button>
      </div>

      {activeTab === 'jobs' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* Trigger panel */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 14 }}>Manual Triggers</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {JOBS.map(job => (
                <div key={job.key} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 22 }}>{job.icon}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{job.label}</div>
                      <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{job.desc}</div>
                    </div>
                  </div>
                  <button onClick={() => triggerJob(job.key)} disabled={running !== null} className="btn btn-primary btn-sm" style={{ minWidth: 70, opacity: running !== null ? 0.6 : 1 }}>
                    {running === job.key ? (
                      <><span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'os_spin 0.7s linear infinite' }} /> Running</>
                    ) : 'Run'}
                  </button>
                </div>
              ))}
            </div>

            {lastResult && (
              <div className="alert alert-info" style={{ marginTop: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                  ✓ {(lastResult.jobs_run as number ?? 1)} job(s) — {(lastResult.succeeded as number ?? 0)} succeeded
                </div>
                {Array.isArray(lastResult.results) && (lastResult.results as Array<{ job: string; success: boolean; data?: Record<string, unknown>; error?: string; durationMs: number }>).map((r, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#374151', marginBottom: 2 }}>
                    {r.success ? '✓' : '✗'} {JOB_LABELS[r.job]?.label ?? r.job}: {formatResult(r.data ?? {})} ({formatDuration(r.durationMs)})
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 14, padding: '12px 14px', background: '#F9FAFB', borderRadius: 10, fontSize: 12, color: '#6B7280', border: '1px solid #F3F4F6' }}>
              <strong style={{ color: '#374151' }}>Auto-schedule:</strong> Daily at 2:00 AM UTC.<br />
              WhatsApp + Email dispatch runs after each job automatically.
            </div>
          </div>

          {/* Run history */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>Run History</div>
              <button onClick={fetchHistory} className="btn btn-ghost btn-sm">↻</button>
            </div>

            {loading ? (
              <div className="card"><div className="empty-state"><div className="empty-state-icon">⏱</div><div className="empty-state-title">Loading...</div></div></div>
            ) : runs.length === 0 ? (
              <div className="card"><div className="empty-state"><div className="empty-state-icon">🤖</div><div className="empty-state-title">No runs yet</div><div className="empty-state-sub">Trigger a job above.</div></div></div>
            ) : (
              <div className="card" style={{ padding: 0, overflow: 'hidden', maxHeight: 500, overflowY: 'auto' }}>
                {runs.map((run, i) => {
                  const jobMeta = JOB_LABELS[run.job_name] ?? { label: run.job_name, icon: '🔧' };
                  const statusStyle = STATUS_BADGE[run.status] ?? STATUS_BADGE.skipped;
                  return (
                    <div key={run.id} style={{ padding: '11px 16px', borderBottom: i < runs.length - 1 ? '1px solid #F9FAFB' : 'none', display: 'flex', gap: 10 }}>
                      <span style={{ fontSize: 18, marginTop: 1, flexShrink: 0 }}>{jobMeta.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{jobMeta.label}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: statusStyle.bg, color: statusStyle.color }}>{statusStyle.label}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                          {new Date(run.started_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          {' · '}{run.triggered_by}{run.duration_ms ? ` · ${formatDuration(run.duration_ms)}` : ''}
                        </div>
                        {run.status === 'success' && run.result && Object.keys(run.result).length > 0 && (
                          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{formatResult(run.result)}</div>
                        )}
                        {run.status === 'failed' && run.error && (
                          <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 2 }}>{run.error.slice(0, 100)}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'dispatch' && (
        <div>
          {/* Dispatch controls */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 4 }}>Notification Dispatch</div>
              <div style={{ fontSize: 13, color: '#6B7280' }}>
                Channel: <strong>WhatsApp (stub)</strong> + <strong>Email (stub)</strong> · Provider: <code style={{ background: '#F3F4F6', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>stub</code>
              </div>
            </div>
            <button onClick={triggerDispatch} disabled={dispatching} className="btn btn-primary">
              {dispatching ? '📤 Dispatching...' : '📤 Dispatch Pending'}
            </button>
            <button onClick={fetchDispatch} className="btn btn-ghost btn-sm">↻</button>
          </div>

          {/* Status cards */}
          {ds && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
              {[
                { l: 'Total', v: ds.total, c: '#374151', bg: '#F9FAFB' },
                { l: 'Pending', v: ds.pending, c: '#A16207', bg: '#FEF9C3' },
                { l: 'Dispatched', v: ds.dispatched, c: '#15803D', bg: '#DCFCE7' },
                { l: 'Failed', v: ds.failed, c: '#B91C1C', bg: '#FEE2E2' },
                { l: 'Skipped', v: ds.skipped, c: '#6B7280', bg: '#F3F4F6' },
              ].map(k => (
                <div key={k.l} style={{ background: k.bg, borderRadius: 10, padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: k.c }}>{k.v}</div>
                  <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>{k.l}</div>
                </div>
              ))}
            </div>
          )}

          {/* Dispatch log table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #F3F4F6', fontWeight: 700, fontSize: 14 }}>
              Recent Dispatch Log
            </div>
            {!dispatch?.recent_log?.length ? (
              <div className="empty-state" style={{ padding: 40 }}>
                <div className="empty-state-icon">📤</div>
                <div className="empty-state-title">No dispatch activity yet</div>
                <div className="empty-state-sub">Dispatch pending notifications to see logs here.</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr><th>Channel</th><th>Recipient</th><th>Status</th><th>Provider</th><th>Time</th><th>Error</th></tr>
                  </thead>
                  <tbody>
                    {dispatch.recent_log.map(log => {
                      const st = DISPATCH_STATUS[log.status] ?? DISPATCH_STATUS.skipped;
                      return (
                        <tr key={log.id}>
                          <td>
                            <span style={{ fontSize: 16 }}>{log.channel === 'whatsapp' ? '📱' : '✉️'}</span>
                            <span style={{ fontSize: 12, color: '#6B7280', marginLeft: 4 }}>{log.channel}</span>
                          </td>
                          <td style={{ fontSize: 13, color: '#374151', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.recipient}</td>
                          <td><span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 10, background: st.bg, color: st.color }}>{log.status.toUpperCase()}</span></td>
                          <td><code style={{ fontSize: 11, background: '#F3F4F6', padding: '2px 6px', borderRadius: 4 }}>{log.provider}</code></td>
                          <td style={{ fontSize: 11, color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                            {new Date(log.attempted_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td style={{ fontSize: 11, color: '#B91C1C' }}>{log.error?.slice(0, 50) ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ marginTop: 14, padding: '12px 16px', background: '#EEF2FF', borderRadius: 10, fontSize: 13, color: '#3730A3', border: '1px solid #C7D2FE' }}>
            <strong>Going live:</strong> Set <code>WHATSAPP_PROVIDER=twilio</code> and <code>EMAIL_PROVIDER=resend</code> in Vercel env vars, then uncomment the provider code in <code>lib/whatsapp.ts</code> and <code>lib/email.ts</code>.
          </div>
        </div>
      )}
    </Layout>
  );
          }
