'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Slot { day: string; period: number; subject: string; staff_name?: string; start_time?: string; end_time?: string; }

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export default function ParentTimetablePage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentClass, setStudentClass] = useState('');

  useEffect(() => {
    // Get student class from dashboard info
    fetch('/api/parent/dashboard')
      .then(r => r.ok ? r.json() : null)
      .then(async (d) => {
        if (!d?.student) return;
        setStudentClass(`Class ${d.student.class}-${d.student.section}`);
        const res = await fetch(`/api/teacher/timetable?class=${d.student.class}&section=${d.student.section}`);
        if (res.ok) {
          const t = await res.json();
          setSlots(t.timetable ?? t.slots ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const daySlots = (day: string) => slots.filter(s => s.day === day).sort((a,b) => a.period - b.period);

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ background: '#4F46E5', padding: '16px 16px 20px' }}>
        <Link href="/parent" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, textDecoration: 'none', display: 'block', marginBottom: 8 }}>← Back</Link>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>Timetable</div>
        {studentClass && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>{studentClass}</div>}
      </div>
      <div style={{ padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading…</div>
        ) : slots.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#9CA3AF' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🗓️</div>
            <div style={{ fontWeight: 700, color: '#374151' }}>Timetable not published yet.</div>
            <div style={{ marginTop: 4, fontSize: 13 }}>Check back later.</div>
          </div>
        ) : DAYS.map(day => {
          const dSlots = daySlots(day);
          if (dSlots.length === 0) return null;
          return (
            <div key={day} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>{day}</div>
              {dSlots.map((s, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: 10, padding: '10px 14px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '3px solid #4F46E5' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{s.subject}</div>
                    {s.staff_name && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{s.staff_name}</div>}
                  </div>
                  <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                    {s.start_time ? `${s.start_time}–${s.end_time ?? ''}` : `Period ${s.period}`}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
