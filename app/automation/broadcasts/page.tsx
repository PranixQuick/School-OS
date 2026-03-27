'use client';

import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';

interface Broadcast {
  id: string; type: string; title: string; message: string;
  target_classes: string[]; target_count: number; sent_count: number;
  status: string; sent_at: string | null; created_at: string;
}

const CLASSES = ['1','2','3','4','5','6','7','8','9','10'];
const BROADCAST_TYPES = [
  { value: 'fee_reminder', label: 'Fee Reminder', icon: '💳' },
  { value: 'homework', label: 'Homework Update', icon: '📚' },
  { value: 'event', label: 'Event Notice', icon: '📅' },
  { value: 'general', label: 'General Message', icon: '📢' },
];

const TYPE_BADGE: Record<string, string> = {
  fee_reminder: 'badge-low', homework: 'badge-indigo',
  event: 'badge-medium', general: 'badge-gray',
};

export default function BroadcastsPage() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState('fee_reminder');
  const [title, setTitle] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [homework, setHomework] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedClasses, setSelectedClasses] = useState<string[]>(['5', '6']);
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<Broadcast | null>(null);

  useEffect(() => { fetchBroadcasts(); }, []);

  async function fetchBroadcasts() {
    const res = await fetch('/api/broadcasts/list');
    const d = await res.json() as { broadcasts: Broadcast[] };
    setBroadcasts(d.broadcasts ?? []);
  }

  function toggleClass(cls: string) {
    setSelectedClasses(prev => prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/broadcasts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type, title, target_classes: selectedClasses,
          custom_message: customMessage || undefined,
          subject: subject || undefined,
          homework: homework || undefined,
          due_date: dueDate || undefined,
        }),
      });
      const d = await res.json() as { broadcast: Broadcast };
      setLastResult(d.broadcast);
      setShowForm(false);
      setTitle(''); setCustomMessage(''); setSubject(''); setHomework(''); setDueDate('');
      fetchBroadcasts();
    } finally { setSubmitting(false); }
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <Layout
      title="Broadcasts"
      subtitle="WhatsApp message broadcasts to parents"
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/automation" className="btn btn-ghost btn-sm">← Automation</Link>
          <button onClick={() => setShowForm(!showForm)} className="btn btn-primary btn-sm">
            + New Broadcast
          </button>
        </div>
      }
    >
      {lastResult && (
        <div className="alert alert-success" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <strong>✓ Broadcast sent to {lastResult.target_count} parents</strong>
            <div style={{ fontSize: 13, marginTop: 4, color: '#374151' }}>{lastResult.message.slice(0, 120)}...</div>
          </div>
          <button onClick={() => setLastResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: 18 }}>×</button>
        </div>
      )}

      {showForm && (
        <div className="card" style={{ marginBottom: 20, border: '1.5px solid #4F46E5' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 18 }}>New Broadcast</div>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label className="label">BROADCAST TYPE</label>
                <select className="input" value={type} onChange={e => setType(e.target.value)}>
                  {BROADCAST_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">TITLE</label>
                <input required className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Term 2 Fee Reminder" />
              </div>
            </div>

            {type === 'homework' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div><label className="label">SUBJECT</label><input className="input" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Mathematics" /></div>
                <div><label className="label">HOMEWORK</label><input className="input" value={homework} onChange={e => setHomework(e.target.value)} placeholder="Ex 4.2, Q1-10" /></div>
                <div><label className="label">DUE DATE</label><input type="date" className="input" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label className="label">CUSTOM MESSAGE (optional — AI generates if blank)</label>
              <textarea className="input" style={{ height: 80, resize: 'vertical', paddingTop: 10 }}
                value={customMessage} onChange={e => setCustomMessage(e.target.value)}
                placeholder="Leave blank for AI-generated message..." />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label className="label">TARGET CLASSES</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {CLASSES.map(cls => (
                  <button key={cls} type="button" onClick={() => toggleClass(cls)}
                    style={{ height: 32, width: 44, borderRadius: 8, border: `1px solid ${selectedClasses.includes(cls) ? '#4F46E5' : '#D1D5DB'}`, background: selectedClasses.includes(cls) ? '#EEF2FF' : '#fff', color: selectedClasses.includes(cls) ? '#4F46E5' : '#6B7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {cls}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" disabled={submitting || !title || selectedClasses.length === 0} className="btn btn-primary">
                {submitting ? 'Sending...' : '📨 Send Broadcast'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn btn-ghost">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {broadcasts.length === 0 && (
          <div className="card"><div className="empty-state"><div className="empty-state-icon">📢</div><div className="empty-state-title">No broadcasts yet</div><div className="empty-state-sub">Create your first broadcast above.</div></div></div>
        )}
        {broadcasts.map(b => (
          <div key={b.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>{BROADCAST_TYPES.find(t => t.value === b.type)?.icon ?? '📢'}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{b.title}</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF' }}>{b.sent_at ? formatDate(b.sent_at) : formatDate(b.created_at)} · Classes: {b.target_classes.join(', ')}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className={`badge ${TYPE_BADGE[b.type] ?? 'badge-gray'}`}>{b.type.replace('_', ' ').toUpperCase()}</span>
                <span className="badge badge-done">✓ {b.sent_count} sent</span>
              </div>
            </div>
            <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
              {b.message}
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
