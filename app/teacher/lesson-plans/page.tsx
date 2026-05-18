'use client';

import { useState, useEffect } from 'react';

interface Plan {
  id: string; class: string; section: string; subject: string;
  topic: string; date: string; duration_mins: number;
  objectives: string; materials: string; status: string;
  created_at: string;
}

export default function LessonPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ class: '', section: 'A', subject: '', topic: '', date: '', duration_mins: 45, objectives: '', materials: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/teacher/lesson-plans')
      .then(r => r.ok ? r.json() : { plans: [] })
      .then(d => setPlans(d.plans ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!form.class || !form.subject || !form.topic || !form.date) { setMsg('Class, subject, topic and date are required.'); return; }
    setSaving(true); setMsg('');
    const res = await fetch('/api/teacher/lesson-plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await res.json();
    if (res.ok) {
      setPlans(prev => [data.plan, ...prev]);
      setShowForm(false);
      setForm({ class: '', section: 'A', subject: '', topic: '', date: '', duration_mins: 45, objectives: '', materials: '' });
    } else { setMsg(data.error ?? 'Failed to save.'); }
    setSaving(false);
  };

  const statusColor = (s: string) => ({ planned: '#6B7280', completed: '#16A34A', cancelled: '#B91C1C' })[s] ?? '#6B7280';

  return (
    <div style={{ padding: 16 }}>
      <style>{`
        .lp-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .lp-title { font-size: 18px; font-weight: 800; color: #111827; }
        .lp-btn { padding: 9px 16px; border-radius: 10px; border: none; background: #4F46E5; color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; }
        .lp-form { background: #fff; border-radius: 14px; border: 1px solid #E5E7EB; padding: 16px; margin-bottom: 16px; }
        .lp-row { margin-bottom: 12px; }
        .lp-label { font-size: 11px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .lp-input { width: 100%; height: 40px; border-radius: 9px; border: 1px solid #D1D5DB; background: #F9FAFB; font-size: 14px; padding: 0 12px; box-sizing: border-box; outline: none; font-family: inherit; }
        .lp-textarea { width: 100%; height: 72px; border-radius: 9px; border: 1px solid #D1D5DB; background: #F9FAFB; font-size: 14px; padding: 10px 12px; box-sizing: border-box; outline: none; font-family: inherit; resize: vertical; }
        .lp-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .lp-card { background: #fff; border-radius: 14px; border: 1px solid #E5E7EB; padding: 14px; margin-bottom: 10px; }
        .lp-card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
        .lp-card-topic { font-size: 14px; font-weight: 700; color: #111827; flex: 1; }
        .lp-badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 99px; background: #F3F4F6; }
        .lp-card-meta { font-size: 12px; color: #6B7280; }
        .lp-empty { text-align: center; padding: 48px 20px; color: #9CA3AF; }
        .lp-err { background: #FEF2F2; border-radius: 8px; padding: 10px 12px; font-size: 12px; color: #B91C1C; margin-bottom: 10px; }
        .skel { background: #F3F4F6; border-radius: 8px; animation: pulse 1.5s ease-in-out infinite; margin-bottom: 10px; }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.5} }
      `}</style>

      <div className="lp-header">
        <div className="lp-title">Lesson Plans</div>
        <button className="lp-btn" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ New Plan'}</button>
      </div>

      {showForm && (
        <div className="lp-form">
          {msg && <div className="lp-err">{msg}</div>}
          <div className="lp-grid2">
            <div className="lp-row"><div className="lp-label">Class</div><input className="lp-input" placeholder="e.g. 5" value={form.class} onChange={e => setForm(f => ({ ...f, class: e.target.value }))} /></div>
            <div className="lp-row"><div className="lp-label">Section</div><input className="lp-input" placeholder="A" value={form.section} onChange={e => setForm(f => ({ ...f, section: e.target.value }))} /></div>
          </div>
          <div className="lp-row"><div className="lp-label">Subject</div><input className="lp-input" placeholder="e.g. Mathematics" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} /></div>
          <div className="lp-row"><div className="lp-label">Topic</div><input className="lp-input" placeholder="e.g. Fractions and Decimals" value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} /></div>
          <div className="lp-grid2">
            <div className="lp-row"><div className="lp-label">Date</div><input type="date" className="lp-input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div className="lp-row"><div className="lp-label">Duration (min)</div><input type="number" className="lp-input" value={form.duration_mins} onChange={e => setForm(f => ({ ...f, duration_mins: Number(e.target.value) }))} /></div>
          </div>
          <div className="lp-row"><div className="lp-label">Learning Objectives</div><textarea className="lp-textarea" placeholder="Students will be able to…" value={form.objectives} onChange={e => setForm(f => ({ ...f, objectives: e.target.value }))} /></div>
          <div className="lp-row"><div className="lp-label">Materials Needed</div><input className="lp-input" placeholder="e.g. Textbook, charts, whiteboard" value={form.materials} onChange={e => setForm(f => ({ ...f, materials: e.target.value }))} /></div>
          <button className="lp-btn" style={{ width: '100%' }} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Plan'}</button>
        </div>
      )}

      {loading ? (
        <><div className="skel" style={{ height: 80 }} /><div className="skel" style={{ height: 80 }} /></>
      ) : plans.length === 0 ? (
        <div className="lp-empty">
          <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
          <div style={{ fontWeight: 700, color: '#374151', marginBottom: 4 }}>No lesson plans yet</div>
          <div>Tap &quot;+ New Plan&quot; to create your first plan.</div>
        </div>
      ) : plans.map(p => (
        <div key={p.id} className="lp-card">
          <div className="lp-card-top">
            <div className="lp-card-topic">{p.topic}</div>
            <span className="lp-badge" style={{ color: statusColor(p.status) }}>{p.status}</span>
          </div>
          <div className="lp-card-meta">
            Class {p.class}{p.section} · {p.subject} · {p.duration_mins} min · {new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </div>
          {p.objectives && <div style={{ fontSize: 12, color: '#374151', marginTop: 6, borderTop: '1px solid #F9FAFB', paddingTop: 6 }}>{p.objectives}</div>}
        </div>
      ))}
    </div>
  );
}
