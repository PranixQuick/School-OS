'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface FeeRow { id: string; fee_type: string; amount: number; due_date: string; paid_date?: string; status: string; }

export default function ParentFeesPage() {
  const [fees, setFees] = useState<FeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);

  const loadFees = useCallback(() => {
    setLoading(true);
    fetch('/api/parent/fees')
      .then(r => r.ok ? r.json() : { fees: [] })
      .then(d => setFees(d.fees ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadFees(); }, [loadFees]);

  // load Razorpay Checkout SDK once
  useEffect(() => {
    if (document.getElementById('rzp-checkout-sdk')) return;
    const s = document.createElement('script');
    s.id = 'rzp-checkout-sdk';
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    document.body.appendChild(s);
  }, []);

  async function payNow(fee: FeeRow) {
    try {
      setPaying(fee.id);
      const r = await fetch('/api/parent/pay', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fee_id: fee.id }) });
      const data = await r.json();
      if (!r.ok) { alert(data.error || 'Could not start payment'); return; }
      const Rzp = (window as unknown as { Razorpay?: new (o: unknown) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void } }).Razorpay;
      if (!Rzp) { alert('Payment is still loading, please try again in a moment.'); return; }
      const rzp = new Rzp({
        key: data.key_id,
        order_id: data.order_id,
        amount: data.amount,
        currency: data.currency,
        name: 'EdProSys',
        description: fee.fee_type,
        handler: () => { setTimeout(loadFees, 1500); },
        modal: { ondismiss: () => {} },
      });
      rzp.on('payment.failed', (resp: unknown) => {
        const desc = (resp as { error?: { description?: string } })?.error?.description;
        alert('Payment failed' + (desc ? ': ' + desc : ''));
      });
      rzp.open();
    } catch (e) {
      alert('Error starting payment: ' + (e as Error).message);
    } finally {
      setPaying(null);
    }
  }

  const total = fees.reduce((s, r) => s + r.amount, 0);
  const pending = fees.filter(r => r.status !== 'paid').reduce((s, r) => s + r.amount, 0);
  const statusColor = (s: string) => ({ paid: '#16A34A', pending: '#D97706', overdue: '#B91C1C' })[s] ?? '#6B7280';
  const statusBg = (s: string) => ({ paid: '#F0FDF4', pending: '#FFFBEB', overdue: '#FEF2F2' })[s] ?? '#F9FAFB';

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ background: '#4F46E5', padding: '16px 16px 20px' }}>
        <Link href="/parent" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, textDecoration: 'none', display: 'block', marginBottom: 8 }}>← Back</Link>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>Fees</div>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ background: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: '#F0FDF4', borderRadius: 10, padding: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#16A34A' }}>₹{total.toLocaleString('en-IN')}</div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>Total Billed</div>
            </div>
            <div style={{ background: pending > 0 ? '#FEF2F2' : '#F0FDF4', borderRadius: 10, padding: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: pending > 0 ? '#B91C1C' : '#16A34A' }}>₹{pending.toLocaleString('en-IN')}</div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>Outstanding</div>
            </div>
          </div>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading…</div>
        ) : fees.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>No fee records found.</div>
        ) : fees.map(r => (
          <div key={r.id} style={{ background: '#fff', borderRadius: 12, padding: '14px', marginBottom: 8, borderLeft: `3px solid ${statusColor(r.status)}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{r.fee_type}</div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Due: {new Date(r.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>₹{r.amount.toLocaleString('en-IN')}</div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: statusBg(r.status), color: statusColor(r.status) }}>{r.status}</span>
              </div>
            </div>
            {r.status !== 'paid' && (
              <button
                onClick={() => payNow(r)}
                disabled={paying === r.id}
                style={{ marginTop: 12, width: '100%', padding: '10px 0', fontSize: 14, fontWeight: 700, color: '#fff', background: paying === r.id ? '#A5B4FC' : '#4F46E5', border: 0, borderRadius: 8, cursor: paying === r.id ? 'default' : 'pointer' }}
              >
                {paying === r.id ? 'Starting…' : `Pay ₹${r.amount.toLocaleString('en-IN')}`}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
