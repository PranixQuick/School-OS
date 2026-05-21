'use client';
// Meal attendance — Mid-Day Meal (MDM) attendance marking
// Used by: govt school teachers, Anganwadi AWW
// Separate from academic attendance — tracks who received meal today
// Important for MDM stock reconciliation and ICDS reporting

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface Student { id: string; name: string; class: string; section: string; }
interface MealRecord { student_id: string; meal_served: boolean; meal_type: string; }

export default function MealAttendancePage() {
  const today = new Date().toISOString().split('T')[0];
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<Map<string, boolean>>(new Map());
  const [mealType, setMealType] = useState('lunch');
  const [date, setDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sr, mr] = await Promise.all([
        fetch('/api/anganwadi/children'),
        fetch(`/api/teacher/meal-attendance?date=${date}&meal_type=${mealType}`),
      ]);
      if (sr.ok) { const d = await sr.json() as { students?: Student[] }; setStudents(d.students ?? []); }
      if (mr.ok) {
        const d = await mr.json() as { records?: MealRecord[] };
        const m = new Map<string, boolean>();
        (d.records ?? []).forEach(r => m.set(r.student_id, r.meal_served));
        setRecords(m);
      }
    } catch {/**/}
    setLoading(false);
  }, [date, mealType]);

  useEffect(() => { void load(); }, [load]);

  function toggle(id: string) {
    setRecords(prev => { const m = new Map(prev); m.set(id, !m.get(id)); return m; });
  }

  function markAll(val: boolean) {
    setRecords(() => { const m = new Map<string,boolean>(); students.forEach(s => m.set(s.id, val)); return m; });
  }

  async function save() {
    setSaving(true);
    const rows = students.map(s => ({ student_id: s.id, meal_served: records.get(s.id) ?? false, meal_type: mealType, date }));
    try {
      const r = await fetch('/api/teacher/meal-attendance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: rows }),
      });
      if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    } catch {/**/}
    setSaving(false);
  }

  const served = students.filter(s => records.get(s.id) === true).length;
  const total = students.length;

  return (
    <Layout title="భోజన హాజరు" subtitle={`Mid-Day Meal Attendance — ${date}`}>
      {saved && <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 14, fontWeight: 600, color: '#15803D' }}>✅ Saved successfully!</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ width: '100%', height: 44, borderRadius: 9, border: '1px solid #D1D5DB', padding: '0 10px', fontSize: 14, fontFamily: 'inherit', background: '#F9FAFB' }} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Meal Type</label>
          <select value={mealType} onChange={e => setMealType(e.target.value)}
            style={{ width: '100%', height: 44, borderRadius: 9, border: '1px solid #D1D5DB', padding: '0 10px', fontSize: 14, fontFamily: 'inherit', background: '#F9FAFB' }}>
            <option value="breakfast">🌅 Breakfast</option>
            <option value="lunch">🍽️ Lunch (MDM)</option>
            <option value="snack">🍌 Evening Snack</option>
          </select>
        </div>
      </div>

      {/* Summary + bulk actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F9FAFB', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>
          🍽️ {served} / {total} served
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => markAll(true)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#15803D', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>All ✅</button>
          <button onClick={() => markAll(false)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Clear</button>
        </div>
      </div>

      {loading ? <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div> : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {students.map(s => {
              const served_this = records.get(s.id) === true;
              return (
                <button key={s.id} onClick={() => toggle(s.id)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 10, border: `2px solid ${served_this ? '#BBF7D0' : '#E5E7EB'}`, background: served_this ? '#F0FDF4' : '#fff', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>Class {s.class}-{s.section}</div>
                  </div>
                  <span style={{ fontSize: 22 }}>{served_this ? '✅' : '⬜'}</span>
                </button>
              );
            })}
          </div>
          <button onClick={() => void save()} disabled={saving}
            style={{ width: '100%', height: 50, borderRadius: 12, border: 'none', background: saving ? '#9CA3AF' : '#D97706', color: '#fff', fontSize: 15, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'సేవ్ చేస్తోంది…' : `💾 Save Meal Attendance (${served}/${total})`}
          </button>
        </>
      )}
    </Layout>
  );
}
