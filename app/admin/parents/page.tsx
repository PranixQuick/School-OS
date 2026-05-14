'use client';
// app/admin/parents/page.tsx
// Batch 10 — Admin parent management: list parents, reset PIN.
// Auth: admin session (middleware guards). Uses Layout.

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

interface ParentRow {
  id: string;
  name: string | null;
  phone: string | null;
  student_name: string | null;
  student_class: string | null;
  last_access: string | null;
  whatsapp_opted_out: boolean;
}

export default function AdminParentsPage() {
  const [parents, setParents] = useState<ParentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pinResetStatus, setPinResetStatus] = useState<Record<string, 'loading'|'done'|'error'>>({});

  useEffect(() => { void loadParents(); }, []);

  async function loadParents() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/parents');
      const d = await res.json() as { parents?: ParentRow[] };
      if (res.ok) setParents(d.parents ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function resetPin(parentId: string) {
    setPinResetStatus(prev => ({ ...prev, [parentId]: 'loading' }));
    try {
      const res = await fetch(`/api/admin/parents/${parentId}/reset-pin`, { method: 'PATCH' });
      if (res.ok) {
        setPinResetStatus(prev => ({ ...prev, [parentId]: 'done' }));
        setTimeout(() => setPinResetStatus(prev => { const n = { ...prev }; delete n[parentId]; return n; }), 3000);
      } else {
        setPinResetStatus(prev => ({ ...prev, [parentId]: 'error' }));
      }
    } catch {
      setPinResetStatus(prev => ({ ...prev, [parentId]: 'error' }));
    }
  }

  const filtered = parents.filter(p =>
    !search || (p.name?.toLowerCase().includes(search.toLowerCase()) || p.phone?.includes(search) || p.student_name?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <Layout title="Parent Accounts" subtitle="Manage parent access and reset PINs">
      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, phone, or student..."
          style={{ padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, width: '100%', maxWidth: 400, boxSizing: 'border-box' }}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>Loading parents...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>
          {search ? 'No parents match your search.' : 'No parent accounts found.'}
        </div>
      ) : (
        <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Parent Name','Phone','Student','Last Access','WhatsApp',''].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, fontSize: 10, color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const status = pinResetStatus[p.id];
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{p.name ?? '—'}</td>
                    <td style={{ padding: '8px 12px', color: '#6B7280' }}>{p.phone ?? '—'}</td>
                    <td style={{ padding: '8px 12px' }}>
                      {p.student_name ?? '—'}
                      {p.student_class && <span style={{ marginLeft: 4, color: '#9CA3AF', fontSize: 10 }}>({p.student_class})</span>}
                    </td>
                    <td style={{ padding: '8px 12px', color: '#9CA3AF', fontSize: 10 }}>
                      {p.last_access ? new Date(p.last_access).toLocaleDateString('en-IN') : 'Never'}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      {p.whatsapp_opted_out
                        ? <span style={{ color: '#9CA3AF', fontSize: 10 }}>Opted out</span>
                        : <span style={{ color: '#065F46', fontSize: 10 }}>Active</span>}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      {status === 'done' ? (
                        <span style={{ fontSize: 10, color: '#065F46', fontWeight: 700 }}>✓ PIN sent</span>
                      ) : status === 'error' ? (
                        <span style={{ fontSize: 10, color: '#B91C1C' }}>Error</span>
                      ) : (
                        <button onClick={() => void resetPin(p.id)} disabled={status === 'loading'}
                          style={{ padding: '4px 10px', background: status === 'loading' ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 5, fontSize: 10, fontWeight: 700, cursor: status === 'loading' ? 'not-allowed' : 'pointer' }}>
                          {status === 'loading' ? '...' : '🔑 Reset PIN'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
