'use client';
// app/admin/expenses/page.tsx
// Outgoing payments / expenses (workflow #7). Accountant/admin log a payment;
// owner/admin/principal approve/reject/mark-paid. Alerts flow via the bell.

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface Expense {
  id: string;
  category: string;
  type: string;
  amount: number;
  description: string | null;
  status: string;
  payment_reference: string | null;
  created_at: string;
  created_by?: { email?: string } | null;
  approved_by?: { email?: string } | null;
}

const CATEGORIES = ['vendor', 'utility', 'maintenance', 'salary_advance', 'other'];
const PAY_TYPES = ['cash', 'bank_transfer', 'cheque', 'upi'];
const APPROVER_ROLES = ['owner', 'admin', 'admin_staff', 'principal'];

const statusStyle = (s: string): { bg: string; fg: string; label: string } => {
  switch (s) {
    case 'approved': return { bg: '#DBEAFE', fg: '#1D4ED8', label: 'Approved' };
    case 'paid': return { bg: '#DCFCE7', fg: '#15803D', label: 'Paid' };
    case 'rejected': return { bg: '#FEE2E2', fg: '#B91C1C', label: 'Rejected' };
    default: return { bg: '#FEF9C3', fg: '#A16207', label: 'Pending approval' };
  }
};

export default function ExpensesPage() {
  const [role, setRole] = useState<string>('');
  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formMsg, setFormMsg] = useState('');
  const [form, setForm] = useState({ category: 'vendor', type: 'bank_transfer', amount: '', description: '', payment_reference: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [meRes, exRes] = await Promise.allSettled([
        fetch('/api/auth/me').then(r => r.ok ? r.json() : null),
        fetch('/api/admin/expenses').then(r => r.ok ? r.json() : Promise.reject(new Error('Could not load payments.'))),
      ]);
      if (meRes.status === 'fulfilled' && meRes.value) setRole(meRes.value.role ?? '');
      if (exRes.status === 'fulfilled') setItems(exRes.value.expenses ?? []);
      else setError((exRes.reason as Error).message);
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const canApprove = APPROVER_ROLES.includes(role);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg('');
    if (!form.amount || Number(form.amount) <= 0) { setFormMsg('Enter a valid amount.'); return; }
    setSaving(true);
    try {
      const r = await fetch('/api/admin/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: form.category, type: form.type, amount: Number(form.amount),
          description: form.description || null, payment_reference: form.payment_reference || null,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not log the payment.');
      setForm({ category: 'vendor', type: 'bank_transfer', amount: '', description: '', payment_reference: '' });
      setShowForm(false);
      await load();
    } catch (err: any) {
      setFormMsg(err.message ?? 'Could not log the payment.');
    } finally {
      setSaving(false);
    }
  };

  const decide = async (id: string, status: string) => {
    setItems(prev => prev.map(x => x.id === id ? { ...x, status } : x));
    try {
      await fetch(`/api/admin/expenses/${id}/approve`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      });
      await load();
    } catch { void load(); }
  };

  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, boxSizing: 'border-box' as const };

  return (
    <Layout title="Payments & Expenses" subtitle="Outgoing payments with approval">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={() => { setShowForm(s => !s); setFormMsg(''); }}
          style={{ background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          {showForm ? 'Close' : '+ Log a payment'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: 4 }}>Category</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={{ ...inputStyle, background: '#fff' }}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: 4 }}>Pay via</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={{ ...inputStyle, background: '#fff' }}>
                {PAY_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: 4 }}>Amount (₹)</label>
            <input type="number" min={1} value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: 4 }}>Description</label>
            <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="e.g. Stationery supplier — May" style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: 4 }}>Reference (optional)</label>
            <input type="text" value={form.payment_reference} onChange={e => setForm({ ...form, payment_reference: e.target.value })} placeholder="Invoice / cheque no." style={inputStyle} />
          </div>
          {formMsg && <div style={{ fontSize: 12, color: '#B91C1C', fontWeight: 600 }}>{formMsg}</div>}
          <button type="submit" disabled={saving} style={{ background: saving ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, padding: '11px', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving…' : 'Log payment'}
          </button>
        </form>
      )}

      {loading ? (
        <div style={{ padding: 28, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 16, background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', borderRadius: 12, fontSize: 13, fontWeight: 600 }}>{error}</div>
      ) : items.length === 0 ? (
        <div style={{ padding: 20, background: '#F9FAFB', border: '1px dashed #E5E7EB', borderRadius: 12, color: '#6B7280', fontSize: 13 }}>No payments logged yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(x => {
            const st = statusStyle(x.status);
            return (
              <div key={x.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>₹{Math.round(Number(x.amount)).toLocaleString('en-IN')}</div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                      {x.category?.replace('_', ' ')} · {x.type?.replace('_', ' ')}
                      {x.description ? ` · ${x.description}` : ''}
                    </div>
                    {x.created_by?.email && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>by {x.created_by.email}</div>}
                  </div>
                  <span style={{ background: st.bg, color: st.fg, borderRadius: 99, padding: '4px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{st.label}</span>
                </div>
                {canApprove && (x.status === 'pending_approval' || x.status === 'approved') && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    {x.status === 'pending_approval' && (
                      <>
                        <button onClick={() => decide(x.id, 'approved')} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: '#4F46E5', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Approve</button>
                        <button onClick={() => decide(x.id, 'rejected')} style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid #FCA5A5', background: '#fff', color: '#B91C1C', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Reject</button>
                      </>
                    )}
                    {x.status === 'approved' && (
                      <button onClick={() => decide(x.id, 'paid')} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: '#15803D', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Mark paid</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
