'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

interface BotStatus { active: boolean; phone_number?: string; webhook_verified?: boolean; messages_sent_today?: number; total_messages?: number; }

export default function WhatsAppPage() {
  const [status, setStatus] = useState<BotStatus|null>(null);
  const [loading, setLoading] = useState(true);
  const [testPhone, setTestPhone] = useState('');
  const [testMsg, setTestMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    fetch('/api/whatsapp/status').then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setStatus(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function sendTest() {
    if (!testPhone || !testMsg) return;
    setSending(true);
    try {
      await fetch('/api/whatsapp/send', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testPhone, message: testMsg }) });
      setSent(true); setTimeout(() => setSent(false), 3000);
      setTestPhone(''); setTestMsg('');
    } catch { /* ignore */ }
    setSending(false);
  }

  return (
    <Layout title="WhatsApp Bot" subtitle="Parent communication assistant — 24/7 automated responses">
      {/* Status */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Bot Status</div>
          {loading ? <div style={{ fontSize: 12, color: '#9CA3AF' }}>Checking…</div> : (
            <span style={{ padding: '3px 10px', borderRadius: 7, fontSize: 12, fontWeight: 700,
              background: status?.active ? '#DCFCE7' : '#FEE2E2',
              color: status?.active ? '#15803D' : '#B91C1C' }}>
              {status?.active ? '● LIVE' : '● OFFLINE'}
            </span>
          )}
        </div>
        {status && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Phone', value: status.phone_number ?? 'Not configured' },
              { label: 'Webhook', value: status.webhook_verified ? 'Verified ✓' : 'Not verified' },
              { label: 'Today', value: `${status.messages_sent_today ?? 0} messages` },
              { label: 'Total', value: `${status.total_messages ?? 0} messages` },
            ].map(i => (
              <div key={i.label}>
                <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>{i.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginTop: 2 }}>{i.value}</div>
              </div>
            ))}
          </div>
        )}
        {!status && !loading && (
          <div style={{ fontSize: 13, color: '#6B7280' }}>
            WhatsApp bot is not yet configured. Contact support to set up your Twilio number.
          </div>
        )}
      </div>

      {/* Test message */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Send Test Message</div>
        {sent && <div style={{ background: '#DCFCE7', borderRadius: 8, padding: '8px 12px', marginBottom: 10,
          fontSize: 13, color: '#15803D', fontWeight: 600 }}>✓ Message sent</div>}
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>PHONE (with country code)</label>
          <input value={testPhone} onChange={e => setTestPhone(e.target.value)}
            placeholder="+919876543210" className="input" style={{ width: '100%', height: 36, fontSize: 13, boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>MESSAGE</label>
          <textarea value={testMsg} onChange={e => setTestMsg(e.target.value)}
            placeholder="Hi, this is a test message from EdProSys!" rows={3}
            style={{ width: '100%', borderRadius: 8, border: '1px solid #D1D5DB', padding: '8px 12px',
              fontSize: 13, fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box',
              outline: 'none', background: '#F9FAFB' }} />
        </div>
        <button onClick={sendTest} disabled={sending || !testPhone || !testMsg}
          className="btn btn-primary btn-sm"
          style={{ opacity: (sending || !testPhone || !testMsg) ? 0.6 : 1 }}>
          {sending ? 'Sending…' : 'Send Test'}
        </button>
      </div>

      {/* FAQ */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>What the bot answers automatically</div>
        {[
          { q: 'What is my child\'s attendance?', a: 'Returns attendance % for the current month' },
          { q: 'What are the upcoming events?', a: 'Lists next 3 school events and holidays' },
          { q: 'Are fees paid?', a: 'Checks fee status for the parent\'s student' },
          { q: 'Homework for today?', a: 'Lists homework assigned in the last 2 days' },
        ].map(item => (
          <div key={item.q} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #F3F4F6' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Q: {item.q}</div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>A: {item.a}</div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
