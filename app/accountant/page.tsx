'use client';
// app/accountant/page.tsx
// Accountant Cockpit: Fee Collections & Unified Expense/Miscellaneous Payments

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import { VoiceQueryWidget } from '@/components/VoiceQueryWidget';

interface Summary {
  today_collections: { total_amount: number; count: number; by_method: Record<string, { amount: number; count: number }>; date: string };
  this_month: { collected: number; pending: number; overdue: number; waived: number; total_expected: number; month_start: string };
  by_fee_type: { fee_type: string; collected: number; pending: number; overdue: number }[];
  overdue_breakdown: { count: number; total_amount: number; oldest_due_date: string | null };
  pending_verification: { count: number };
  totals: { all_fees: number; paid: number; pending: number; overdue: number };
}

interface Expense {
  id: string;
  category: string;
  type: string;
  amount: number;
  description: string | null;
  status: string;
  payment_reference: string | null;
  created_at: string;
  created_by?: { email: string };
}

interface OnboardingContext {
  school_id: string;
  school_name: string;
  institution_type: string;
  ownership_type: string;
  is_government: boolean;
  is_anganwadi: boolean;
  userRole?: string;
}

const inr = (n: number) => '₹' + Math.round(n || 0).toLocaleString('en-IN');

export default function AccountantCockpit() {
  const [s, setS] = useState<Summary | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [ctx, setCtx] = useState<OnboardingContext | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Log expense form state
  const [showModal, setShowModal] = useState(false);
  const [category, setCategory] = useState('maintenance');
  const [type, setType] = useState('outward');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [ref, setRef] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.allSettled([
      fetch('/api/onboarding/context').then(r => r.ok ? r.json() : null),
      fetch('/api/accounts/summary').then(r => r.ok ? r.json() : null),
      fetch('/api/admin/expenses').then(r => r.ok ? r.json() : { expenses: [] }),
    ]).then(([ctxRes, summaryRes, expRes]) => {
      if (ctxRes.status === 'fulfilled' && ctxRes.value) {
        setCtx(ctxRes.value);
      }
      if (summaryRes.status === 'fulfilled' && summaryRes.value) {
        setS(summaryRes.value);
      }
      if (expRes.status === 'fulfilled' && expRes.value) {
        setExpenses(expRes.value.expenses ?? []);
      }
    }).catch(e => {
      setError(e.message);
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          type,
          amount: Number(amount),
          description: desc,
          payment_reference: ref,
        }),
      });
      if (res.ok) {
        setShowModal(false);
        setAmount('');
        setDesc('');
        setRef('');
        loadData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save transaction');
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveExpense = async (id: string, action: 'approved' | 'rejected' | 'paid') => {
    if (!confirm(`Are you sure you want to mark this transaction as ${action}?`)) return;
    try {
      const res = await fetch(`/api/admin/expenses/${id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action }),
      });
      if (res.ok) {
        loadData();
      } else {
        const err = await res.json();
        alert(err.error || 'Action failed');
      }
    } catch {
      alert('Network error');
    }
  };

  const card = (label: string, value: string, color: string, sub?: string) => (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 16, flex: 1, minWidth: 150 }}>
      <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{sub}</div>}
    </div>
  );

  const isGovOrAnganwadi = ctx?.is_government || ctx?.is_anganwadi;
  const userRole = ctx?.userRole ?? '';
  const canApprove = ['owner', 'admin', 'admin_staff', 'principal'].includes(userRole);

  return (
    <Layout title={isGovOrAnganwadi ? "Budget & Expense Cockpit" : "Accountant Cockpit"} subtitle={isGovOrAnganwadi ? "Government grants & supply logs" : "Collections & disbursements cockpit"}>
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#B91C1C' }}>{error}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          <VoiceQueryWidget />

          {/* Quick links */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {!isGovOrAnganwadi && (
              <>
                <a href="/accountant/demand" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#ECFDF5', color: '#15803D', border: '1px solid #A7F3D0', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>⚡ Generate demands →</a>
                <a href="/accountant/ledger" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#EEF2FF', color: '#4F46E5', border: '1px solid #C7D2FE', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>📒 Student ledger →</a>
                <a href="/accountant/defaulters" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>⚠️ Defaulters report →</a>
                <a href="/accountant/tally" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#F9FAFB', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>📤 Tally export →</a>
              </>
            )}
            <button 
              onClick={() => setShowModal(true)} 
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              ➕ Log Expense / Payment
            </button>
          </div>

          {/* Fee collection section (Only for private/K-12 schools) */}
          {!isGovOrAnganwadi && s && (
            <>
              {/* Today */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', marginBottom: 8 }}>Today · {s.today_collections.date}</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {card('Collected today', inr(s.today_collections.total_amount), '#16A34A', `${s.today_collections.count} payment${s.today_collections.count === 1 ? '' : 's'}`)}
                  {Object.entries(s.today_collections.by_method).filter(([, v]) => v.count > 0).map(([m, v]) => (
                    card(m.charAt(0).toUpperCase() + m.slice(1), inr(v.amount), '#4F46E5', `${v.count}×`)
                  ))}
                </div>
              </div>

              {/* This month */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', marginBottom: 8 }}>This month</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {card('Collected', inr(s.this_month.collected), '#16A34A')}
                  {card('Pending', inr(s.this_month.pending), '#D97706')}
                  {card('Overdue', inr(s.this_month.overdue), '#B91C1C')}
                  {card('Expected', inr(s.this_month.total_expected), '#111827')}
                </div>
              </div>

              {/* Overdue + verification */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {card('Overdue dues', inr(s.overdue_breakdown.total_amount), '#B91C1C', `${s.overdue_breakdown.count} item${s.overdue_breakdown.count === 1 ? '' : 's'}${s.overdue_breakdown.oldest_due_date ? ' · oldest ' + s.overdue_breakdown.oldest_due_date : ''}`)}
                {card('Awaiting verification', String(s.pending_verification.count), '#D97706', 'payments to confirm')}
                {card('Fee records', String(s.totals.all_fees), '#111827', `${s.totals.paid} paid · ${s.totals.pending} pending · ${s.totals.overdue} overdue`)}
              </div>
            </>
          )}

          {/* Unified Expenses & Disbursements Section */}
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>
                {isGovOrAnganwadi ? "Grants & Operations Supply Logs" : "Expenses & Miscellaneous Payments"}
              </div>
            </div>

            {expenses.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No recorded expenses.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB' }}>
                      <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #E5E7EB', fontWeight: 700, color: '#374151' }}>Date</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #E5E7EB', fontWeight: 700, color: '#374151' }}>Category</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #E5E7EB', fontWeight: 700, color: '#374151' }}>Type</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #E5E7EB', fontWeight: 700, color: '#374151' }}>Description</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '1px solid #E5E7EB', fontWeight: 700, color: '#374151' }}>Amount</th>
                      <th style={{ textAlign: 'center', padding: '8px 10px', borderBottom: '1px solid #E5E7EB', fontWeight: 700, color: '#374151' }}>Status</th>
                      <th style={{ textAlign: 'center', padding: '8px 10px', borderBottom: '1px solid #E5E7EB', fontWeight: 700, color: '#374151' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map(e => (
                      <tr key={e.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td style={{ padding: '8px 10px', color: '#6B7280' }}>{new Date(e.created_at).toLocaleDateString()}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 600, color: '#111827', textTransform: 'capitalize' }}>{e.category.replace('_', ' ')}</td>
                        <td style={{ padding: '8px 10px', color: e.type === 'inward' ? '#16A34A' : '#B91C1C', fontWeight: 600 }}>{e.type.toUpperCase()}</td>
                        <td style={{ padding: '8px 10px', color: '#4B5563' }}>{e.description || '—'} {e.payment_reference && `(Ref: ${e.payment_reference})`}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#111827' }}>{inr(e.amount)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <span style={{ 
                            fontSize: 10, 
                            fontWeight: 700, 
                            padding: '3px 8px', 
                            borderRadius: 12, 
                            background: e.status === 'paid' ? '#DEF7EC' : e.status === 'approved' ? '#EBF5FF' : e.status === 'rejected' ? '#FDE8E8' : '#FEF3C7',
                            color: e.status === 'paid' ? '#03543F' : e.status === 'approved' ? '#1E429F' : e.status === 'rejected' ? '#9B1C1C' : '#92400E',
                            textTransform: 'uppercase'
                          }}>
                            {e.status}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          {e.status === 'pending_approval' && canApprove ? (
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                              <button onClick={() => handleApproveExpense(e.id, 'approved')} style={{ background: '#10B981', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Approve</button>
                              <button onClick={() => handleApproveExpense(e.id, 'rejected')} style={{ background: '#EF4444', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Reject</button>
                            </div>
                          ) : e.status === 'approved' ? (
                            <button onClick={() => handleApproveExpense(e.id, 'paid')} style={{ background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Mark Paid</button>
                          ) : (
                            <span style={{ color: '#9CA3AF' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Log Expense Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 16, width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Log Transaction</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9CA3AF' }}>&times;</button>
            </div>
            
            <form onSubmit={handleCreateExpense} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: '#374151' }}>
                Category
                <select value={category} onChange={e => setCategory(e.target.value)} style={{ padding: 10, border: '1px solid #D1D5DB', borderRadius: 8 }}>
                  <option value="maintenance">Maintenance / Office expenses</option>
                  <option value="rent">Rent / Leases</option>
                  <option value="transport">Transport / Fuel / Logistical</option>
                  {isGovOrAnganwadi && <option value="nutrition_supplies">Nutrition Supplies / Food Items</option>}
                  <option value="miscellaneous">Miscellaneous / Others</option>
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: '#374151' }}>
                Payment Direction
                <select value={type} onChange={e => setType(e.target.value)} style={{ padding: 10, border: '1px solid #D1D5DB', borderRadius: 8 }}>
                  <option value="outward">Outward (Expense / Payout)</option>
                  <option value="inward">Inward (Grants / Misc Income)</option>
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: '#374151' }}>
                Amount (₹)
                <input type="number" required min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Enter amount..." style={{ padding: 10, border: '1px solid #D1D5DB', borderRadius: 8 }} />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: '#374151' }}>
                Description
                <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Provide short purpose / comments..." style={{ padding: 10, border: '1px solid #D1D5DB', borderRadius: 8, height: 60, resize: 'none' }} />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: '#374151' }}>
                Payment Reference (Optional)
                <input value={ref} onChange={e => setRef(e.target.value)} placeholder="Cheque / UPI / Bank reference no..." style={{ padding: 10, border: '1px solid #D1D5DB', borderRadius: 8 }} />
              </label>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button type="submit" disabled={submitting} style={{ flex: 1, background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 10, padding: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {submitting ? 'Submitting...' : 'Save Request'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: 10, padding: 12, fontWeight: 700, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
