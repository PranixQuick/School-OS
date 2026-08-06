'use client';
// app/hod/results/page.tsx
// HOD — Tests & Results (batch-level performance). Read-only.
// Data: /api/hod/performance

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface Perf {
  batch_id: string | null;
  batch_name: string;
  avg_marks_pct: number;
  avg_attendance_pct: number;
}

const barColor = (pct: number) => pct >= 75 ? '#15803D' : pct >= 40 ? '#D97706' : '#B91C1C';

export default function HodResultsPage() {
  const [rows, setRows] = useState<Perf[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/hod/performance');
      if (!r.ok) throw new Error('Could not load results. If you were just given HOD access, sign out and back in.');
      const data = await r.json();
      setRows(data.performance ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const overallMarks = rows.length ? Math.round(rows.reduce((t, r) => t + (r.avg_marks_pct || 0), 0) / rows.length) : 0;

  return (
    <Layout title="Tests & Results" subtitle="Batch performance across your department">
      {loading ? (
        <div style={{ padding: 28, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 16, background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', borderRadius: 12, fontSize: 13, fontWeight: 600 }}>{error}</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: 20, background: '#F9FAFB', border: '1px dashed #E5E7EB', borderRadius: 12, color: '#6B7280', fontSize: 13 }}>No test results have been recorded for your department yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          <div style={{ background: 'linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 100%)', borderRadius: 14, padding: '16px 18px', color: '#fff' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>Department average score</div>
            <div style={{ fontSize: 30, fontWeight: 800, marginTop: 2 }}>{overallMarks}%</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>across {rows.length} {rows.length === 1 ? 'batch' : 'batches'}</div>
          </div>

          {rows.map((r, i) => (
            <div key={r.batch_id ?? `b${i}`} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 10 }}>{r.batch_name}</div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B7280', marginBottom: 4 }}>
                  <span>Avg. marks</span><span style={{ fontWeight: 700, color: barColor(r.avg_marks_pct) }}>{r.avg_marks_pct}%</span>
                </div>
                <div style={{ height: 8, background: '#F3F4F6', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, r.avg_marks_pct)}%`, height: '100%', background: barColor(r.avg_marks_pct), borderRadius: 99 }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B7280', marginBottom: 4 }}>
                  <span>Avg. attendance</span><span style={{ fontWeight: 700, color: barColor(r.avg_attendance_pct) }}>{r.avg_attendance_pct}%</span>
                </div>
                <div style={{ height: 8, background: '#F3F4F6', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, r.avg_attendance_pct)}%`, height: '100%', background: barColor(r.avg_attendance_pct), borderRadius: 99 }} />
                </div>
              </div>
            </div>
          ))}

        </div>
      )}
    </Layout>
  );
}
