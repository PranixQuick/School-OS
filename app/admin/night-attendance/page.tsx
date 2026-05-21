'use client';
// Night Attendance — Residential / Hostel Schools
// Three check types: lights_out (10pm), morning (6am), meal (breakfast/dinner)
// Institution: residential schools, engineering hostels, medical college hostels
// Warden/admin role. Fast single-tap per student. Date navigation.
// Mobile-first: same UX as academic attendance but for residential context.

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface Student { id: string; name: string; class: string; room?: string; }
interface AttRecord { student_id: string; present: boolean; check_type: string; }

const CHECK_TYPES = [
  { value: 'lights_out', label: '🌙 Lights Out (10pm)', time: '22:00' },
  { value: 'morning',    label: '☀️ Morning Roll Call (6am)', time: '06:00' },
  { value: 'breakfast',  label: '🍽️ Breakfast',  time: '08:00' },
  { value: 'dinner',     label: '🍽️ Dinner',      time: '20:00' },
];

export default function NightAttendancePage() {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate]         = useState(today);
  const [checkType, setCheckType] = useState('lights_out');
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords]   = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sr, ar] = await Promise.all([
        fetch('/api/admin/night-attendance/students'),
        fetch(`/api/admin/night-attendance?date=${date}&check_type=${checkType}`),
      ]);
      if (sr.ok) { const d = await sr.json() as { students?: Student[] }; setStudents(d.students ?? []); }
      if (ar.ok) {
        const d = await ar.json() as { records?: AttRecord[] };
        const m = new Map<string, boolean>();
        (d.records ?? []).forEach(r => m.set(r.student_id, r.present));
        setRecords(m);
      } else {
        // No records yet — mark all present by default
        setRecords(new Map());
      }
    } catch {/**/}
    setLoading(false);
  }, [date, checkType]);

  useEffect(() => { void load(); }, [load]);

  function toggle(id: string) {
    setRecords(prev => { const m = new Map(prev); m.set(id, !(m.get(id) ?? true)); return m; });
  }

  function markAll(val: boolean) {
    setRecords(() => { const m = new Map<string, boolean>(); students.forEach(s => m.set(s.id, val)); return m; });
  }

  async function save() {
    setSaving(true);
    const rows = students.map(s => ({ student_id: s.id, present: records.get(s.id) ?? true, check_type: checkType, date }));
    try {
      const r = await fetch('/api/admin/night-attendance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: rows }),
      });
      if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    } catch {/**/}
    setSaving(false);
  }

  const presentCount = students.filter(s => records.get(s.id) !== false).length;
  const absentCount  = students.length - presentCount;
  const ct = CHECK_TYPES.find(c => c.value === checkType);

  return (
    <Layout title="Night Attendance" subtitle="Residential student check">
      {saved && <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 13, fontWeight: 700, color: '#15803D' }}>✅ Saved successfully</div>}

      {/* Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Date</label>
          <input type="date" value={date} max={today} onChange={e => setDate(e.target.value)}
            style={{ width: '100%', height: 44, borderRadius: 9, border: '1px solid #D1D5DB', padding: '0 12px', fontSize: 14, fontFamily: 'inherit', background: '#F9FAFB', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Check Type</label>
          <select value={checkType} onChange={e => setCheckType(e.target.value)}
            style={{ width: '100%', height: 44, borderRadius: 9, border: '1px solid #D1D5DB', padding: '0 12px', fontSize: 13, fontFamily: 'inherit', background: '#F9FAFB', boxSizing: 'border-box' }}>
            {CHECK_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>

      {/* Summary + bulk */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1E1B4B', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{ct?.label}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
            <span style={{ color: '#4ADE80' }}>✅ {presentCount}</span>
            {absentCount > 0 && <span style={{ color: '#F87171', marginLeft: 10 }}>❌ {absentCount} absent</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => markAll(true)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#15803D', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>All ✅</button>
          <button onClick={() => markAll(false)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Clear</button>
        </div>
      </div>

      {loading ? <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div> : students.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', background: '#F9FAFB', borderRadius: 12 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🏠</div>
          <div>No hostel students found. Allocate students to hostel rooms first.</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {students.map(s => {
              const isPresent = records.get(s.id) !== false;
              return (
                <button key={s.id} onClick={() => toggle(s.id)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 10, border: `2px solid ${isPresent ? '#BBF7D0' : '#FECACA'}`, background: isPresent ? '#F0FDF4' : '#FEF2F2', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                      Class {s.class}{s.room ? ` · Room ${s.room}` : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: 22 }}>{isPresent ? '✅' : '❌'}</span>
                </button>
              );
            })}
          </div>
          <button onClick={() => void save()} disabled={saving}
            style={{ width: '100%', height: 50, borderRadius: 12, border: 'none', background: saving ? '#9CA3AF' : '#1E1B4B', color: '#fff', fontSize: 15, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Saving…' : `🌙 Save ${ct?.label} (${presentCount}/${students.length})`}
          </button>
        </>
      )}
    </Layout>
  );
}
