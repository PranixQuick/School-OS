'use client';

// PATH: app/accounts/page.tsx
// Item #12 — Accounts Dashboard
//
// Read-only finance view for admin_staff | accountant | principal | owner roles.
// Auth: session cookie (middleware). Role check done server-side via x-user-role header.
// If role not permitted: redirects to login.
//
// Sections:
//   1. Four summary cards: Today Collections, Month Collected, Pending+Overdue, Pending Verification
//   2. Fee-type breakdown table
//   3. Recent transactions list (last 50) with status/date filters

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';

// ─── Types ────────────────────────────────────────────────────────────────
interface SummaryData {
  today_collections: { total_amount: number; count: number; date: string; by_method: Record<string, { amount: number; count: number }> };
  this_month: { collected: number; pending: number; overdue: number; waived: number; total_expected: number; month_start: string };
  by_fee_type: { fee_type: string; collected: number; pending: number; overdue: number }[];
  overdue_breakdown: { count: number; total_amount: number; oldest_due_date: string | null };
  pending_verification: { count: number };
  totals: { all_fees: number; paid: number; pending: number; overdue: number };
}

interface Transaction {
  id: string; student_id: string; amount: number; original_amount: number | null;
  due_date: string; paid_date: string | null; status: string; fee_type: string | null;
  description: string | null; fee_receipt_number: string | null;
  payment_method: string | null; payment_reference: string | null;
  discount_amount: number | null; gst_rate: number | null; tax_amount: number | null;
  students: { name: string; class: string | null; section: string | null } | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, { bg: string; fg: string }> = {
  paid:                 { bg: '#D1FAE5', fg: '#065F46' },
  pending:              { bg: '#FEF3C7', fg: '#92400E' },
  overdue:              { bg: '#FEE2E2', fg: '#991B1B' },
  pending_verification: { bg: '#DBEAFE', fg: '#1E40AF' },
  waived:               { bg: '#E0E7FF', fg: '#3730A3' },
  awaiting_template:    { bg: '#F3F4F6', fg: '#4B5563' },
};

function fmt(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function pct(num: number, den: number): string {
  if (!den) return '0%';
  return Math.round((num / den) * 100) + '%';
}

const ALLOWED_ROLES = new Set(['owner', 'principal', 'admin_staff', 'accountant']);

// ─── Page ─────────────────────────────────────────────────────────────────
export default function AccountsDashboard() {
  const router = useRouter();
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [txStatus, setTxStatus] = useState('all');
  const [txFrom, setTxFrom] = useState('');
  const [txTo, setTxTo] = useState('');

  useEffect(() => {
    // Role check from meta tag injected by layout / session — if 401/403 redirect
    void loadSummary();
    void loadTransactions('all', '', '');
  }, []);

  async function loadSummary() {
    setSummaryLoading(true);
    try {
      const res = await fetch('/api/accounts/summary');
      if (res.status === 401 || res.status === 403) { router.replace('/login'); return; }
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Failed to load summary'); return; }
      setSummary(await res.json());
    } finally { setSummaryLoading(false); }
  }

  async function loadTransactions(status: string, from: string, to: string) {
    setTxLoading(true);
    try {
      const params = new URLSearchParams({ status, limit: '50' });
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const res = await fetch('/api/accounts/transactions?' + params.toString());
      if (res.ok) { const d = await res.json(); setTransactions(d.transactions ?? []); }
    } finally { setTxLoading(false); }
  }

  function applyFilters() {
    setTxStatus(txStatus);
    void loadTransactions(txStatus, txFrom, txTo);
  }

  if (error) return (
    <Layout title="Accounts" subtitle="Finance overview">
      <div style={{ padding: 40, textAlign: 'center', color: '#991B1B' }}>{error}</div>
    </Layout>
  );

  const s = summary;

  return (
    <Layout title="Accounts" subtitle="Finance overview">

      {/* ── Summary Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>

        {/* Today Collections */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 4 }}>TODAY'S COLLECTIONS</div>
          {summaryLoading ? <div style={{ color: '#9CA3AF', fontSize: 13 }}>Loading...</div> : (
            <>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#065F46' }}>{fmt(s?.today_collections.total_amount ?? 0)}</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{s?.today_collections.count ?? 0} payment{s?.today_collections.count !== 1 ? 's' : ''}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {Object.entries(s?.today_collections.by_method ?? {}).filter(([, v]) => v.count > 0).map(([m, v]) => (
                  <span key={m} style={{ fontSize: 10, background: '#F3F4F6', padding: '2px 6px', borderRadius: 4, color: '#374151' }}>
                    {m}: {fmt(v.amount)}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* This Month */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 4 }}>THIS MONTH COLLECTED</div>
          {summaryLoading ? <div style={{ color: '#9CA3AF', fontSize: 13 }}>Loading...</div> : (
            <>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#1E40AF' }}>{fmt(s?.this_month.collected ?? 0)}</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                {pct(s?.this_month.collected ?? 0, s?.this_month.total_expected ?? 0)} of {fmt(s?.this_month.total_expected ?? 0)} expected
              </div>
              <div style={{ marginTop: 8, height: 4, background: '#E5E7EB', borderRadius: 2 }}>
                <div style={{ height: 4, background: '#1E40AF', borderRadius: 2, width: pct(s?.this_month.collected ?? 0, s?.this_month.total_expected ?? 0) }} />
              </div>
            </>
          )}
        </div>

        {/* Pending + Overdue */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 4 }}>PENDING & OVERDUE</div>
          {summaryLoading ? <div style={{ color: '#9CA3AF', fontSize: 13 }}>Loading...</div> : (
            <>
              <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#92400E' }}>{fmt(s?.this_month.pending ?? 0)}</div>
                  <div style={{ fontSize: 10, color: '#92400E', fontWeight: 600 }}>PENDING</div>
                </div>
                <div style={{ width: 1, background: '#E5E7EB' }} />
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#991B1B' }}>{fmt(s?.overdue_breakdown.total_amount ?? 0)}</div>
                  <div style={{ fontSize: 10, color: '#991B1B', fontWeight: 600 }}>OVERDUE ({s?.overdue_breakdown.count})</div>
                </div>
              </div>
              {s?.overdue_breakdown.oldest_due_date && (
                <div style={{ fontSize: 10, color: '#991B1B', marginTop: 6 }}>Oldest: {s.overdue_breakdown.oldest_due_date}</div>
              )}
            </>
          )}
        </div>

        {/* Pending Verification */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 4 }}>PENDING VERIFICATION</div>
          {summaryLoading ? <div style={{ color: '#9CA3AF', fontSize: 13 }}>Loading...</div> : (
            <>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#1E40AF' }}>{s?.pending_verification.count ?? 0}</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>manual proofs awaiting review</div>
              {(s?.pending_verification.count ?? 0) > 0 && (
                <a href="/automation/fees?status=pending_verification"
                  style={{ display: 'inline-block', marginTop: 8, fontSize: 11, color: '#1E40AF', textDecoration: 'underline' }}>
                  Review →
                </a>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Fee-type Breakdown Table ── */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, marginBottom: 20, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #E5E7EB', fontWeight: 700, fontSize: 14 }}>
          Fee Type Breakdown
        </div>
        {summaryLoading ? (
          <div style={{ padding: 20, color: '#6B7280', fontSize: 13 }}>Loading...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  {['Fee Type', 'Collected', 'Pending', 'Overdue', 'Total'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(s?.by_fee_type ?? []).length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 16, color: '#9CA3AF', textAlign: 'center' }}>No fee data</td></tr>
                ) : (
                  (s?.by_fee_type ?? []).map(r => (
                    <tr key={r.fee_type} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, textTransform: 'capitalize' }}>{r.fee_type}</td>
                      <td style={{ padding: '8px 12px', color: '#065F46' }}>{fmt(r.collected)}</td>
                      <td style={{ padding: '8px 12px', color: '#92400E' }}>{fmt(r.pending)}</td>
                      <td style={{ padding: '8px 12px', color: '#991B1B' }}>{fmt(r.overdue)}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{fmt(r.collected + r.pending + r.overdue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Transactions ── */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Transactions</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={txStatus} onChange={e => setTxStatus(e.target.value)}
              style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12 }}>
              {['all', 'paid', 'pending', 'overdue', 'pending_verification', 'waived'].map(s => (
                <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s.replace('_', ' ')}</option>
              ))}
            </select>
            <input type="date" value={txFrom} onChange={e => setTxFrom(e.target.value)} placeholder="From"
              style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12 }} />
            <input type="date" value={txTo} onChange={e => setTxTo(e.target.value)} placeholder="To"
              style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12 }} />
            <button onClick={applyFilters}
              style={{ padding: '5px 12px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Apply
            </button>
          </div>
        </div>
        {txLoading ? (
          <div style={{ padding: 20, color: '#6B7280', fontSize: 13 }}>Loading...</div>
        ) : transactions.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No transactions found for the selected filters.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  {['Student', 'Class', 'Fee Type', 'Amount', 'Status', 'Method', 'Date'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#6B7280', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map(t => {
                  const sc = STATUS_BADGE[t.status] ?? STATUS_BADGE['pending'];
                  const studentLabel = t.students?.name ?? '—';
                  const classLabel = t.students ? `${t.students.class ?? '?'}${t.students.section ? '-' + t.students.section : ''}` : '—';
                  const dateLabel = t.status === 'paid' ? (t.paid_date ?? '—') : t.due_date;
                  const totalAmt = Number(t.amount ?? 0) + Number(t.tax_amount ?? 0);
                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid #F9FAFB' }}>
                      <td style={{ padding: '7px 10px', fontWeight: 500 }}>{studentLabel}</td>
                      <td style={{ padding: '7px 10px', color: '#6B7280' }}>{classLabel}</td>
                      <td style={{ padding: '7px 10px', textTransform: 'capitalize', color: '#374151' }}>{t.fee_type ?? '—'}</td>
                      <td style={{ padding: '7px 10px', fontWeight: 600 }}>{fmt(totalAmt)}</td>
                      <td style={{ padding: '7px 10px' }}>
                        <span style={{ background: sc.bg, color: sc.fg, padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600 }}>
                          {t.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '7px 10px', color: '#6B7280', textTransform: 'capitalize' }}>{t.payment_method ?? '—'}</td>
                      <td style={{ padding: '7px 10px', color: '#6B7280', whiteSpace: 'nowrap' }}>{dateLabel}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ padding: '10px 16px', borderTop: '1px solid #F3F4F6', fontSize: 11, color: '#9CA3AF', display: 'flex', justifyContent: 'space-between' }}>
          <span>Showing {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}</span>
          <a href="/automation/fees" style={{ color: '#4F46E5', textDecoration: 'none', fontSize: 11 }}>Full fee management →</a>
        </div>
      </div>

    </Layout>
  );
}
