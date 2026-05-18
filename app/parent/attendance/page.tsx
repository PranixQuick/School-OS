'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface AttRow { date: string; status: string; subject?: string; note?: string; }

export default function ParentAttendancePage() {
  const [rows, setRows] = useState<AttRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ present: 0, absent: 0, late: 0, total: 0 });

  useEffect(() => {
    fetch('/api/parent/attendance')
      .then(r => r.ok ? r.json() : { attendance: [] })
      .then(d => {
        const att = d.attendance ?? [];
        setRows(att);
        setSummary({
          present: att.filter((r: AttRow) => r.status === 'present').length,
          absent: att.filter((r: AttRow) => r.status === 'absent').length,
          late: att.filter((r: AttRow) => r.status === 'late').length,
          total: att.length,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const statusColor = (s: string) => ({ present: '#16A34A', absent: '#B91C1C', late: '#D97706', holiday: '#6B7280' })[s] ?? '#6B7280';
  const statusBg = (s: string) => ({ present: '#F0FDF4', absent: '#FEF2F2', late: '#FFFBEB', holiday: '#F9FAFB' })[s] ?? '#F9FAFB';
  const pct = summary.total > 0 ? Math.round((summary.present / summary.total) * 100) : 0;

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ background: '#4F46E5', padding: '16px 16px 20px' }}>
        <Link href="/parent" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, textDecoration: 'none', display: 'block', marginBottom: 8 }}>← Back</Link>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>Attendance</div>
      </div>
      <div style={{ padding: 16 }}>
        {/* Summary */}
        <div style={{ background: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: pct >= 75 ? '#16A34A' : '#B91C1C' }}>{pct}%</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>Last 90 days</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[['Present', summary.present, '#16A34A', '#F0FDF4'], ['Absent', summary.absent, '#B91C1C', '#FEF2F2'], ['Late', summary.late, '#D97706', '#FFFBEB']].map(([label, val, col, bg]) => (
              <div key={label as string} style={{ background: bg as string, borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: col as string }}>{val as number}</div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>{label as string}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Detail rows */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>No attendance records found.</div>
        ) : rows.slice(0, 60).map((r, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `3px solid ${statusColor(r.status)}` }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{new Date(r.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
              {r.note && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{r.note}</div>}
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: statusBg(r.status), color: statusColor(r.status) }}>{r.status.charAt(0).toUpperCase() + r.status.slice(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
