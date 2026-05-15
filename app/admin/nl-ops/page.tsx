'use client';
// app/admin/nl-ops/page.tsx
// H3: Natural language school operations page
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

interface Conversation { id: string; command: string; result: string; created_at: string; }

export default function NLOpsPage() {
  const [command, setCommand] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Conversation[]>([]);

  useEffect(() => {
    fetch('/api/admin/nl-ops')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.conversations) setHistory(d.conversations); })
      .catch(() => {});
  }, []);

  async function run() {
    if (!command.trim()) return;
    setLoading(true); setResult(null);
    const res = await fetch('/api/admin/nl-ops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    });
    const d = await res.json() as { result?: string; action_taken?: string; error?: string };
    const txt = d.result ?? d.action_taken ?? d.error ?? 'Done';
    setResult(txt);
    setHistory(prev => [{ id: Date.now().toString(), command, result: txt, created_at: new Date().toISOString() }, ...prev].slice(0, 20));
    setCommand('');
    setLoading(false);
  }

  return (
    <Layout title='NL Ops' subtitle='Run school operations in plain English'>
      <div style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            value={command}
            onChange={e => setCommand(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && run()}
            placeholder='e.g. Show attendance for Class 5A today'
            style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
          />
          <button
            onClick={run}
            disabled={loading || !command.trim()}
            style={{ padding: '9px 18px', background: loading ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit' }}
          >
            {loading ? '...' : 'Run'}
          </button>
        </div>

        {result && (
          <div style={{ padding: 12, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
            {result}
          </div>
        )}

        {history.length > 0 && (
          <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', marginBottom: 8 }}>HISTORY</div>
            {history.map(h => (
              <div key={h.id} style={{ padding: '10px 12px', borderBottom: '1px solid #F3F4F6', fontSize: 12 }}>
                <div style={{ fontWeight: 600, color: '#374151' }}>{h.command}</div>
                <div style={{ color: '#6B7280', marginTop: 2, lineHeight: 1.4 }}>{h.result}</div>
              </div>
            ))}
          </div>
        )}

        {history.length === 0 && !result && (
          <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, padding: 32 }}>
            No commands run yet. Try: &ldquo;How many students attended Class 5A today?&rdquo;
          </div>
        )}
      </div>
    </Layout>
  );
}
