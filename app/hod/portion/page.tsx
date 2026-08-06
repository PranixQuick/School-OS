'use client';
// app/hod/portion/page.tsx
// HOD — Portion Covered. HOD assigns topics to teachers and tracks coverage.
// Read: /api/hod/syllabus (GET) · Assign: POST · Update status: PATCH
// Picker options come from /api/hod/roster (class–subject–teacher combos in scope).

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
  staff?: { name?: string } | null;
}

interface Combo {
  key: string;
  staff_id: string; subject_id: string; class_id: string;
  label: string;
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

export default function HodPortionPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formMsg, setFormMsg] = useState('');
  const [form, setForm] = useState({ combo: '', week_number: '', topic_name: '', chapter_ref: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [pRes, rRes] = await Promise.allSettled([
        fetch('/api/hod/syllabus').then(r => r.ok ? r.json() : Promise.reject(new Error('Could not load portion data. If you were just given HOD access, sign out and back in.'))),
        fetch('/api/hod/roster').then(r => r.ok ? r.json() : { roster: [] }),
      ]);
      if (pRes.status === 'fulfilled') setPlans(pRes.value.syllabus ?? []);
      else setError((pRes.reason as Error).message);
      if (rRes.status === 'fulfilled') {
        const seen = new Map<string, Combo>();
        for (const row of (rRes.value.roster ?? []) as any[]) {
          if (!row.staff_id || !row.subject_id || !row.class_id) continue;
          const key = `${row.class_id}|${row.subject_id}|${row.staff_id}`;
          if (seen.has(key)) continue;
          const cls = row.classes ? `Class ${row.classes.grade_level ?? ''}${row.classes.section ? '-' + row.classes.section : ''}` : 'Class';
          const subj = row.subjects?.name ?? 'Subject';
          const who = row.staff?.name ?? 'Teacher';
          seen.set(key, { key, staff_id: row.staff_id, subject_id: row.subject_id, class_id: row.class_id, label: `${cls} · ${subj} · ${who}` });
        }
        setCombos([...seen.values()].sort((a, b) => a.label.localeCompare(b.label)));
      }
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const assign = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg('');
    const combo = combos.find(c => c.key === form.combo);
    if (!combo) { setFormMsg('Pick a class · subject · teacher.'); return; }
    if (!form.week_number || !form.topic_name) { setFormMsg('Week and topic are required.'); return; }
    setSaving(true);
    try {
      const r = await fetch('/api/hod/syllabus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: combo.staff_id, subject_id: combo.subject_id, class_id: combo.class_id,
          week_number: Number(form.week_number), topic_name: form.topic_name, chapter_ref: form.chapter_ref || null,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Could not assign the topic.');
      setForm({ combo: '', week_number: '', topic_name: '', chapter_ref: '' });
      setShowForm(false);
      await load();
    } catch (err: any) {
      setFormMsg(err.message ?? 'Could not assign the topic.');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (id: string, status: string) => {
    // optimistic
    setPlans(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    try {
      await fetch('/api/hod/syllabus', {
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
    <Layout title="Portion Covered" subtitle="Assign topics to teachers and track coverage">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button
          onClick={() => { setShowForm(s => !s); setFormMsg(''); }}
          disabled={combos.length === 0}
          style={{ background: combos.length === 0 ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: combos.length === 0 ? 'not-allowed' : 'pointer' }}
        >
          {showForm ? 'Close' : '+ Assign a topic'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={assign} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: 4 }}>Class · Subject · Teacher</label>
            <select value={form.combo} onChange={e => setForm({ ...form, combo: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, background: '#fff', boxSizing: 'border-box' }}>
              <option value="">Select…</option>
              {combos.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: 4 }}>Week</label>
              <input type="number" min={1} max={52} value={form.week_number} onChange={e => setForm({ ...form, week_number: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: 4 }}>Topic</label>
              <input type="text" value={form.topic_name} onChange={e => setForm({ ...form, topic_name: e.target.value })} placeholder="e.g. Trigonometry — Identities" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: 4 }}>Chapter (optional)</label>
            <input type="text" value={form.chapter_ref} onChange={e => setForm({ ...form, chapter_ref: e.target.value })} placeholder="e.g. Ch. 8" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, boxSizing: 'border-box' }} />
          </div>
          {formMsg && <div style={{ fontSize: 12, color: '#B91C1C', fontWeight: 600 }}>{formMsg}</div>}
          <button type="submit" disabled={saving} style={{ background: saving ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, padding: '11px', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Assigning…' : 'Assign topic'}
          </button>
        </form>
      )}

      {loading ? (
        <div style={{ padding: 28, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 16, background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', borderRadius: 12, fontSize: 13, fontWeight: 600 }}>{error}</div>
      ) : total === 0 ? (
        <div style={{ padding: 20, background: '#F9FAFB', border: '1px dashed #E5E7EB', borderRadius: 12, color: '#6B7280', fontSize: 13 }}>No topics assigned yet. Use “+ Assign a topic” to add the first one.</div>
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
                            {p.staff?.name ? `${p.chapter_ref ? ' · ' : ''}${p.staff.name}` : ''}
                            {p.classes ? ` · Class ${p.classes.grade_level ?? ''}${p.classes.section ? '-' + p.classes.section : ''}` : ''}
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
    </Layout>
  );
}
