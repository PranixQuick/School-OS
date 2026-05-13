'use client';
// PATH: app/admin/broadcasts/page.tsx
// Batch 1 — Broadcasts UI.
// Send a broadcast to all active parents (via existing POST /api/admin/broadcast).
// View recent broadcast history (via new GET /api/admin/broadcast).
// Auth guard: middleware session (role check client-side).

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

interface BroadcastRow {
  id: string; title: string; message: string; status: string; created_at: string; attempts: number;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  sent:     { bg: '#D1FAE5', fg: '#065F46' },
  pending:  { bg: '#FEF3C7', fg: '#92400E' },
  failed:   { bg: '#FEE2E2', fg: '#991B1B' },
  skipped:  { bg: '#F3F4F6', fg: '#6B7280' },
};

export default function BroadcastsPage() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [history, setHistory] = useState<BroadcastRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => { void loadHistory(); }, []);

  async function loadHistory() {
    setLoadingHistory(true);
    const res = await fetch('/api/admin/broadcast');
    if (res.ok) { const d = await res.json(); setHistory(d.broadcasts ?? []); }
    setLoadingHistory(false);
  }

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3500);
  }

  async function sendBroadcast() {
    if (!subject.trim() || !message.trim()) return;
    if (subject.length > 200) { showToast('Subject must be 200 characters or fewer', false); return; }
    if (message.length > 4000) { showToast('Message must be 4000 characters or fewer', false); return; }
    setSending(true);
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject.trim(), message: message.trim() }),
      });
      const d = await res.json();
      if (res.ok) {
        showToast('Broadcast sent. Will be delivered to all active parents.');
        setSubject(''); setMessage('');
        void loadHistory();
      } else {
        showToast(d.error ?? d.message ?? 'Failed to send broadcast', false);
      }
    } finally { setSending(false); }
  }

  const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: 13, boxSizing: 'border-box' as const };
  const cardStyle = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 20, marginBottom: 16 };

  return (
    <Layout title="Broadcasts" subtitle="Send messages to all active parents">

      {toast && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, padding: '10px 18px',
          background: toast.ok ? '#065F46' : '#991B1B', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          {toast.msg}
        </div>
      )}

      {/* Compose form */}
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>New Broadcast</div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 4, display: 'block' }}>
            Subject * <span style={{ fontWeight: 400 }}>({subject.length}/200)</span>
          </label>
          <input style={inputStyle} value={subject} onChange={e => setSubject(e.target.value.slice(0, 200))}
            placeholder="e.g. School closed tomorrow — public holiday" />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 4, display: 'block' }}>
            Message * <span style={{ fontWeight: 400 }}>({message.length}/4000)</span>
          </label>
          <textarea style={{ ...inputStyle, height: 120, resize: 'vertical' }}
            value={message} onChange={e => setMessage(e.target.value.slice(0, 4000))}
            placeholder="Write your message here..." />
        </div>

        <button onClick={() => void sendBroadcast()}
          disabled={!subject.trim() || !message.trim() || sending}
          style={{ padding: '10px 24px', background: (!subject.trim() || !message.trim() || sending) ? '#9CA3AF' : '#4F46E5',
            color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          {sending ? 'Sending...' : '📣 Send Broadcast'}
        </button>

        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 10 }}>
          Broadcast will be queued for WhatsApp delivery to all active parents.
        </div>
      </div>

      {/* History */}
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Recent Broadcasts</div>
      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        {loadingHistory ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#6B7280', fontSize: 12 }}>Loading...</div>
        ) : history.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>No broadcasts sent yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  {['Subject','Message','Status','Date'].map(h => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#6B7280', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map(b => {
                  const badge = STATUS_COLORS[b.status] ?? { bg: '#F3F4F6', fg: '#374151' };
                  return (
                    <tr key={b.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '9px 14px', fontWeight: 600, maxWidth: 200 }}>{b.title}</td>
                      <td style={{ padding: '9px 14px', color: '#6B7280', maxWidth: 280 }}>
                        {b.message.length > 80 ? b.message.slice(0, 80) + '…' : b.message}
                      </td>
                      <td style={{ padding: '9px 14px' }}>
                        <span style={{ background: badge.bg, color: badge.fg, padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>
                          {b.status}
                        </span>
                      </td>
                      <td style={{ padding: '9px 14px', color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                        {new Date(b.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
