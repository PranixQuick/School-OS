'use client';
// app/student/attendance/page.tsx
// Batch 4D — Attendance calendar + summary.

import { useState, useEffect } from 'react';

interface AttendanceRecord { date: string; status: string; }
interface AttendanceSummary { present: number; absent: number; late: number; total: number; percentage: number; }

const STATUS_COLOR: Record<string, string> = { present: '#D1FAE5', absent: '#FEE2E2', late: '#FEF9C3' };
const STATUS_TEXT: Record<string, string> = { present: '#065F46', absent: '#991B1B', late: '#92400E' };

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const to = new Date().toISOString().slice(0,10);
    const from = new Date(Date.now() - 90*24*60*60*1000).toISOString().slice(0,10);
    void fetch(`/api/student/attendance?from=${from}&to=${to}`).then(r => r.ok ? r.json() : null)
      .then((d: { attendance?: AttendanceRecord[]; summary?: AttendanceSummary } | null) => {
        setRecords(d?.attendance ?? []);
        setSummary(d?.summary ?? null);
        setLoading(false);
      });
  }, []);

  const recordMap = Object.fromEntries(records.map(r => [r.date, r.status]));

  // Build calendar for current month
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();
  const monthDates: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({length:daysInMonth},(_,i)=>i+1)];

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DOW = ['S','M','T','W','T','F','S'];

  const cardStyle = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, marginBottom: 14 };

  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 14 }}>✅ Attendance</div>

      {loading ? <div style={{ color: '#9CA3AF', fontSize: 13, padding: 20 }}>Loading…</div> : (
        <>
          {/* Summary stats */}
          {summary && (
            <div style={cardStyle}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 10 }}>Last 90 days</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {[
                  ['Present', summary.present, '#065F46', '#D1FAE5'],
                  ['Absent', summary.absent, '#991B1B', '#FEE2E2'],
                  ['Late', summary.late, '#92400E', '#FEF9C3'],
                ].map(([l, v, fg, bg]) => (
                  <div key={l as string} style={{ flex: 1, textAlign: 'center', background: bg as string, borderRadius: 8, padding: '8px 4px' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: fg as string }}>{v as number}</div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: fg as string }}>{l as string}</div>
                  </div>
                ))}
                <div style={{ flex: 1, textAlign: 'center', background: summary.percentage >= 75 ? '#D1FAE5' : '#FEF3C7', borderRadius: 8, padding: '8px 4px' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: summary.percentage >= 75 ? '#065F46' : '#D97706' }}>{summary.percentage}%</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: summary.percentage >= 75 ? '#065F46' : '#D97706' }}>Rate</div>
                </div>
              </div>
              <div style={{ background: '#F3F4F6', borderRadius: 4, height: 8 }}>
                <div style={{ width: `${summary.percentage}%`, height: 8, borderRadius: 4, background: summary.percentage >= 75 ? '#16A34A' : '#F59E0B', transition: 'width 0.5s' }} />
              </div>
              {summary.percentage < 75 && (
                <div style={{ marginTop: 6, fontSize: 10, color: '#D97706', fontWeight: 600 }}>⚠️ Attendance below 75% — attendance may affect exam eligibility.</div>
              )}
            </div>
          )}

          {/* Calendar */}
          <div style={cardStyle}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{MONTH_NAMES[month]} {year}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
              {DOW.map((d, i) => (
                <div key={i} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#9CA3AF', padding: '4px 0' }}>{d}</div>
              ))}
              {monthDates.map((day, i) => {
                if (!day) return <div key={i} />;
                const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const status = recordMap[dateStr];
                const isToday = dateStr === new Date().toISOString().slice(0,10);
                return (
                  <div key={i} style={{
                    textAlign: 'center', padding: '5px 2px', borderRadius: 6, fontSize: 11, fontWeight: isToday ? 800 : 500,
                    background: status ? STATUS_COLOR[status] ?? '#F3F4F6' : isToday ? '#EEF2FF' : 'transparent',
                    color: status ? STATUS_TEXT[status] ?? '#374151' : isToday ? '#4F46E5' : '#374151',
                    border: isToday ? '2px solid #4F46E5' : '1px solid transparent',
                  }}>
                    {day}
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 10, color: '#6B7280' }}>
              {[['present','#D1FAE5','#065F46'],['absent','#FEE2E2','#991B1B'],['late','#FEF9C3','#92400E']].map(([l,bg,fg]) => (
                <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: bg, display: 'inline-block' }}/>
                  <span style={{ color: fg, fontWeight: 600, textTransform: 'capitalize' }}>{l}</span>
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
