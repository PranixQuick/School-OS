'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { T } from '@/lib/i18n';
import { useLang } from '@/lib/useLang';

interface Slot { id: string; day_of_week: number; period_number: number; class: string; section: string; subject_name?: string; teacher_name?: string; start_time?: string; end_time?: string; }

const DAY_KEYS       = ['monday',    'tuesday',  'wednesday', 'thursday', 'friday',    'saturday'];
const DAY_SHORT_KEYS = ['mon_short', 'tue_short','wed_short', 'thu_short','fri_short', 'sat_short'];

export default function TimetablePage() {
  const { lang } = useLang();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState('5');
  const [sectionFilter, setSectionFilter] = useState('A');

  useEffect(() => {
    fetch(`/api/admin/timetable?class=${classFilter}&section=${sectionFilter}`)
      .then(r => r.ok ? r.json() : { slots: [] })
      .then(d => { setSlots(d.slots ?? d.timetable ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [classFilter, sectionFilter]);

  const periods = Array.from(new Set(slots.map(s => s.period_number))).sort((a, b) => a - b);
  const slotMap: Record<string, Slot> = {};
  slots.forEach(s => { slotMap[`${s.day_of_week}-${s.period_number}`] = s; });

  return (
    <Layout title={T('timetable', lang as never)} subtitle={T('timetable', lang as never)}>
      <div style={{ marginBottom: 12 }}>
        <a href="/admin/subjects" style={{ fontSize: 13, fontWeight: 600, color: '#4F46E5', textDecoration: 'none' }}>📘 Manage subjects →</a>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {(['3','4','5','6','7','8','9','10'] as const).map(c => (
          <button key={c} onClick={() => setClassFilter(c)}
            style={{ padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: classFilter === c ? '#4F46E5' : '#F3F4F6',
              color: classFilter === c ? '#fff' : '#374151' }}>
            {T('class_', lang as never)} {c}
          </button>
        ))}
        {['A','B','C'].map(s => (
          <button key={s} onClick={() => setSectionFilter(s)}
            style={{ padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: sectionFilter === s ? '#065F46' : '#F3F4F6',
              color: sectionFilter === s ? '#fff' : '#374151' }}>
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>{T('loading', lang as never)}</div>
      ) : slots.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🗓</div>
          <div className="empty-state-title">{T('no_records', lang as never)} — {T('class_', lang as never)} {classFilter}-{sectionFilter}</div>
          <div className="empty-state-sub">{T('timetable', lang as never)}</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '2px solid #E5E7EB', whiteSpace: 'nowrap' }}>
                  P#
                </th>
                {DAY_KEYS.map((dk, i) => (
                  <th key={dk} style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: '#374151', borderBottom: '2px solid #E5E7EB', whiteSpace: 'nowrap' }}>
                    {T(DAY_SHORT_KEYS[i], lang as never)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map(p => (
                <tr key={p} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>P{p}</td>
                  {DAY_KEYS.map((_, di) => {
                    const slot = slotMap[`${di + 1}-${p}`];
                    return (
                      <td key={di} style={{ padding: '6px 8px', textAlign: 'center' }}>
                        {slot ? (
                          <div style={{ padding: '4px 6px', borderRadius: 6, background: '#EEF2FF' }}>
                            <div style={{ fontWeight: 600, color: '#4F46E5', fontSize: 11 }}>{slot.subject_name ?? '—'}</div>
                            {slot.teacher_name && <div style={{ fontSize: 10, color: '#6B7280' }}>{slot.teacher_name.split(' ')[0]}</div>}
                          </div>
                        ) : <span style={{ color: '#E5E7EB' }}>—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
