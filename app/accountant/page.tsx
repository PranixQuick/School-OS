'use client';
// app/accountant/page.tsx
// ISS-10 (#10a) — Accountant operational cockpit: fee-collection dashboard
// built on the existing /api/accounts/summary aggregation. Read-only.

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

interface Summary {
  today_collections: { total_amount: number; count: number; by_method: Record<string, { amount: number; count: number }>; date: string };
  this_month: { collected: number; pending: number; overdue: number; waived: number; total_expected: number; month_start: string };
  by_fee_type: { fee_type: string; collected: number; pending: number; overdue: number }[];
  overdue_breakdown: { count: number; total_amount: number; oldest_due_date: string | null };
  pending_verification: { count: number };
  totals: { all_fees: number; paid: number; pending: number; overdue: number };
}

const inr = (n: number) => '₹' + Math.round(n || 0).toLocaleString('en-IN');

export default function AccountantCockpit() {
  const [s, setS] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/accounts/summary')
      .then(r => r.ok ? r.json() : Promise.reject(new Error(r.status === 403 ? 'Not permitted' : 'Failed to load')))
      .then((d: Summary) => setS(d))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const card = (label: string, value: string, color: string, sub?: string) => (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 16, flex: 1, minWidth: 150 }}>
      <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <Layout title="Accountant Cockpit" subtitle="Fee collection overview">
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#B91C1C' }}>{error}</div>
      ) : !s ? null : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Quick links */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href="/accountant/demand" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#ECFDF5', color: '#15803D', border: '1px solid #A7F3D0', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>⚡ Generate demands →</a>
            <a href="/accountant/ledger" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#EEF2FF', color: '#4F46E5', border: '1px solid #C7D2FE', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>📒 Student ledger →</a>
            <a href="/accountant/defaulters" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>⚠️ Defaulters report →</a>
            <a href="/accountant/tally" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#F9FAFB', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>📤 Tally export →</a>
            <a href="/admin/fees" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#F9FAFB', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>💰 Fee details →</a>
          </div>

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

          {/* By fee type */}
          {s.by_fee_type.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', marginBottom: 10 }}>By fee type</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB' }}>
                      <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #E5E7EB', fontWeight: 700, color: '#374151' }}>Type</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '1px solid #E5E7EB', fontWeight: 700, color: '#16A34A' }}>Collected</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '1px solid #E5E7EB', fontWeight: 700, color: '#D97706' }}>Pending</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '1px solid #E5E7EB', fontWeight: 700, color: '#B91C1C' }}>Overdue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.by_fee_type.map(r => (
                      <tr key={r.fee_type} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td style={{ padding: '6px 10px', fontWeight: 600, color: '#111827' }}>{r.fee_type}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', color: '#16A34A' }}>{inr(r.collected)}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', color: '#D97706' }}>{inr(r.pending)}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', color: '#B91C1C' }}>{inr(r.overdue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div>
            <a href="/admin/fees" style={{ fontSize: 13, fontWeight: 600, color: '#4F46E5', textDecoration: 'none' }}>💰 Open fee details →</a>
          </div>
        </div>
      )}
    </Layout>
  );
}
