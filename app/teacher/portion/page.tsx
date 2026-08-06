'use client';
// app/teacher/portion/page.tsx
// Teacher — My Portion. Shows topics the HOD assigned to this teacher and lets
// them mark coverage. Renders inside TeacherLayout (mobile shell). Read/PATCH: /api/teacher/portion

import { useState, useEffect, useCallback } from 'react';

interface Plan {
  id: string;
  week_number?: number | null;
  topic_name?: string | null;
  chapter_ref?: string | null;
  status?: string | null;
  classes?: { grade_level?: string; section?: string } | null;
  subjects?: { name?: string } | null;
}

const STATUSES: { value: string; label: string }[] = [
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Covered' },
];

const statusStyle = (s?: string | null): { bg: string; fg: string; label: string } => {
  const v = (s ?? '').toLowerCase();
  if (v === 'completed' || v === 'covered' || v === 'done') return { bg: '#DCFCE7', fg: '#15803D', label: 'Covered' };
  if (v === 'in_progress' || v === 'ongoing') return { bg: '#FEF9C3', fg: '#A16207', label: 'In progress' };
  if (v === 'delayed' || v === 'behind') return { bg: '#FEE2E2', fg: '#B91C1C', label: 'Delayed' };
  return { bg: '#F3F4F6', fg: '#6B7280', label: 'Planned' };
};

export default function TeacherPortionPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/teacher/portion');
      if (!r.ok) throw new Error('Could not load your portion. Please try again.');
      const data = await r.json();
      setPlans(data.portion ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const setStatus = async (id: string, status: string) => {
    setPlans(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    try {
      await fetch('/api/teacher/portion', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
    } catch { void load(); }
  };

  const total = plans.length;
  const covered = plans.filter(p => { const v = (p.status ?? '').toLowerCase(); return v === 'completed' || v === 'covered' || v === 'done'; }).length;
  const pct = total > 0 ? Math.round((covered / total) * 100) : 0;

  const bySubject: Record<string, Plan[]> = {};
  for (const p of plans) { const key = p.subjects?.name ?? 'General'; (bySubject[key] ??= []).push(p); }
  const subjects = Object.keys(bySubject).sort();

  return (
    <div style={{ padding: '14px 14px 24px' }}>
      <h1 style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: '0 0 2px' }}>My Portion</h1>
      <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 14px' }}>Topics your HOD assigned — mark them as you cover them.</p>

      {loading ? (
        <div style={{ padding: 28, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 16, background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', borderRadius: 12, fontSize: 13, fontWeight: 600 }}>{error}</div>
      ) : total === 0 ? (
        <div style={{ padding: 20, background: '#F9FAFB', border: '1px dashed #E5E7EB', borderRadius: 12, color: '#6B7280', fontSize: 13 }}>No topics have been assigned to you yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)', borderRadius: 14, padding: '16px 18px', color: '#fff' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>Your portion covered</div>
            <div style={{ fontSize: 30, fontWeight: 800, marginTop: 2 }}>{pct}%</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>{covered} of {total} topics covered</div>
            <div style={{ height: 8, background: 'rgba(255,255,255,0.25)', borderRadius: 99, marginTop: 10, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: '#fff', borderRadius: 99 }} />
            </div>
          </div>

          {subjects.map(sub => (
            <section key={sub}>
              <h2 style={{ fontSize: 13, fontWeight: 800, color: '#111827', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '.04em' }}>{sub}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {bySubject[sub].slice().sort((a, b) => (a.week_number ?? 0) - (b.week_number ?? 0)).map(p => {
                  const st = statusStyle(p.status);
                  return (
                    <div key={p.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {p.week_number != null && (
                          <div style={{ minWidth: 40, textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 700 }}>WK</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#4F46E5' }}>{p.week_number}</div>
                          </div>
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{p.topic_name ?? 'Topic'}</div>
                          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                            {p.chapter_ref ? `${p.chapter_ref}` : ''}
                            {p.classes ? `${p.chapter_ref ? ' · ' : ''}Class ${p.classes.grade_level ?? ''}${p.classes.section ? '-' + p.classes.section : ''}` : ''}
                          </div>
                        </div>
                        <span style={{ background: st.bg, color: st.fg, borderRadius: 99, padding: '4px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{st.label}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                        {STATUSES.map(s => {
                          const active = (p.status ?? 'planned') === s.value;
                          return (
                            <button key={s.value} onClick={() => setStatus(p.id, s.value)}
                              style={{ flex: 1, padding: '7px 4px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                border: active ? '1px solid #4F46E5' : '1px solid #E5E7EB',
                                background: active ? '#EEF2FF' : '#fff', color: active ? '#4338CA' : '#6B7280' }}>
                              {s.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
