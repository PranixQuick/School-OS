'use client';
// app/admin/results/page.tsx
// Results publishing (workflow #10). Principal/admin/owner publishes a term's
// results, which notifies parents. Non-breaking: publishing does not hide anything.

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface TermRow { term: string; total: number; published: number; }
const PUBLISH_ROLES = ['owner', 'principal', 'admin', 'admin_staff'];

export default function ResultsPage() {
  const [role, setRole] = useState('');
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [meRes, tRes] = await Promise.allSettled([
        fetch('/api/auth/me').then(r => r.ok ? r.json() : null),
        fetch('/api/admin/results').then(r => r.ok ? r.json() : Promise.reject(new Error('Could not load results.'))),
      ]);
      if (meRes.status === 'fulfilled' && meRes.value) setRole(meRes.value.role ?? '');
      if (tRes.status === 'fulfilled') setTerms(tRes.value.terms ?? []);
      else setError((tRes.reason as Error).message);
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const canPublish = PUBLISH_ROLES.includes(role);

  const publish = async (term: string) => {
    setMsg('');
    setBusy(term);
    try {
      const r = await fetch('/api/admin/results', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ term }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not publish.');
      setMsg(`Published ${term} — parents notified (${d.published_count ?? 0} records).`);
      await load();
    } catch (e: any) {
      setMsg(e.message ?? 'Could not publish.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Layout title="Results" subtitle="Publish term results & notify parents">
      {msg && <div style={{ padding: '10px 14px', background: '#EEF2FF', border: '1px solid #C7D2FE', color: '#3730A3', borderRadius: 10, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{msg}</div>}

      {loading ? (
        <div style={{ padding: 28, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 16, background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', borderRadius: 12, fontSize: 13, fontWeight: 600 }}>{error}</div>
      ) : terms.length === 0 ? (
        <div style={{ padding: 20, background: '#F9FAFB', border: '1px dashed #E5E7EB', borderRadius: 12, color: '#6B7280', fontSize: 13 }}>No results have been entered yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {terms.map(t => {
            const fullyPublished = t.published >= t.total && t.total > 0;
            return (
              <div key={t.term} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>{t.term}</div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{t.published} of {t.total} records published</div>
                </div>
                {fullyPublished ? (
                  <span style={{ background: '#DCFCE7', color: '#15803D', borderRadius: 99, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>Published</span>
                ) : canPublish ? (
                  <button onClick={() => publish(t.term)} disabled={busy === t.term}
                    style={{ background: busy === t.term ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: busy === t.term ? 'not-allowed' : 'pointer' }}>
                    {busy === t.term ? 'Publishing…' : 'Publish'}
                  </button>
                ) : (
                  <span style={{ background: '#FEF9C3', color: '#A16207', borderRadius: 99, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>Pending</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
