'use client';
// app/admin/conversations/page.tsx
// Batch 5B — WhatsApp conversation log: grouped by contact, threaded view.

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';

interface ConversationRow {
  id: string; phone_number: string; direction: string; message: string;
  intent: string; response: string; created_at: string;
  inquiry_name: string | null; inquiry_status: string | null;
}

interface ConvStats { total_messages: number; admission_inquiries: number; existing_parents: number; unique_contacts: number; }

const INTENT_COLOR: Record<string, [string, string]> = {
  admission_inquiry: ['#EEF2FF', '#4338CA'],
  existing_parent:   ['#D1FAE5', '#065F46'],
  attendance:        ['#FEF9C3', '#92400E'],
  fees:              ['#FFF7ED', '#C2410C'],
  events:            ['#F0F9FF', '#0369A1'],
  general:           ['#F9FAFB', '#6B7280'],
  unknown:           ['#F3F4F6', '#9CA3AF'],
};

function groupByPhone(convs: ConversationRow[]): Record<string, ConversationRow[]> {
  const groups: Record<string, ConversationRow[]> = {};
  for (const c of convs) {
    if (!groups[c.phone_number]) groups[c.phone_number] = [];
    groups[c.phone_number].push(c);
  }
  return groups;
}

export default function ConversationsPage() {
  const [convs, setConvs] = useState<ConversationRow[]>([]);
  const [stats, setStats] = useState<ConvStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [thread, setThread] = useState<ConversationRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/conversations?limit=100');
    const d = await res.json() as { conversations?: ConversationRow[]; stats?: ConvStats };
    setConvs(d.conversations ?? []);
    setStats(d.stats ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function openThread(phone: string) {
    setSelectedPhone(phone);
    const res = await fetch(`/api/admin/conversations?phone=${encodeURIComponent(phone)}&limit=50`);
    const d = await res.json() as { conversations?: ConversationRow[] };
    setThread((d.conversations ?? []).reverse());
  }

  // Group by phone, take latest per contact
  const groups = groupByPhone(convs);
  const contacts = Object.entries(groups)
    .map(([phone, msgs]) => ({
      phone,
      latest: msgs[0],
      count: msgs.length,
      name: msgs[0].inquiry_name,
      status: msgs[0].inquiry_status,
      hasAdmission: msgs.some(m => m.intent === 'admission_inquiry'),
    }))
    .sort((a, b) => new Date(b.latest.created_at).getTime() - new Date(a.latest.created_at).getTime());

  const cardStyle = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, marginBottom: 10 };

  return (
    <Layout title="WhatsApp Conversations" subtitle="AI-assisted admission inquiries and parent messages">

      {/* Stats bar */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
          {[
            ['Total Messages', stats.total_messages, '#4F46E5'],
            ['Unique Contacts', stats.unique_contacts, '#0369A1'],
            ['Admission Inquiries', stats.admission_inquiries, '#B45309'],
            ['Parent Messages', stats.existing_parents, '#065F46'],
          ].map(([label, val, color]) => (
            <div key={label as string} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: color as string }}>{val as number}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF' }}>{label as string}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selectedPhone ? '1fr 1.6fr' : '1fr', gap: 14 }}>

        {/* Contact list */}
        <div>
          {loading ? (
            <div style={{ color: '#9CA3AF', padding: 40, textAlign: 'center' }}>Loading…</div>
          ) : contacts.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>💬</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>No conversations yet</div>
              <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 6 }}>WhatsApp messages will appear here once your Twilio webhook is configured.</div>
            </div>
          ) : (
            contacts.map(c => {
              const [ibg, ifg] = INTENT_COLOR[c.latest.intent] ?? INTENT_COLOR.unknown;
              const isSelected = selectedPhone === c.phone;
              return (
                <div key={c.phone}
                  onClick={() => void openThread(c.phone)}
                  style={{ ...cardStyle, cursor: 'pointer', borderColor: isSelected ? '#4F46E5' : '#E5E7EB', background: isSelected ? '#F5F3FF' : '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                          {c.name ?? c.phone}
                        </div>
                        {c.name && <div style={{ fontSize: 10, color: '#9CA3AF' }}>{c.phone}</div>}
                        <span style={{ background: ibg, color: ifg, fontSize: 8, fontWeight: 800, padding: '1px 5px', borderRadius: 3, flexShrink: 0 }}>
                          {c.latest.intent.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.latest.message.slice(0, 60)}{c.latest.message.length > 60 ? '…' : ''}
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'right', marginLeft: 8 }}>
                      <div style={{ fontSize: 10, color: '#9CA3AF' }}>{new Date(c.latest.created_at).toLocaleDateString('en-IN')}</div>
                      <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{c.count} msg{c.count !== 1 ? 's' : ''}</div>
                      {c.hasAdmission && c.status !== 'converted' && (
                        <Link href="/admin/rte" onClick={e => e.stopPropagation()}
                          style={{ fontSize: 9, color: '#4F46E5', fontWeight: 700, textDecoration: 'none' }}>
                          → CRM
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Thread view */}
        {selectedPhone && (
          <div>
            <div style={{ ...cardStyle, maxHeight: '75vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>{selectedPhone}</div>
                <button onClick={() => setSelectedPhone(null)}
                  style={{ fontSize: 12, color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
              </div>
              {thread.map(msg => (
                <div key={msg.id}>
                  {/* Inbound */}
                  <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 4 }}>
                    <div style={{ background: '#F3F4F6', borderRadius: '12px 12px 12px 2px', padding: '8px 12px', maxWidth: '80%', fontSize: 12, color: '#374151' }}>
                      {msg.message}
                      <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 3 }}>{new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                  {/* AI response */}
                  {msg.response && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                      <div style={{ background: '#EEF2FF', borderRadius: '12px 12px 2px 12px', padding: '8px 12px', maxWidth: '80%', fontSize: 12, color: '#3730A3' }}>
                        {msg.response}
                        <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 3, textAlign: 'right' }}>AI · {msg.intent.replace('_', ' ')}</div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {thread.length === 0 && (
                <div style={{ color: '#9CA3AF', fontSize: 12, textAlign: 'center', padding: 20 }}>Loading thread…</div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
