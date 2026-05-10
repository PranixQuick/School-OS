'use client';

// PATH: app/automation/lesson-plans-coverage/page.tsx
//
// Principal-facing coverage rollup view.
// Default: today IST. Pager: ← Prev day | Today | Next day →.
// Shows school-wide stats + per-class table sorted by lowest completion% first.

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

interface ClassRow {
  class_id: string;
  grade_level: string;
  section: string;
  planned: number;
  in_progress: number;
  completed: number;
  skipped: number;
  total: number;
  completion_pct: number;
}

interface CoverageData {
  date: string;
  total_classes: number;
  classes_with_plans: number;
  classes_without_plans: number;
  school_summary: {
    planned: number;
    in_progress: number;
    completed: number;
    skipped: number;
    total: number;
    completion_pct: number;
  };
  per_class: ClassRow[];
}

function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00+05:30');
  const shifted = new Date(d.getTime() + days * 86400000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(shifted);
}

function fmtDate(s: string): string {
  return new Date(s + 'T00:00:00+05:30').toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

export default function CoveragePage() {
  const [date, setDate] = useState(todayIST());
  const [data, setData] = useState<CoverageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  async function load(d: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/principal/lesson-plans/coverage?date=${d}`);
      if (res.ok) {
        const j = await res.json();
        setData(j as CoverageData);
        setLastRefreshedAt(new Date());
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(date); }, [date]);

  function getColor(pct: number): string {
    if (pct >= 80) return '#15803D';
    if (pct >= 50) return '#A16207';
    return '#B91C1C';
  }

  return (
    <Layout
      title="Lesson Plan Coverage"
      subtitle={data ? `${fmtDate(data.date)} · ${data.classes_with_plans} of ${data.total_classes} classes have plans` : 'Loading...'}
      actions={
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setDate(shiftDate(date, -1))} className="btn btn-ghost btn-sm">← Prev</button>
          <button onClick={() => setDate(todayIST())} className="btn btn-ghost btn-sm">Today</button>
          <button onClick={() => setDate(shiftDate(date, 1))} className="btn btn-ghost btn-sm">Next →</button>
        </div>
      }
    >
      {loading ? (
        <div className="empty-state">
          <div className="empty-state-icon">⏳</div>
          <div className="empty-state-title">Loading coverage...</div>
        </div>
      ) : !data ? (
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <div className="empty-state-title">No data</div>
        </div>
      ) : (
        <>
          {/* School-wide summary */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-header">
              <div>
                <div className="section-title">School-wide rollup for {fmtDate(data.date)}</div>
                <div className="section-sub">
                  {lastRefreshedAt && (
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                      ↻ {lastRefreshedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
              <div className="kpi-card">
                <div className="kpi-label">Total plans</div>
                <div className="kpi-value">{data.school_summary.total}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Completed</div>
                <div className="kpi-value">{data.school_summary.completed}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">In progress</div>
                <div className="kpi-value">{data.school_summary.in_progress}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Skipped</div>
                <div className="kpi-value">{data.school_summary.skipped}</div>
              </div>
              <div className="kpi-card" style={{ borderLeft: `4px solid ${getColor(data.school_summary.completion_pct)}` }}>
                <div className="kpi-label">Coverage</div>
                <div className="kpi-value" style={{ color: getColor(data.school_summary.completion_pct) }}>
                  {data.school_summary.completion_pct}%
                </div>
              </div>
            </div>
          </div>

          {/* Per-class breakdown */}
          <div className="card">
            <div className="section-header">
              <div>
                <div className="section-title">Per-class coverage</div>
                <div className="section-sub">
                  Sorted lowest-completion first (most urgent for review)
                </div>
              </div>
            </div>

            {data.per_class.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <div className="empty-state-title">No classes seeded</div>
                <div className="empty-state-sub">Seed at least one class row to see coverage data.</div>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="table" style={{ width: '100%', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Class</th>
                      <th style={{ textAlign: 'center' }}>Total</th>
                      <th style={{ textAlign: 'center' }}>✓ Completed</th>
                      <th style={{ textAlign: 'center' }}>↻ In progress</th>
                      <th style={{ textAlign: 'center' }}>📅 Planned</th>
                      <th style={{ textAlign: 'center' }}>⊘ Skipped</th>
                      <th style={{ textAlign: 'right' }}>Coverage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.per_class.map(r => (
                      <tr key={r.class_id}>
                        <td style={{ fontWeight: 700 }}>{r.grade_level}-{r.section}</td>
                        <td style={{ textAlign: 'center', color: r.total === 0 ? '#9CA3AF' : '#111827' }}>{r.total}</td>
                        <td style={{ textAlign: 'center' }}>{r.completed || '—'}</td>
                        <td style={{ textAlign: 'center' }}>{r.in_progress || '—'}</td>
                        <td style={{ textAlign: 'center' }}>{r.planned || '—'}</td>
                        <td style={{ textAlign: 'center' }}>{r.skipped || '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: r.total === 0 ? '#9CA3AF' : getColor(r.completion_pct) }}>
                          {r.total === 0 ? '—' : `${r.completion_pct}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </Layout>
  );
}
