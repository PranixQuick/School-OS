'use client';
import { useState, useEffect, useCallback, useMemo, type CSSProperties } from 'react';
import Link from 'next/link';
import { feeTypeDef } from '@/lib/fee-catalog';

interface FeeRow { id: string; fee_type: string; amount: number; due_date: string; paid_date?: string; status: string; }

const INR = (n: number) => '₹' + (Number(n) || 0).toLocaleString('en-IN');
const todayIso = () => new Date().toISOString().slice(0, 10);

function isOverdue(r: FeeRow) {
  return r.status !== 'paid' && (r.status === 'overdue' || (r.due_date && r.due_date < todayIso()));
}

export default function ParentFeesPage() {
  const [fees, setFees] = useState<FeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const loadFees = useCallback(() => {
    setLoading(true);
    fetch('/api/parent/fees')
      .then(r => (r.ok ? r.json() : { fees: [] }))
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
      setBanner(null);
      setPaying(fee.id);
      const r = await fetch('/api/parent/pay', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fee_id: fee.id }) });
      const data = await r.json();
      if (!r.ok) { setBanner({ kind: 'err', text: data.error || 'Could not start payment.' }); return; }
      const Rzp = (window as unknown as { Razorpay?: new (o: unknown) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void } }).Razorpay;
      if (!Rzp) { setBanner({ kind: 'err', text: 'Payment is still loading — please try again in a moment.' }); return; }
      const def = feeTypeDef(fee.fee_type);
      const rzp = new Rzp({
        key: data.key_id,
        order_id: data.order_id,
        amount: data.amount,
        currency: data.currency,
        name: 'EdProSys',
        description: def.label,
        handler: () => { setBanner({ kind: 'ok', text: 'Payment received — updating your fees…' }); setTimeout(loadFees, 1500); },
        modal: { ondismiss: () => {} },
      });
      rzp.on('payment.failed', (resp: unknown) => {
        const desc = (resp as { error?: { description?: string } })?.error?.description;
        setBanner({ kind: 'err', text: 'Payment failed' + (desc ? ': ' + desc : '.') });
      });
      rzp.open();
    } catch (e) {
      setBanner({ kind: 'err', text: 'Error starting payment: ' + (e as Error).message });
    } finally {
      setPaying(null);
    }
  }

  const total = fees.reduce((s, r) => s + Number(r.amount || 0), 0);
  const outstanding = fees.filter(r => r.status !== 'paid').reduce((s, r) => s + Number(r.amount || 0), 0);
  const paidAmt = fees.filter(r => r.status === 'paid').reduce((s, r) => s + Number(r.amount || 0), 0);

  const open = useMemo(() => fees.filter(r => r.status !== 'paid')
    .sort((a, b) => (isOverdue(b) ? 1 : 0) - (isOverdue(a) ? 1 : 0) || (a.due_date || '').localeCompare(b.due_date || '')), [fees]);
  const paid = useMemo(() => fees.filter(r => r.status === 'paid'), [fees]);

  const card: CSSProperties = { background: '#fff', borderRadius: 14, boxShadow: '0 1px 3px rgba(16,24,40,0.06)' };

  function Row({ r }: { r: FeeRow }) {
    const def = feeTypeDef(r.fee_type);
    const over = isOverdue(r);
    const isPaid = r.status === 'paid';
    const accent = isPaid ? '#16A34A' : over ? '#DC2626' : '#D97706';
    return (
      <div style={{ ...card, padding: 14, marginBottom: 10, borderLeft: `4px solid ${accent}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{def.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: '#111827' }}>{def.label}</div>
            <div style={{ fontSize: 12, color: over ? '#DC2626' : '#6B7280', marginTop: 2, fontWeight: over ? 600 : 400 }}>
              {isPaid && r.paid_date
                ? `Paid ${new Date(r.paid_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                : `Due ${r.due_date ? new Date(r.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}${over ? ' · Overdue' : ''}`}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>{INR(r.amount)}</div>
            <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: 0.3, background: isPaid ? '#F0FDF4' : over ? '#FEF2F2' : '#FFFBEB', color: accent }}>
              {isPaid ? 'Paid' : over ? 'Overdue' : 'Pending'}
            </span>
          </div>
        </div>
        {!isPaid && (
          <button onClick={() => payNow(r)} disabled={paying === r.id}
            style={{ marginTop: 12, width: '100%', padding: '11px 0', fontSize: 14, fontWeight: 800, color: '#fff', background: paying === r.id ? '#A5B4FC' : 'linear-gradient(180deg,#6366F1,#4F46E5)', border: 0, borderRadius: 10, cursor: paying === r.id ? 'default' : 'pointer', boxShadow: paying === r.id ? 'none' : '0 1px 2px rgba(79,70,229,0.4)' }}>
            {paying === r.id ? 'Starting…' : `Pay ${INR(r.amount)}`}
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F4F5F7', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        {/* header */}
        <div style={{ background: 'linear-gradient(135deg,#4F46E5 0%,#6D28D9 100%)', padding: '16px 18px 22px' }}>
          <Link href="/parent" style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, textDecoration: 'none', display: 'inline-block', marginBottom: 10 }}>← Back</Link>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>School Fees</div>
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>Pay securely — UPI, card, or net-banking</div>
        </div>

        <div style={{ padding: 16 }}>
          {/* summary */}
          <div style={{ ...card, padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { label: 'Billed', value: INR(total), color: '#111827' },
                { label: 'Outstanding', value: INR(outstanding), color: outstanding > 0 ? '#DC2626' : '#16A34A' },
                { label: 'Paid', value: INR(paidAmt), color: '#16A34A' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {banner && (
            <div style={{ marginBottom: 14, padding: '11px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: banner.kind === 'ok' ? '#F0FDF4' : '#FEF2F2', color: banner.kind === 'ok' ? '#15803D' : '#B91C1C', border: `1px solid ${banner.kind === 'ok' ? '#BBF7D0' : '#FECACA'}` }}>
              {banner.kind === 'ok' ? '✓ ' : '⚠ '}{banner.text}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#9CA3AF' }}>Loading…</div>
          ) : fees.length === 0 ? (
            <div style={{ ...card, textAlign: 'center', padding: 44 }}>
              <div style={{ fontSize: 34 }}>🎉</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginTop: 8 }}>All clear</div>
              <div style={{ fontSize: 12.5, color: '#9CA3AF', marginTop: 2 }}>No fee records found.</div>
            </div>
          ) : (
            <>
              {open.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 2px 8px' }}>
                    To pay · {open.length}
                  </div>
                  {open.map(r => <Row key={r.id} r={r} />)}
                </div>
              )}
              {paid.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 2px 8px' }}>
                    Paid · {paid.length}
                  </div>
                  {paid.map(r => <Row key={r.id} r={r} />)}
                </div>
              )}
            </>
          )}

          <div style={{ textAlign: 'center', marginTop: 18, fontSize: 11, color: '#9CA3AF' }}>
            🔒 Payments are processed securely. Card details never touch EdProSys.
          </div>
        </div>
      </div>
    </div>
  );
}
