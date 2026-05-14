'use client';
// app/student/timetable/page.tsx
// Batch 4D — Weekly timetable grid. Highlights today's column.

import { useState, useEffect } from 'react';

interface TimetableSlot { id: string; day_of_week: number; period: number; start_time: string; end_time: string; subject_name: string; teacher_name: string; }

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const SCHOOL_DAYS = [1,2,3,4,5,6]; // Mon-Sat; adjust per school

export default function TimetablePage() {
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().getDay();

  useEffect(() => {
    void fetch('/api/student/timetable').then(r => r.ok ? r.json() : null)
      .then((d: { timetable?: TimetableSlot[] } | null) => { setSlots(d?.timetable ?? []); setLoading(false); });
  }, []);

  // Build period list from data
  const periods = [...new Set(slots.map(s => s.period))].sort((a,b) => a-b);
  const slotMap: Record<string, TimetableSlot> = {};
  slots.forEach(s => { slotMap[`${s.day_of_week}_${s.period}`] = s; });

  const cardStyle = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 };

  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 16 }}>📅 Timetable</div>
      {loading ? <div style={{ color: '#9CA3AF', fontSize: 13 }}>Loading…</div>
      : slots.length === 0 ? (
        <div style={cardStyle}>
          <div style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', padding: 20 }}>Timetable not set up yet. Contact your school admin.</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 480 }}>
            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: `64px repeat(${SCHOOL_DAYS.length},1fr)`, gap: 4, marginBottom: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', padding: '6px 4px' }}>Period</div>
              {SCHOOL_DAYS.map(d => (
                <div key={d} style={{ fontSize: 11, fontWeight: 700, textAlign: 'center', padding: '6px 4px',
                  color: d === today ? '#4F46E5' : '#374151',
                  background: d === today ? '#EEF2FF' : 'transparent', borderRadius: 6 }}>
                  {DAYS[d]}
                </div>
              ))}
            </div>
            {/* Period rows */}
            {periods.map(period => {
              const sample = slots.find(s => s.period === period);
              return (
                <div key={period} style={{ display: 'grid', gridTemplateColumns: `64px repeat(${SCHOOL_DAYS.length},1fr)`, gap: 4, marginBottom: 4 }}>
                  <div style={{ fontSize: 9, color: '#9CA3AF', padding: '4px 2px', lineHeight: 1.3 }}>
                    <div style={{ fontWeight: 700 }}>P{period}</div>
                    {sample && <div>{sample.start_time?.slice(0,5)}</div>}
                  </div>
                  {SCHOOL_DAYS.map(d => {
                    const cell = slotMap[`${d}_${period}`];
                    const isToday = d === today;
                    return (
                      <div key={d} style={{ background: isToday ? '#EEF2FF' : '#F9FAFB', borderRadius: 7, padding: '6px 5px', minHeight: 48, border: isToday ? '1px solid #C7D2FE' : '1px solid #F3F4F6' }}>
                        {cell ? (
                          <>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>{cell.subject_name}</div>
                            <div style={{ fontSize: 9, color: '#6B7280', marginTop: 2 }}>{cell.teacher_name}</div>
                          </>
                        ) : <div style={{ fontSize: 9, color: '#E5E7EB' }}>—</div>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
