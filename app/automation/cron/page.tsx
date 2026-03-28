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

const JOB_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  fee_reminders:     { label: 'Fee Reminders',      icon: '💳', color: '#B91C1C' },
  risk_detection:    { label: 'Risk Detection',      icon: '⚠️', color: '#B45309' },
  principal_briefing:{ label: 'Principal Briefing',  icon: '📋', color: '#065F46' },
};

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  success: { bg: '#DCFCE7', color: '#15803D', label: 'SUCCESS' },
  failed:  { bg: '#FEE2E2', color: '#B91C1C', label: 'FAILED' },
  skipped: { bg: '#F3F4F6', color: '#6B7280', label: 'SKIPPED' },
  running: { bg: '#DBEAFE', color: '#1D4ED8', label: 'RUNNING' },
};

const JOBS = [
  { key: 'all',                 label: 'Run All Jobs',        icon: '⚡', desc: 'Fee reminders + Risk detection + Briefing' },
  { key: 'fee_reminders',       label: 'Fee Reminders Only',  icon: '💳', desc: 'Generate reminders for overdue/pending fees' },
  { key: 'risk_detection',      label: 'Risk Scan Only',      icon: '⚠️', desc: 'Scan all students for attendance/score/fee risks' },
  { key: 'principal_briefing',  label: 'Briefing Only',       icon: '📋', desc: 'Generate today\'s principal AI briefing' },
];

export default function CronPage() {
  const [runs, setRuns] = useState<CronRun[]>([]);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchHistory(); }, []);

  async function fetchHistory() {
    setLoading(true);
    try {
      const res = await fetch('/api/cron/run');
      const d = await res.json() as { runs: CronRun[]; summary: RunSummary };
      setRuns(d.runs ?? []);
      setSummary(d.summary ?? null);
    } finally { setLoading(false); }
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
      fetchHistory();
    } finally { setRunning(null); }
  }

  function formatDuration(ms: number | null) {
    if (!ms) return '—';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function formatResult(result: Record<string, unknown>): string {
    if (!result) return '';
    const parts: string[] = [];
    if (typeof result.reminders_sent === 'number') parts.push(`${result.reminders_sent} reminders sent`);
    if (typeof result.flagged === 'number') parts.push(`${result.flagged} students flagged`);
    if (result.briefing_id) parts.push('Briefing generated');
    if (result.reason) parts.push(String(result.reason));
    if (result.skipped) parts.push('Skipped (recent)');
    return parts.join(' · ') || JSON.stringify(result).slice(0, 80);
  }

  return (
    <Layout
      title="Cron Jobs"
      subtitle="Autonomous AI automation — daily intelligence layer"
      actions={<Link href="/automation" className="btn btn-ghost btn-sm">← Automation</Link>}
    >
      {/* Stats */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total Runs', value: summary.total, color: '#4F46E5', bg: '#EEF2FF' },
            { label: 'Succeeded', value: summary.success, color: '#15803D', bg: '#DCFCE7' },
            { label: 'Failed', value: summary.failed, color: '#B91C1C', bg: '#FEE2E2' },
            { label: 'Skipped', value: summary.skipped, color: '#6B7280', bg: '#F3F4F6' },
          ].map(k => (
            <div key={k.label} className="kpi-card">
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.03em', marginBottom: 8 }}>{k.label.toUpperCase()}</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Manual triggers */}
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
                <button
                  onClick={() => triggerJob(job.key)}
                  disabled={running !== null}
                  className="btn btn-primary btn-sm"
                  style={{ minWidth: 70, opacity: running !== null ? 0.6 : 1 }}
                >
                  {running === job.key ? (
                    <>
                      <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'os_spin 0.7s linear infinite' }} />
                      Running
                    </>
                  ) : 'Run'}
                </button>
              </div>
            ))}
          </div>

          {lastResult && (
            <div className="alert alert-info" style={{ marginTop: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                ✓ Job completed — {(lastResult.succeeded as number ?? 0)}/{(lastResult.jobs_run as number ?? 0)} succeeded
              </div>
              {Array.isArray(lastResult.results) && (lastResult.results as Array<{job: string; success: boolean; data?: Record<string, unknown>; error?: string; durationMs: number}>).map((r, i) => (
                <div key={i} style={{ fontSize: 12, color: '#374151', marginBottom: 2 }}>
                  {r.success ? '✓' : '✗'} {r.job}: {r.success ? formatResult(r.data ?? {}) : r.error} ({formatDuration(r.durationMs)})
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 14, padding: '12px 14px', background: '#F9FAFB', borderRadius: 10, fontSize: 12, color: '#6B7280', border: '1px solid #F3F4F6' }}>
            <strong style={{ color: '#374151' }}>Auto-schedule:</strong> Daily at 2:00 AM UTC via Vercel Cron.<br />
            Fee reminders sent once per fee per day. Briefing generated once per 4 hours.
          </div>
        </div>

        {/* Run history */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>Run History</div>
            <button onClick={fetchHistory} className="btn btn-ghost btn-sm">↻ Refresh</button>
          </div>

          {loading ? (
            <div className="card"><div className="empty-state"><div className="empty-state-icon">⏱</div><div className="empty-state-title">Loading history...</div></div></div>
          ) : runs.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">🤖</div>
                <div className="empty-state-title">No runs yet</div>
                <div className="empty-state-sub">Trigger a job to see run history here.</div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden', maxHeight: 480, overflowY: 'auto' }}>
              {runs.map((run, i) => {
                const jobMeta = JOB_LABELS[run.job_name] ?? { label: run.job_name, icon: '🔧', color: '#6B7280' };
                const statusStyle = STATUS_BADGE[run.status] ?? STATUS_BADGE.skipped;
                return (
                  <div key={run.id} style={{ padding: '11px 16px', borderBottom: i < runs.length - 1 ? '1px solid #F9FAFB' : 'none', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ fontSize: 18, marginTop: 1, flexShrink: 0 }}>{jobMeta.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{jobMeta.label}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: statusStyle.bg, color: statusStyle.color }}>
                          {statusStyle.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                        {new Date(run.started_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        {' · '}{run.triggered_by}
                        {run.duration_ms ? ` · ${formatDuration(run.duration_ms)}` : ''}
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
    </Layout>
  );
}
