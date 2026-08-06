'use client';
// app/hod/portion/page.tsx
// HOD — Portion Covered (yearly syllabus plan progress). Read-only.
// Data: /api/hod/syllabus

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface Plan {
  id: string;
  week_number?: number | null;
  topic_name?: string | null;
  chapter_ref?: string | null;
  status?: string | null;
  classes?: { grade_level?: string; section?: string } | null;
  subjects?: { name?: string } | null;
}

const statusStyle = (s?: string | null): { bg: string; fg: string; label: string } => {
  const v = (s ?? '').toLowerCase();
  if (v === 'completed' || v === 'covered' || v === 'done') return { bg: '#DCFCE7', fg: '#15803D', label: 'Covered' };
  if (v === 'in_progress' || v === 'ongoing') return { bg: '#FEF9C3', fg: '#A16207', label: 'In progress' };
  if (v === 'delayed' || v === 'behind') return { bg: '#FEE2E2', fg: '#B91C1C', label: 'Delayed' };
  return { bg: '#F3F4F6', fg: '#6B7280', label: s || 'Planned' };
};

export default function HodPortionPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/hod/syllabus');
      if (!r.ok) throw new Error('Could not load portion data. If you were just given HOD access, sign out and back in.');
      const data = await r.json();
      setPlans(data.syllabus ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const total = plans.length;
  const covered = plans.filter(p => { const v = (p.status ?? '').toLowerCase(); return v === 'completed' || v === 'covered' || v === 'done'; }).length;
  const pct = total > 0 ? Math.round((covered / total) * 100) : 0;

  // Group by subject
  const bySubject: Record<string, Plan[]> = {};
  for (const p of plans) {
    const key = p.subjects?.name ?? 'General';
    (bySubject[key] ??= []).push(p);
  }
  const subjects = Object.keys(bySubject).sort();

  return (
    <Layout title="Portion Covered" subtitle="Syllabus progress by subject">
      {loading ? (
        <div style={{ padding: 28, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 16, background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', borderRadius: 12, fontSize: 13, fontWeight: 600 }}>{error}</div>
      ) : total === 0 ? (
        <div style={{ padding: 20, background: '#F9FAFB', border: '1px dashed #E5E7EB', borderRadius: 12, color: '#6B7280', fontSize: 13 }}>No syllabus plan has been entered for your department yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)', borderRadius: 14, padding: '16px 18px', color: '#fff' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>Overall portion covered</div>
            <div style={{ fontSize: 30, fontWeight: 800, marginTop: 2 }}>{pct}%</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>{covered} of {total} topics marked covered</div>
            <div style={{ height: 8, background: 'rgba(255,255,255,0.25)', borderRadius: 99, marginTop: 10, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: '#fff', borderRadius: 99 }} />
            </div>
          </div>

          {subjects.map(sub => (
            <section key={sub}>
              <h2 style={{ fontSize: 13, fontWeight: 800, color: '#111827', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '.04em' }}>{sub}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {bySubject[sub]
                  .slice()
                  .sort((a, b) => (a.week_number ?? 0) - (b.week_number ?? 0))
                  .map(p => {
                    const st = statusStyle(p.status);
                    return (
                      <div key={p.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
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
                    );
                  })}
              </div>
            </section>
          ))}

        </div>
      )}
    </Layout>
  );
}
