'use client';
// app/hod/roster/page.tsx
// HOD — Class Roster (timetable for the department). Read-only.
// Data: /api/hod/roster

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface RosterRow {
  id: string;
  day_of_week: number | string;
  period: number | string;
  start_time?: string | null;
  end_time?: string | null;
  classes?: { grade_level?: string; section?: string } | null;
  subjects?: { name?: string } | null;
  staff?: { name?: string } | null;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dayLabel = (d: number | string) => {
  const n = typeof d === 'string' ? parseInt(d, 10) : d;
  return Number.isFinite(n) && DAYS[n] ? DAYS[n] : String(d);
};

export default function HodRosterPage() {
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/hod/roster');
      if (!r.ok) throw new Error('Could not load the roster. If you were just given HOD access, sign out and back in.');
      const data = await r.json();
      setRows(data.roster ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Group by day
  const byDay: Record<string, RosterRow[]> = {};
  for (const row of rows) {
    const key = dayLabel(row.day_of_week);
    (byDay[key] ??= []).push(row);
  }
  const orderedDays = DAYS.filter(d => byDay[d]);

  return (
    <Layout title="Class Roster" subtitle="Timetable across your department">
      {loading ? (
        <div style={{ padding: 28, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 16, background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', borderRadius: 12, fontSize: 13, fontWeight: 600 }}>{error}</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: 20, background: '#F9FAFB', border: '1px dashed #E5E7EB', borderRadius: 12, color: '#6B7280', fontSize: 13 }}>No timetable periods are assigned to your department yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {orderedDays.map(day => (
            <section key={day}>
              <h2 style={{ fontSize: 13, fontWeight: 800, color: '#111827', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '.04em' }}>{day}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {byDay[day]
                  .slice()
                  .sort((a, b) => (Number(a.period) || 0) - (Number(b.period) || 0))
                  .map(row => (
                    <div key={row.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ minWidth: 44, textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 700 }}>PERIOD</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#4F46E5' }}>{row.period}</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{row.subjects?.name ?? 'Subject'}</div>
                        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                          {row.classes ? `Class ${row.classes.grade_level ?? ''}${row.classes.section ? '-' + row.classes.section : ''}` : ''}
                          {row.staff?.name ? ` · ${row.staff.name}` : ''}
                        </div>
                      </div>
                      {(row.start_time || row.end_time) && (
                        <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {row.start_time ?? ''}{row.end_time ? `–${row.end_time}` : ''}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </Layout>
  );
}
