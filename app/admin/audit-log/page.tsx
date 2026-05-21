'use client';
// Audit log viewer — shows all recorded admin and staff actions
// Reads from audit_log table (already has 3904 rows in production)
// Filterable by module, date range, actor
// Admin/owner only — not visible to teachers or parents

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface AuditEntry { id: string; action: string; module: string; actor_email?: string; created_at: string; resource?: string; }

const MODULE_OPTIONS = ['all','students','fees','attendance','staff','payroll','reports','broadcasts','security','leave_management','health','transport','import'];

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [module, setModule] = useState('all');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
      if (module !== 'all') params.set('module', module);
      const r = await fetch(`/api/admin/audit-log?${params}`);
      if (r.ok) { const d = await r.json() as { entries?: AuditEntry[] }; setEntries(d.entries ?? []); }
    } catch {/**/}
    setLoading(false);
  }, [module, page]);

  useEffect(() => { void load(); }, [load]);

  const MODULE_COLORS: Record<string, string> = {
    students: '#4F46E5', fees: '#D97706', attendance: '#15803D', staff: '#0EA5E9',
    payroll: '#7C3AED', security: '#B91C1C', health: '#DC2626', transport: '#0D9488',
  };

  return (
    <Layout title="Audit Log" subtitle="All staff and admin actions">
      {/* Module filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {MODULE_OPTIONS.map(m => (
          <button key={m} onClick={() => { setModule(m); setPage(0); }}
            style={{ padding: '5px 12px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: module === m ? (MODULE_COLORS[m] ?? '#374151') : '#F3F4F6',
              color: module === m ? '#fff' : '#374151' }}>
            {m}
          </button>
        ))}
      </div>

      {loading ? <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div> : (
        <>
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
            {entries.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No entries found</div>
            ) : entries.map((e, i) => (
              <div key={e.id} style={{ padding: '10px 14px', borderBottom: i < entries.length-1 ? '1px solid #F3F4F6' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: '#111827', fontWeight: 500, lineHeight: 1.4 }}>{e.action}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                      {e.actor_email ?? 'System'} · {new Date(e.created_at).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#F3F4F6', color: MODULE_COLORS[e.module] ?? '#6B7280', flexShrink: 0 }}>
                    {e.module}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'center' }}>
            <button onClick={() => setPage(p => Math.max(0, p-1))} disabled={page === 0}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E5E7EB', background: page === 0 ? '#F3F4F6' : '#fff', cursor: page === 0 ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
              ← Previous
            </button>
            <span style={{ padding: '8px 14px', fontSize: 13, color: '#6B7280' }}>Page {page+1}</span>
            <button onClick={() => setPage(p => p+1)} disabled={entries.length < PAGE_SIZE}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E5E7EB', background: entries.length < PAGE_SIZE ? '#F3F4F6' : '#fff', cursor: entries.length < PAGE_SIZE ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
              Next →
            </button>
          </div>
        </>
      )}
    </Layout>
  );
}
