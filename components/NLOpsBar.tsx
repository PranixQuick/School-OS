'use client';
// components/NLOpsBar.tsx
// Batch 5C — Natural Language Operations command bar.
// Embed at top of admin or principal page. Sends plain English instructions
// to /api/admin/nl-ops and shows the result inline.

import { useState, useEffect } from 'react';

interface NLResult {
  executed: string;
  recipients?: number;
  reminders_queued?: number;
  briefing_text?: string;
  flagged?: number;
  data?: Record<string, number | null>;
  message?: string;
  error?: string;
}

interface NLResponse {
  intent: string;
  preview: string | null;
  result: NLResult;
  instruction: string;
}

interface RecentCmd { id: string; message: string; intent: string; response: string; created_at: string; }

function ResultCard({ resp }: { resp: NLResponse }) {
  const { result, preview, intent } = resp;
  if (result.executed === 'unknown') return (
    <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400E' }}>
      ❓ {result.message}
    </div>
  );
  if (result.executed === 'error') return (
    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#B91C1C' }}>
      ❌ {result.error}
    </div>
  );

  const details: string[] = [];
  if (result.recipients !== undefined) details.push(`${result.recipients} parent${result.recipients !== 1 ? 's' : ''} notified`);
  if (result.reminders_queued !== undefined) details.push(`${result.reminders_queued} reminder${result.reminders_queued !== 1 ? 's' : ''} queued`);
  if (result.flagged !== undefined) details.push(`${result.flagged} student${result.flagged !== 1 ? 's' : ''} flagged`);
  if (result.briefing_text && typeof result.briefing_text === 'string') details.push('Briefing generated');

  return (
    <div style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ fontWeight: 700, color: '#065F46', marginBottom: details.length || result.data ? 6 : 0 }}>
        ✅ {preview ?? `${intent} executed`}
      </div>
      {details.length > 0 && <div style={{ color: '#047857' }}>{details.join(' · ')}</div>}
      {result.data && (
        <div style={{ display: 'flex', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
          {Object.entries(result.data).map(([k, v]) => (
            <span key={k} style={{ color: '#065F46' }}>
              <strong>{String(v ?? '—')}</strong> {k.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}
      {result.briefing_text && typeof result.briefing_text === 'string' && result.briefing_text !== 'Briefing generated.' && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#374151', whiteSpace: 'pre-wrap', maxHeight: 120, overflowY: 'auto', background: '#fff', borderRadius: 6, padding: '6px 10px' }}>
          {result.briefing_text.slice(0, 400)}{result.briefing_text.length > 400 ? '…' : ''}
        </div>
      )}
    </div>
  );
}

export function NLOpsBar() {
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<NLResponse | null>(null);
  const [recent, setRecent] = useState<RecentCmd[]>([]);

  useEffect(() => {
    // Load recent NL ops commands
    fetch('/api/admin/conversations?limit=5&intent_prefix=nl_ops')
      .then(r => r.ok ? r.json() : null)
      .then((d: { conversations?: RecentCmd[] } | null) => {
        if (d?.conversations) {
          setRecent(d.conversations.filter((c: RecentCmd) => c.intent && !c.intent.startsWith('admission')).slice(0, 5));
        }
      })
      .catch(() => {});
  }, []);

  async function execute() {
    if (!instruction.trim() || loading) return;
    setLoading(true);
    setLastResult(null);
    try {
      const res = await fetch('/api/admin/nl-ops', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction }),
      });
      const data = await res.json() as NLResponse;
      setLastResult(data);
      setInstruction('');
      // Prepend to recent
      setRecent(prev => [{
        id: Date.now().toString(), message: instruction,
        intent: data.intent, response: JSON.stringify(data.result), created_at: new Date().toISOString(),
      }, ...prev].slice(0, 5));
    } catch {
      setLastResult({ intent: 'error', preview: null, result: { executed: 'error', error: 'Network error' }, instruction });
    }
    setLoading(false);
  }

  return (
    <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#0369A1', marginBottom: 8, letterSpacing: 0.5 }}>
        🤖 NATURAL LANGUAGE OPERATIONS
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={instruction}
          onChange={e => setInstruction(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void execute(); }}
          placeholder='Tell EdProSys what to do… e.g. "Send PTM reminder to Class 5 parents"'
          style={{ flex: 1, padding: '8px 12px', border: '1px solid #BAE6FD', borderRadius: 7, fontSize: 13, background: '#fff', outline: 'none' }}
          disabled={loading}
        />
        <button onClick={() => void execute()} disabled={loading || !instruction.trim()}
          style={{ padding: '8px 18px', background: loading ? '#93C5FD' : '#0369A1', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', flexShrink: 0, transition: 'background 0.2s' }}>
          {loading ? '⏳' : 'Execute →'}
        </button>
      </div>

      {/* Result card */}
      {lastResult && (
        <div style={{ marginTop: 10 }}>
          <ResultCard resp={lastResult} />
        </div>
      )}

      {/* Suggestion chips */}
      {!lastResult && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {[
            'Show pending approvals',
            'Remind about overdue fees',
            "Today's summary",
            'Generate principal briefing',
          ].map(s => (
            <button key={s} onClick={() => setInstruction(s)}
              style={{ fontSize: 10, padding: '3px 9px', border: '1px solid #BAE6FD', borderRadius: 10, background: '#fff', color: '#0369A1', cursor: 'pointer', fontWeight: 600 }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Recent commands */}
      {recent.length > 0 && (
        <div style={{ marginTop: 10, borderTop: '1px solid #BAE6FD', paddingTop: 8 }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: '#9CA3AF', marginBottom: 4 }}>RECENT</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {recent.slice(0, 5).map(c => (
              <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 9, background: '#EEF2FF', color: '#4F46E5', padding: '1px 5px', borderRadius: 3, fontWeight: 700, flexShrink: 0 }}>
                  {c.intent.replace('_', ' ')}
                </span>
                <span style={{ fontSize: 11, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
