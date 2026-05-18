'use client';
import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface Broadcast {
  id: string; subject: string; message: string;
  sent_at: string; recipient_count?: number; channel?: string;
}

export default function BroadcastsPage() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const loadBroadcasts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/broadcast');
      if (res.ok) { const d = await res.json(); setBroadcasts(d.broadcasts ?? []); }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadBroadcasts(); }, [loadBroadcasts]);

  async function sendBroadcast() {
    if (!subject.trim() || !message.trim()) { setError('Subject and message are required.'); return; }
    setSending(true); setError('');
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject.trim(), message: message.trim() }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Failed to send'); }
      else { setSubject(''); setMessage(''); setSent(true); setTimeout(() => setSent(false), 3000); await loadBroadcasts(); }
    } catch { setError('Network error — please try again'); }
    setSending(false);
  }

  return (
    <Layout title="Broadcasts" subtitle="Send announcements to all parents via WhatsApp">
      {/* Compose */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: '#111827' }}>
          📢 New Announcement
        </div>
        {sent && (
          <div style={{ background: '#DCFCE7', border: '1px solid #BBF7D0', borderRadius: 8,
            padding: '8px 12px', marginBottom: 10, fontSize: 13, color: '#15803D', fontWeight: 600 }}>
            ✓ Announcement sent successfully
          </div>
        )}
        {error && (
          <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8,
            padding: '8px 12px', marginBottom: 10, fontSize: 13, color: '#B91C1C' }}>
            {error}
          </div>
        )}
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
            SUBJECT
          </label>
          <input value={subject} onChange={e => setSubject(e.target.value)}
            placeholder="e.g. PTM on Saturday, School Holiday Notice…"
            className="input" style={{ width: '100%', height: 36, fontSize: 13, boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
            MESSAGE
          </label>
          <textarea value={message} onChange={e => setMessage(e.target.value)}
            placeholder="Dear Parents, this is to inform you that…"
            rows={4}
            style={{ width: '100%', borderRadius: 8, border: '1px solid #D1D5DB', padding: '8px 12px',
              fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
              outline: 'none', color: '#111827', background: '#F9FAFB' }} />
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4, textAlign: 'right' }}>
            {message.length} characters · {Math.ceil(message.length / 160)} SMS part{Math.ceil(message.length / 160) !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={sendBroadcast} disabled={sending || !subject.trim() || !message.trim()}
            className="btn btn-primary"
            style={{ opacity: (sending || !subject.trim() || !message.trim()) ? 0.6 : 1, minWidth: 120 }}>
            {sending ? 'Sending…' : '📤 Send to All Parents'}
          </button>
        </div>
      </div>

      {/* History */}
      <div className="section-header" style={{ marginBottom: 12 }}>
        <div className="section-title">Broadcast History</div>
      </div>
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
      ) : broadcasts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📢</div>
          <div className="empty-state-title">No broadcasts yet</div>
          <div className="empty-state-sub">Your sent announcements will appear here.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {broadcasts.map((b, i) => (
            <div key={b.id} style={{
              padding: '12px 16px', borderBottom: i < broadcasts.length-1 ? '1px solid #F3F4F6' : 'none'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{b.subject}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>
                  {new Date(b.sent_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
              <div style={{ fontSize: 13, color: '#4B5563', marginTop: 4, lineHeight: 1.5 }}>
                {b.message.length > 120 ? b.message.slice(0, 120) + '…' : b.message}
              </div>
              {b.recipient_count != null && (
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                  Sent to {b.recipient_count} parent{b.recipient_count !== 1 ? 's' : ''}
                  {b.channel ? ` via ${b.channel}` : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
