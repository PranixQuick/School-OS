'use client';
import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';
import { T, type Lang } from '@/lib/i18n';

interface FeeRecord {
  id: string; student_name: string; class: string; section: string;
  fee_type: string; amount: number; due_date: string;
  status: 'paid' | 'pending' | 'overdue'; paid_at?: string;
}

const STATUS_COLOR = { paid: '#15803D', pending: '#A16207', overdue: '#B91C1C' };
const STATUS_BG = { paid: '#DCFCE7', pending: '#FEF9C3', overdue: '#FEE2E2' };

export default function FeesPage() {
  const [lang, setLang] = useState<Lang>('en');
  useEffect(() => {
    const stored = localStorage.getItem('edprosys_lang') as Lang | null;
    if (stored) setLang(stored);
    const h = () => { const u = localStorage.getItem('edprosys_lang') as Lang | null; if (u) setLang(u); };
    window.addEventListener('edprosys_lang_change', h);
    return () => window.removeEventListener('edprosys_lang_change', h);
  }, []);
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all'|'pending'|'overdue'|'paid'>('all');
  const [search, setSearch] = useState('');
  const [actionId, setActionId] = useState<string|null>(null);
  const [stats, setStats] = useState({ total: 0, paid: 0, pending: 0, overdue: 0, collected: 0, outstanding: 0 });

  const loadFees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/fees');
      if (!res.ok) throw new Error('Failed');
      const d = await res.json();
      const list: FeeRecord[] = d.fees ?? [];
      setFees(list);
      setStats({
        total: list.length,
        paid: list.filter(f => f.status === 'paid').length,
        pending: list.filter(f => f.status === 'pending').length,
        overdue: list.filter(f => f.status === 'overdue').length,
        collected: list.filter(f => f.status === 'paid').reduce((s, f) => s + f.amount, 0),
        outstanding: list.filter(f => f.status !== 'paid').reduce((s, f) => s + f.amount, 0),
      });
    } catch { /* keep empty state */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadFees(); }, [loadFees]);

  async function markPaid(id: string) {
    setActionId(id);
    try {
      await fetch('/api/admin/fees', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'paid', paid_at: new Date().toISOString() }),
      });
      await loadFees();
    } catch { /* ignore */ }
    setActionId(null);
  }

  const visible = fees.filter(f => {
    if (filter !== 'all' && f.status !== filter) return false;
    if (search && !f.student_name.toLowerCase().includes(search.toLowerCase()) &&
        !f.class.includes(search)) return false;
    return true;
  });

  return (
    <Layout title="Fee Management" subtitle="Track collections, send reminders, mark payments"
      actions={
        <Link href="/admin/fees/templates" className="btn btn-primary btn-sm">+ Fee Template</Link>
      }>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Collected', value: `₹${(stats.collected/1000).toFixed(1)}K`, color: '#15803D', bg: '#DCFCE7' },
          { label: 'Outstanding', value: `₹${(stats.outstanding/1000).toFixed(1)}K`, color: '#B91C1C', bg: '#FEE2E2' },
          { label: 'Overdue', value: stats.overdue, color: '#B91C1C', bg: '#FEE2E2' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter + search */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search student or class…" className="input"
          style={{ flex: 1, minWidth: 160, height: 36, fontSize: 13 }} />
        {(['all','pending','overdue','paid'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            style={{ padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: filter === s ? '#4F46E5' : '#F3F4F6',
              color: filter === s ? '#fff' : '#374151', fontSize: 12, fontWeight: 600 }}>
            {s === 'all' ? `All (${stats.total})` : s === 'pending' ? `Pending (${stats.pending})` :
              s === 'overdue' ? `Overdue (${stats.overdue})` : `Paid (${stats.paid})`}
          </button>
        ))}
      </div>

      {/* Fee list */}
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading fees…</div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">💰</div>
          <div className="empty-state-title">No fee records {filter !== 'all' ? `with status "${filter}"` : ''}</div>
          <div className="empty-state-sub">Fee records appear here once fee templates are assigned to students.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {visible.map((fee, i) => (
            <div key={fee.id} style={{
              padding: '12px 16px', borderBottom: i < visible.length-1 ? '1px solid #F3F4F6' : 'none',
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap'
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 2 }}>{fee.student_name}</div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>
                  Class {fee.class}{fee.section} · {fee.fee_type} · Due {new Date(fee.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>₹{fee.amount.toLocaleString('en-IN')}</div>
                <span style={{ display: 'inline-block', marginTop: 3, padding: '2px 8px', borderRadius: 6,
                  background: STATUS_BG[fee.status], color: STATUS_COLOR[fee.status],
                  fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                  {fee.status}
                </span>
              </div>
              {fee.status !== 'paid' && (
                <button onClick={() => markPaid(fee.id)} disabled={actionId === fee.id}
                  style={{ padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: '#4F46E5', color: '#fff', fontSize: 12, fontWeight: 600,
                    opacity: actionId === fee.id ? 0.6 : 1 }}>
                  {actionId === fee.id ? '…' : 'Mark Paid'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
