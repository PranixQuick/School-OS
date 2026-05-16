'use client';

// PATH: app/whatsapp/page.tsx
//
// WhatsApp Bot configuration page.
// Shows: setup instructions, conversation history, knowledge base management,
// opt-out list, and live test interface.

import { useState, useEffect, FormEvent } from 'react';
import Layout from '@/components/Layout';

interface Conversation {
  id: string;
  phone_number: string;
  intent: string;
  message: string;
  response: string | null;
  created_at: string;
}

interface KnowledgeChunk {
  id: string;
  title: string;
  category: string;
  content: string;
  source_doc: string | null;
  is_active: boolean;
}

const INTENT_LABEL: Record<string, { label: string; color: string }> = {
  attendance: { label: 'Attendance', color: '#4F46E5' },
  fees:       { label: 'Fees', color: '#B91C1C' },
  events:     { label: 'Events', color: '#065F46' },
  report:     { label: 'Report', color: '#A16207' },
  ptm:        { label: 'PTM', color: '#6D28D9' },
  transport:  { label: 'Transport', color: '#1D4ED8' },
  general:    { label: 'General', color: '#6B7280' },
  stop:       { label: 'Opt-out', color: '#9CA3AF' },
};

export default function WhatsAppPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeChunk[]>([]);
  const [convoLoading, setConvoLoading] = useState(true);
  const [kbLoading, setKbLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'setup' | 'conversations' | 'knowledge' | 'test'>('setup');

  // Knowledge base form
  const [kbForm, setKbForm] = useState({ title: '', category: 'general', content: '', source_doc: '' });
  const [kbSaving, setKbSaving] = useState(false);
  const [kbSaved, setKbSaved] = useState(false);

  // Test form
  const [testPhone, setTestPhone] = useState('+919876543210');
  const [testMessage, setTestMessage] = useState('What is my child\'s attendance?');
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => {
    fetchConversations();
    fetchKnowledge();
  }, []);

  async function fetchConversations() {
    setConvoLoading(true);
    try {
      const res = await fetch('/api/whatsapp/conversations');
      const d = await res.json() as { conversations?: Conversation[] };
      setConversations(d.conversations ?? []);
    } finally { setConvoLoading(false); }
  }

  async function fetchKnowledge() {
    setKbLoading(true);
    try {
      const res = await fetch('/api/whatsapp/knowledge');
      const d = await res.json() as { chunks?: KnowledgeChunk[] };
      setKnowledge(d.chunks ?? []);
    } finally { setKbLoading(false); }
  }

  async function handleSaveKnowledge(e: FormEvent) {
    e.preventDefault();
    setKbSaving(true); setKbSaved(false);
    await fetch('/api/whatsapp/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(kbForm),
    });
    setKbSaved(true);
    setKbForm({ title: '', category: 'general', content: '', source_doc: '' });
    fetchKnowledge();
    setKbSaving(false);
    setTimeout(() => setKbSaved(false), 3000);
  }

  async function toggleKnowledge(id: string, is_active: boolean) {
    await fetch('/api/whatsapp/knowledge', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !is_active }),
    });
    fetchKnowledge();
  }

  async function handleTest(e: FormEvent) {
    e.preventDefault();
    setTestLoading(true); setTestResult(null);
    try {
      const res = await fetch('/api/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone, message: testMessage }),
      });
      const d = await res.json() as Record<string, unknown>;
      setTestResult(d);
    } finally { setTestLoading(false); }
  }

  const inputStyle = { width: '100%', height: 40, borderRadius: 8, border: '1px solid #D1D5DB', background: '#F9FAFB', fontSize: 14, padding: '0 12px', outline: 'none', fontFamily: 'inherit', color: '#111827', boxSizing: 'border-box' as const };

  return (
    <Layout title="WhatsApp Bot" subtitle="AI-powered parent assistant — 24/7">

      {/* Status bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Bot Status', value: 'Active', icon: '🟢', color: '#15803D', bg: '#DCFCE7' },
          { label: 'Conversations', value: conversations.length, icon: '💬', color: '#4F46E5', bg: '#EEF2FF' },
          { label: 'Knowledge Chunks', value: knowledge.filter(k => k.is_active).length, icon: '📚', color: '#A16207', bg: '#FEF9C3' },
          { label: 'Provider', value: process.env.NEXT_PUBLIC_WA_PROVIDER ?? 'Stub', icon: '📡', color: '#6B7280', bg: '#F3F4F6' },
        ].map(k => (
          <div key={k.label} style={{ background: k.bg, borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', marginBottom: 6 }}>{k.label.toUpperCase()}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: k.color }}>{k.icon} {k.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs">
        {[
          { key: 'setup', label: 'Setup Guide' },
          { key: 'conversations', label: `Conversations (${conversations.length})` },
          { key: 'knowledge', label: `Knowledge Base (${knowledge.length})` },
          { key: 'test', label: 'Test Bot' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`tab-btn${activeTab === tab.key ? ' active' : ''}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Setup Guide */}
      {activeTab === 'setup' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>🔧 Connect Twilio WhatsApp</div>

            {[
              { step: '01', title: 'Get Twilio account', desc: 'Sign up at twilio.com. Enable WhatsApp Sandbox or apply for a dedicated number (takes ~1 week for business approval).' },
              { step: '02', title: 'Set environment variables', desc: 'Add to Vercel → Settings → Environment Variables:' },
              { step: '03', title: 'Set webhook URL', desc: 'In Twilio Console → Messaging → WhatsApp → Sandbox settings, set the webhook URL to:' },
              { step: '04', title: 'Activate Twilio in code', desc: 'In lib/whatsapp.ts, uncomment the sendViaTwilio function and change WHATSAPP_PROVIDER=twilio in env.' },
              { step: '05', title: 'Test with sandbox', desc: 'Send "join <sandbox-code>" from a WhatsApp number to your Twilio sandbox number to enable it.' },
            ].map(s => (
              <div key={s.step} style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#4F46E5', flexShrink: 0 }}>
                  {s.step}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 4 }}>{s.title}</div>
                  <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6 }}>
                    {s.desc}
                    {s.step === '02' && (
                      <div style={{ background: '#0F172A', borderRadius: 6, padding: '8px 10px', marginTop: 6, fontFamily: 'monospace', fontSize: 11, color: '#7DD3FC', lineHeight: 1.8 }}>
                        TWILIO_ACCOUNT_SID=ACxxxxxxxx<br />
                        TWILIO_AUTH_TOKEN=xxxxxxxx<br />
                        TWILIO_WHATSAPP_FROM=whatsapp:+14155238886<br />
                        WHATSAPP_PROVIDER=twilio
                      </div>
                    )}
                    {s.step === '03' && (
                      <div style={{ background: '#0F172A', borderRadius: 6, padding: '8px 10px', marginTop: 6, fontFamily: 'monospace', fontSize: 11, color: '#86EFAC' }}>
                        https://www.edprosys.com/api/whatsapp/webhook
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>💬 Supported Intents</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { intent: 'attendance', ex: '"Did my child come to school today?"' },
                  { intent: 'fees', ex: '"What fees are pending for my child?"' },
                  { intent: 'events', ex: '"When is the next PTM?"' },
                  { intent: 'report', ex: '"How is my child performing?"' },
                  { intent: 'transport', ex: '"What is the bus route?"' },
                  { intent: 'general', ex: '"What are school timings?"' },
                ].map(i => {
                  const meta = INTENT_LABEL[i.intent];
                  return (
                    <div key={i.intent} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', background: '#F9FAFB', borderRadius: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 10, background: '#EEF2FF', color: meta?.color ?? '#6B7280', whiteSpace: 'nowrap' }}>{meta?.label}</span>
                      <span style={{ fontSize: 12, color: '#6B7280', fontStyle: 'italic' }}>{i.ex}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>📱 Opt-out Handling</div>
              <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.7 }}>
                Parents who reply <strong>STOP</strong> are automatically opted out and won't receive any further messages. They can reply <strong>START</strong> to re-subscribe at any time. Opt-out status is stored in the <code style={{ background: '#F3F4F6', padding: '1px 5px', borderRadius: 4 }}>parents.whatsapp_opted_out</code> column.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Conversations */}
      {activeTab === 'conversations' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Conversation History</div>
            <button onClick={fetchConversations} className="btn btn-ghost btn-sm">↻ Refresh</button>
          </div>
          {convoLoading ? (
            <div className="empty-state"><div className="empty-state-icon">💬</div><div className="empty-state-title">Loading...</div></div>
          ) : conversations.length === 0 ? (
            <div className="empty-state" style={{ padding: 48 }}>
              <div className="empty-state-icon">💬</div>
              <div className="empty-state-title">No conversations yet</div>
              <div className="empty-state-sub">Messages from parents will appear here once the bot receives them.</div>
            </div>
          ) : (
            conversations.map((c, i) => {
              const intent = INTENT_LABEL[c.intent ?? 'general'];
              return (
                <div key={c.id} style={{ padding: '14px 20px', borderBottom: i < conversations.length - 1 ? '1px solid #F9FAFB' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{c.phone_number}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#EEF2FF', color: intent?.color ?? '#6B7280' }}>{intent?.label ?? c.intent}</span>
                    </div>
                    <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                      {new Date(c.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1, background: '#F3F4F6', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: '#374151' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', marginBottom: 3 }}>PARENT</div>
                      {c.message}
                    </div>
                    {c.response && (
                      <div style={{ flex: 1, background: '#DCFCE7', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: '#374151' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#15803D', marginBottom: 3 }}>BOT REPLY</div>
                        {c.response}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Knowledge Base */}
      {activeTab === 'knowledge' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Add Knowledge</div>
            {kbSaved && <div className="alert alert-success" style={{ marginBottom: 14 }}>✓ Knowledge chunk saved</div>}
            <form onSubmit={handleSaveKnowledge}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>TITLE *</label>
                <input required style={inputStyle} value={kbForm.title} onChange={e => setKbForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. School Bus Routes" />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>CATEGORY *</label>
                <select required style={inputStyle} value={kbForm.category} onChange={e => setKbForm(p => ({ ...p, category: e.target.value }))}>
                  <option value="general">General</option>
                  <option value="fees">Fees</option>
                  <option value="events">Events / Schedule</option>
                  <option value="transport">Transport</option>
                  <option value="policy">Policy</option>
                  <option value="contact">Contact</option>
                  <option value="curriculum">Curriculum</option>
                  <option value="schedule">Schedule</option>
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>CONTENT *</label>
                <textarea required rows={5} value={kbForm.content} onChange={e => setKbForm(p => ({ ...p, content: e.target.value }))}
                  placeholder="Enter the information the bot should know. Be specific — include dates, amounts, contact numbers."
                  style={{ ...inputStyle, height: 'auto', padding: '10px 12px', resize: 'vertical' }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>SOURCE DOCUMENT</label>
                <input style={inputStyle} value={kbForm.source_doc} onChange={e => setKbForm(p => ({ ...p, source_doc: e.target.value }))} placeholder="e.g. fee_circular_2025.pdf" />
              </div>
              <button type="submit" disabled={kbSaving} className="btn btn-primary" style={{ width: '100%' }}>
                {kbSaving ? 'Saving...' : '+ Add to Knowledge Base'}
              </button>
            </form>
          </div>

          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 12 }}>
              Active Knowledge ({knowledge.filter(k => k.is_active).length} active)
            </div>
            {kbLoading ? (
              <div className="card"><div className="empty-state"><div className="empty-state-icon">📚</div><div className="empty-state-title">Loading...</div></div></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {knowledge.map(chunk => (
                  <div key={chunk.id} style={{ background: chunk.is_active ? '#fff' : '#F9FAFB', border: `1px solid ${chunk.is_active ? '#E5E7EB' : '#F3F4F6'}`, borderRadius: 10, padding: '12px 14px', opacity: chunk.is_active ? 1 : 0.6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>{chunk.title}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: '#EEF2FF', color: '#4F46E5', marginLeft: 8 }}>{chunk.category}</span>
                      </div>
                      <button onClick={() => toggleKnowledge(chunk.id, chunk.is_active)}
                        style={{ height: 26, padding: '0 10px', borderRadius: 6, border: '1px solid #E5E7EB', background: chunk.is_active ? '#FEF2F2' : '#DCFCE7', color: chunk.is_active ? '#B91C1C' : '#15803D', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {chunk.is_active ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>{chunk.content.slice(0, 120)}...</div>
                    {chunk.source_doc && <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>Source: {chunk.source_doc}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Test Bot */}
      {activeTab === 'test' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>🧪 Test the Bot</div>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
              Simulate an incoming WhatsApp message. The bot will identify the parent, fetch live data, and generate a response — without sending any real WhatsApp message.
            </div>
            <form onSubmit={handleTest}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>PARENT PHONE NUMBER</label>
                <input required style={inputStyle} value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="+919876543210" />
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>Must match a phone in your parents or students table</div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>MESSAGE</label>
                <textarea rows={4} required value={testMessage} onChange={e => setTestMessage(e.target.value)}
                  placeholder="What is my child's attendance?"
                  style={{ ...inputStyle, height: 'auto', padding: '10px 12px', resize: 'vertical' }} />
              </div>
              <button type="submit" disabled={testLoading} className="btn btn-primary" style={{ width: '100%' }}>
                {testLoading ? '⏳ Testing...' : '▶ Test Bot Response'}
              </button>
            </form>
          </div>

          <div>
            {testResult ? (
              <div className="card">
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Bot Response</div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', marginBottom: 4 }}>INTENT DETECTED</div>
                  <span style={{ fontSize: 13, fontWeight: 700, padding: '4px 10px', borderRadius: 10, background: '#EEF2FF', color: '#4F46E5' }}>
                    {INTENT_LABEL[String(testResult.intent)]?.label ?? String(testResult.intent)}
                  </span>
                </div>
                {!!testResult.parent_name && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', marginBottom: 4 }}>PARENT IDENTIFIED</div>
                    <div style={{ fontSize: 14, color: '#374151' }}>{String(testResult.parent_name)} — {String(testResult.student_name)}</div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', marginBottom: 6 }}>REPLY</div>
                  <div style={{ background: '#DCFCE7', borderRadius: 10, padding: '14px 16px', fontSize: 14, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {String(testResult.reply ?? testResult.error ?? 'No response generated')}
                  </div>
                </div>
                {!!testResult.error && (
                  <div className="alert alert-error" style={{ marginTop: 12 }}>{String(testResult.error)}</div>
                )}
              </div>
            ) : (
              <div className="card">
                <div className="empty-state">
                  <div className="empty-state-icon">💬</div>
                  <div className="empty-state-title">Bot response will appear here</div>
                  <div className="empty-state-sub">Enter a phone number and message, then click Test.</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
