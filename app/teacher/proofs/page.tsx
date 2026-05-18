'use client';

import { useState, useEffect, useRef } from 'react';

interface Proof {
  id: string; title: string; class: string; section: string; subject: string;
  proof_type: string; note: string | null; image_url: string | null; created_at: string;
}

export default function ProofsPage() {
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', class: '', section: 'A', subject: '', proof_type: 'classroom_activity', note: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/teacher/proofs')
      .then(r => r.ok ? r.json() : { proofs: [] })
      .then(d => setProofs(d.proofs ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!form.title || !form.class || !form.subject) { setMsg('Title, class and subject are required.'); return; }
    setSaving(true); setMsg('');
    const res = await fetch('/api/teacher/proofs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (res.ok) {
      setProofs(prev => [data.proof, ...prev]);
      setShowForm(false);
      setForm({ title: '', class: '', section: 'A', subject: '', proof_type: 'classroom_activity', note: '' });
    } else { setMsg(data.error ?? 'Failed to save.'); }
    setSaving(false);
  };

  const typeLabel = (t: string) => ({ classroom_activity: 'Activity', homework_check: 'Homework', assessment: 'Assessment', other: 'Other' })[t] ?? t;
  const typeColor = (t: string) => ({ classroom_activity: '#4F46E5', homework_check: '#D97706', assessment: '#16A34A', other: '#6B7280' })[t] ?? '#6B7280';

  return (
    <div style={{ padding: 16 }}>
      <style>{`
        .pr-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
        .pr-title { font-size: 18px; font-weight: 800; color: #111827; }
        .pr-sub { font-size: 13px; color: #6B7280; margin-bottom: 16px; }
        .pr-btn { padding: 9px 16px; border-radius: 10px; border: none; background: #4F46E5; color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; }
        .pr-form { background: #fff; border-radius: 14px; border: 1px solid #E5E7EB; padding: 16px; margin-bottom: 16px; }
        .pr-row { margin-bottom: 12px; }
        .pr-label { font-size: 11px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .pr-input { width: 100%; height: 40px; border-radius: 9px; border: 1px solid #D1D5DB; background: #F9FAFB; font-size: 14px; padding: 0 12px; box-sizing: border-box; outline: none; font-family: inherit; }
        .pr-select { width: 100%; height: 40px; border-radius: 9px; border: 1px solid #D1D5DB; background: #F9FAFB; font-size: 14px; padding: 0 12px; box-sizing: border-box; outline: none; font-family: inherit; }
        .pr-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .pr-card { background: #fff; border-radius: 14px; border: 1px solid #E5E7EB; padding: 14px; margin-bottom: 10px; }
        .pr-card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
        .pr-card-title { font-size: 14px; font-weight: 700; color: #111827; flex: 1; }
        .pr-badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 99px; background: #F3F4F6; }
        .pr-meta { font-size: 12px; color: #6B7280; }
        .pr-empty { text-align: center; padding: 48px 20px; color: #9CA3AF; }
        .pr-err { background: #FEF2F2; border-radius: 8px; padding: 10px 12px; font-size: 12px; color: #B91C1C; margin-bottom: 10px; }
        .skel { background: #F3F4F6; border-radius: 8px; animation: pulse 1.5s ease-in-out infinite; margin-bottom: 10px; }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.5} }
      `}</style>

      <div className="pr-header">
        <div className="pr-title">Proofs</div>
        <button className="pr-btn" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Add Proof'}</button>
      </div>
      <div className="pr-sub">Capture classroom activity evidence.</div>

      {showForm && (
        <div className="pr-form">
          {msg && <div className="pr-err">{msg}</div>}
          <div className="pr-row"><div className="pr-label">Title</div><input className="pr-input" placeholder="e.g. Group activity — fractions" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
          <div className="pr-grid2">
            <div className="pr-row"><div className="pr-label">Class</div><input className="pr-input" placeholder="5" value={form.class} onChange={e => setForm(f => ({ ...f, class: e.target.value }))} /></div>
            <div className="pr-row"><div className="pr-label">Section</div><input className="pr-input" placeholder="A" value={form.section} onChange={e => setForm(f => ({ ...f, section: e.target.value }))} /></div>
          </div>
          <div className="pr-row"><div className="pr-label">Subject</div><input className="pr-input" placeholder="e.g. Mathematics" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} /></div>
          <div className="pr-row">
            <div className="pr-label">Type</div>
            <select className="pr-select" value={form.proof_type} onChange={e => setForm(f => ({ ...f, proof_type: e.target.value }))}>
              <option value="classroom_activity">Classroom Activity</option>
              <option value="homework_check">Homework Check</option>
              <option value="assessment">Assessment</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="pr-row"><div className="pr-label">Note (optional)</div><input className="pr-input" placeholder="Any notes…" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} /></div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="pr-btn" style={{ flex: 1, background: '#F9FAFB', color: '#374151', border: '1px solid #E5E7EB' }} onClick={() => fileRef.current?.click()}>📷 Photo (optional)</button>
            <button className="pr-btn" style={{ flex: 1 }} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      )}

      {loading ? (
        <><div className="skel" style={{ height: 72 }} /><div className="skel" style={{ height: 72 }} /></>
      ) : proofs.length === 0 ? (
        <div className="pr-empty">
          <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
          <div style={{ fontWeight: 700, color: '#374151', marginBottom: 4 }}>No proofs yet</div>
          <div>Tap &quot;+ Add Proof&quot; to capture classroom evidence.</div>
        </div>
      ) : proofs.map(p => (
        <div key={p.id} className="pr-card">
          <div className="pr-card-top">
            <div className="pr-card-title">{p.title}</div>
            <span className="pr-badge" style={{ color: typeColor(p.proof_type) }}>{typeLabel(p.proof_type)}</span>
          </div>
          <div className="pr-meta">Class {p.class}{p.section} · {p.subject} · {new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
          {p.note && <div style={{ fontSize: 12, color: '#374151', marginTop: 6 }}>{p.note}</div>}
        </div>
      ))}
    </div>
  );
}
