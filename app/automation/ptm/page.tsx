'use client';

import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';

interface PTMSession { id: string; title: string; date: string; start_time: string; end_time: string; target_classes: string[]; slot_duration_minutes: number; status: string; }
interface PTMSlot { id: string; session_id: string; slot_time: string; status: string; parent_confirmed: boolean; staff: { name: string } | null; students: { name: string; parent_name: string } | null; }

const STATUS_BADGE: Record<string, string> = { available: 'badge-gray', booked: 'badge-indigo', completed: 'badge-done', missed: 'badge-low' };

export default function PTMPage() {
  // PR-3: institution-type gating — PTM not applicable for coaching + some colleges
  const [instType, setInstType] = useState<string>('school_k10');
  const [instLoading, setInstLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/institution-config')
      .then(r => r.ok ? r.json() : null)
      .then((d: { institution_type?: string } | null) => {
        if (d?.institution_type) setInstType(d.institution_type);
      })
      .catch(() => {})
      .finally(() => setInstLoading(false));
  }, []);

  const [sessions, setSessions] = useState<PTMSession[]>([]);
  const [slots, setSlots] = useState<PTMSlot[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedSession, setSelectedSession] = useState<PTMSession | null>(null);
  const [form, setForm] = useState({ title: 'Term 1 Parent-Teacher Meeting', date: '', start_time: '09:00', end_time: '13:00', target_classes: ['5', '6'], slot_duration_minutes: 10 });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    const res = await fetch('/api/ptm');
    const d = await res.json() as { sessions: PTMSession[]; slots: PTMSlot[] };
    setSessions(d.sessions ?? []);
    setSlots(d.slots ?? []);
    if (d.sessions?.length) setSelectedSession(d.sessions[0]);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await fetch('/api/ptm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setShowForm(false); setSubmitting(false); fetchData();
  }

  async function updateSlot(slotId: string, status: string) {
    await fetch('/api/ptm', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slotId, status }) });
    fetchData();
  }

  // PR-3: early-return for institution types where PTM doesn't apply
  if (!instLoading && (instType === 'coaching' || ['degree_college','engineering','mba'].includes(instType))) {
    return (
      <Layout title="PTM Automation" subtitle="Parent-Teacher Meeting management">
        <div style={{ padding: 32, color: '#6B7280', textAlign: 'center', background: '#F9FAFB', borderRadius: 10 }}>
          PTM is not applicable for this institution type.
        </div>
      </Layout>
    );
  }

  const sessionSlots = slots.filter(s => s.session_id === selectedSession?.id);
  const booked = sessionSlots.filter(s => s.status === 'booked').length;
  const available = sessionSlots.filter(s => s.status === 'available').length;

  return (
    <Layout title="PTM Scheduler" subtitle="Parent-Teacher Meeting management"
      actions={<div style={{ display: 'flex', gap: 8 }}><Link href="/automation" className="btn btn-ghost btn-sm">← Automation</Link><button onClick={() => setShowForm(true)} className="btn btn-primary btn-sm">+ New PTM</button></div>}
    >
      {showForm && (
        <div className="card" style={{ marginBottom: 20, border: '1.5px solid #6D28D9' }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Schedule New PTM</div>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div style={{ gridColumn: 'span 2' }}><label className="label">TITLE</label><input required className="input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
              <div><label className="label">DATE</label><input required type="date" className="input" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div><label className="label">START TIME</label><input type="time" className="input" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} /></div>
              <div><label className="label">END TIME</label><input type="time" className="input" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} /></div>
              <div><label className="label">SLOT DURATION (mins)</label><input type="number" className="input" value={form.slot_duration_minutes} onChange={e => setForm(p => ({ ...p, slot_duration_minutes: parseInt(e.target.value) }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" disabled={submitting} className="btn btn-primary">{submitting ? 'Creating...' : 'Create PTM Session'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn btn-ghost">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16 }}>
        {/* Session list */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', marginBottom: 8 }}>SESSIONS</div>
          {sessions.length === 0 && <div className="card-sm" style={{ color: '#9CA3AF', fontSize: 13 }}>No PTM sessions yet.</div>}
          {sessions.map(s => (
            <button key={s.id} onClick={() => setSelectedSession(s)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: `1px solid ${selectedSession?.id === s.id ? '#6D28D9' : '#E5E7EB'}`, background: selectedSession?.id === s.id ? '#F5F3FF' : '#fff', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: selectedSession?.id === s.id ? '#6D28D9' : '#111827' }}>{s.title}</div>
              <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 3 }}>{new Date(s.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{s.start_time} – {s.end_time}</div>
              <span className={`badge ${s.status === 'scheduled' ? 'badge-indigo' : s.status === 'completed' ? 'badge-done' : 'badge-gray'}`} style={{ marginTop: 6, display: 'inline-block', fontSize: 10 }}>{s.status.toUpperCase()}</span>
            </button>
          ))}
        </div>

        {/* Slots */}
        <div>
          {!selectedSession ? (
            <div className="card"><div className="empty-state"><div className="empty-state-icon">🗓</div><div className="empty-state-title">Select a session</div></div></div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                {[{ label: 'Total Slots', value: sessionSlots.length, color: '#4F46E5' }, { label: 'Booked', value: booked, color: '#6D28D9' }, { label: 'Available', value: available, color: '#15803D' }].map(k => (
                  <div key={k.label} className="card-sm">
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', marginBottom: 4 }}>{k.label}</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: k.color }}>{k.value}</div>
                  </div>
                ))}
              </div>

              {sessionSlots.length === 0 ? (
                <div className="card"><div className="empty-state"><div className="empty-state-icon">📋</div><div className="empty-state-title">No slots generated</div><div className="empty-state-sub">Slots are auto-created when the PTM is scheduled.</div></div></div>
              ) : (
                <div className="table-wrapper">
                  <table className="table">
                    <thead><tr><th>Time</th><th>Teacher</th><th>Student</th><th>Parent</th><th>Confirmed</th><th>Status</th><th>Action</th></tr></thead>
                    <tbody>
                      {sessionSlots.map(slot => (
                        <tr key={slot.id}>
                          <td style={{ fontWeight: 600 }}>{slot.slot_time}</td>
                          <td>{slot.staff?.name ?? '—'}</td>
                          <td>{slot.students?.name ?? '—'}</td>
                          <td>{slot.students?.parent_name ?? '—'}</td>
                          <td>{slot.parent_confirmed ? <span className="badge badge-done">✓ Yes</span> : <span className="badge badge-gray">Pending</span>}</td>
                          <td><span className={`badge ${STATUS_BADGE[slot.status] ?? 'badge-gray'}`}>{slot.status.toUpperCase()}</span></td>
                          <td>
                            <select value={slot.status} onChange={e => updateSlot(slot.id, e.target.value)}
                              style={{ height: 28, borderRadius: 6, border: '1px solid #D1D5DB', background: '#F9FAFB', fontSize: 12, padding: '0 6px', fontFamily: 'inherit' }}>
                              {['available','booked','completed','missed'].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
