'use client';
// PATH: app/admin/ptm/page.tsx
// Batch 7 — PTM session management UI.
// Schema: ptm_sessions.date (actual column), status in scheduled/in_progress/completed/cancelled.

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

const STATUS_BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  scheduled:   { bg: '#DBEAFE', fg: '#1E40AF', label: 'Scheduled' },
  in_progress: { bg: '#D1FAE5', fg: '#065F46', label: 'In Progress' },
  completed:   { bg: '#F3F4F6', fg: '#374151', label: 'Completed' },
  cancelled:   { bg: '#FEE2E2', fg: '#991B1B', label: 'Cancelled' },
};

interface PTMSession {
  id: string; title: string; date: string;
  start_time: string; end_time: string;
  slot_duration_minutes: number; status: string;
  total_slots: number; confirmed_slots: number;
}

interface PTMSlot {
  id: string; slot_time: string; slot_date: string | null;
  status: string; parent_confirmed: boolean; notes: string | null;
  staff_name: string; student_name: string; student_roll: string | null;
}

export default function PTMPage() {
  const [sessions, setSessions] = useState<PTMSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedSession, setSelectedSession] = useState<PTMSession | null>(null);
  const [slots, setSlots] = useState<PTMSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [generatingSlots, setGeneratingSlots] = useState(false);
  const [filterConfirmed, setFilterConfirmed] = useState<'all' | 'yes' | 'no'>('all');

  // Form state
  const [form, setForm] = useState({ title: '', date: '', start_time: '09:00', end_time: '13:00', slot_duration_minutes: 10 });

  const loadSessions = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/admin/ptm');
    if (r.ok) { const d = await r.json(); setSessions(d.sessions ?? []); }
    setLoading(false);
  }, []);

  useEffect(() => { void loadSessions(); }, [loadSessions]);

  async function createSession() {
    setCreating(true);
    const r = await fetch('/api/admin/ptm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (r.ok) { setShowForm(false); setForm({ title: '', date: '', start_time: '09:00', end_time: '13:00', slot_duration_minutes: 10 }); await loadSessions(); }
    setCreating(false);
  }

  async function loadSlots(session: PTMSession) {
    setSelectedSession(session);
    setLoadingSlots(true);
    const r = await fetch(`/api/admin/ptm/${session.id}/slots`);
    if (r.ok) { const d = await r.json(); setSlots(d.slots ?? []); }
    setLoadingSlots(false);
  }

  async function generateSlots(sessionId: string) {
    setGeneratingSlots(true);
    const r = await fetch(`/api/admin/ptm/${sessionId}/generate-slots`, { method: 'POST' });
    if (r.ok) {
      await loadSessions();
      if (selectedSession?.id === sessionId) await loadSlots(selectedSession);
    }
    setGeneratingSlots(false);
  }

  async function updateSlot(slotId: string, updates: Record<string, unknown>) {
    if (!selectedSession) return;
    await fetch(`/api/admin/ptm/${selectedSession.id}/slots/${slotId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    await loadSlots(selectedSession);
  }

  const filteredSlots = slots.filter(s =>
    filterConfirmed === 'all' ? true :
    filterConfirmed === 'yes' ? s.parent_confirmed : !s.parent_confirmed
  );

  return (
    <Layout title="Parent-Teacher Meetings" subtitle="Schedule and manage PTM sessions">

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 12, color: '#6B7280' }}>{sessions.length} session{sessions.length !== 1 ? 's' : ''}</div>
        <button onClick={() => setShowForm(s => !s)}
          style={{ padding: '7px 16px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          {showForm ? '✕ Cancel' : '+ Create New Session'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>New PTM Session</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { label: 'Title', key: 'title', type: 'text', placeholder: 'e.g. Term 1 PTM' },
              { label: 'Date', key: 'date', type: 'date', placeholder: '' },
              { label: 'Start', key: 'start_time', type: 'time', placeholder: '' },
              { label: 'End', key: 'end_time', type: 'time', placeholder: '' },
            ].map(f => (
              <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#6B7280' }}>{f.label.toUpperCase()}</label>
                <input type={f.type} value={(form as Record<string, string | number>)[f.key] as string}
                  placeholder={f.placeholder}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={{ padding: '6px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, minWidth: f.key === 'title' ? 220 : 100 }} />
              </div>
            ))}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#6B7280' }}>SLOT (MIN)</label>
              <input type='number' value={form.slot_duration_minutes} min={5} max={60}
                onChange={e => setForm(prev => ({ ...prev, slot_duration_minutes: Number(e.target.value) }))}
                style={{ padding: '6px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, width: 70 }} />
            </div>
          </div>
          <button onClick={() => void createSession()} disabled={creating || !form.title || !form.date}
            style={{ marginTop: 12, padding: '7px 16px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: creating ? 0.7 : 1 }}>
            {creating ? 'Creating...' : 'Create Session'}
          </button>
        </div>
      )}

      {/* Sessions list */}
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>Loading...</div>
      ) : sessions.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>No PTM sessions yet. Create one above.</div>
      ) : (
        <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Title','Date','Time','Status','Slots','Actions'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => {
                const badge = STATUS_BADGE[s.status] ?? STATUS_BADGE.scheduled;
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid #F3F4F6', background: selectedSession?.id === s.id ? '#F0F9FF' : 'white' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{s.title}</td>
                    <td style={{ padding: '8px 12px', color: '#374151' }}>{new Date(s.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td style={{ padding: '8px 12px', color: '#6B7280' }}>{s.start_time.slice(0,5)}–{s.end_time.slice(0,5)}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ background: badge.bg, color: badge.fg, padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{badge.label}</span>
                    </td>
                    <td style={{ padding: '8px 12px', color: '#374151' }}>
                      <span style={{ color: s.confirmed_slots > 0 ? '#065F46' : '#9CA3AF', fontWeight: 600 }}>{s.confirmed_slots}</span>
                      <span style={{ color: '#9CA3AF' }}>/{s.total_slots}</span>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => void loadSlots(s)}
                          style={{ padding: '3px 9px', background: '#EEF2FF', color: '#4F46E5', border: 'none', borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                          View Slots
                        </button>
                        {s.total_slots === 0 && (
                          <button onClick={() => void generateSlots(s.id)} disabled={generatingSlots}
                            style={{ padding: '3px 9px', background: '#D1FAE5', color: '#065F46', border: 'none', borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                            {generatingSlots ? '...' : 'Generate'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Slot detail */}
      {selectedSession && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Slots — {selectedSession.title}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['all','yes','no'] as const).map(f => (
                <button key={f} onClick={() => setFilterConfirmed(f)}
                  style={{ padding: '3px 10px', borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: 'none',
                    background: filterConfirmed === f ? '#4F46E5' : '#F3F4F6',
                    color: filterConfirmed === f ? '#fff' : '#374151' }}>
                  {f === 'all' ? 'All' : f === 'yes' ? '✓ Confirmed' : 'Unconfirmed'}
                </button>
              ))}
            </div>
          </div>
          {loadingSlots ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>Loading slots...</div>
          ) : filteredSlots.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>
              {slots.length === 0 ? 'No slots generated yet.' : 'No slots match filter.'}
            </div>
          ) : (
            <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: '#F9FAFB' }}>
                    {['Time','Teacher','Student','Confirmed','Notes','Actions'].map(h => (
                      <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSlots.map(slot => (
                    <tr key={slot.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '6px 10px', fontWeight: 600 }}>{slot.slot_time.slice(0,5)}</td>
                      <td style={{ padding: '6px 10px' }}>{slot.staff_name}</td>
                      <td style={{ padding: '6px 10px' }}>{slot.student_name}</td>
                      <td style={{ padding: '6px 10px' }}>
                        {slot.parent_confirmed
                          ? <span style={{ color: '#065F46', fontWeight: 700 }}>✓ Yes</span>
                          : <span style={{ color: '#9CA3AF' }}>—</span>}
                      </td>
                      <td style={{ padding: '6px 10px', color: '#6B7280', maxWidth: 150 }}>{slot.notes ?? '—'}</td>
                      <td style={{ padding: '6px 10px' }}>
                        <button onClick={() => void updateSlot(slot.id, { status: 'completed' })}
                          style={{ padding: '2px 7px', background: '#F3F4F6', border: 'none', borderRadius: 3, fontSize: 9, cursor: 'pointer', color: '#374151' }}>
                          Mark Done
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
