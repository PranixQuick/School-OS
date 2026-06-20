'use client';
// app/parent/vidya-grid/upgrade/page.tsx
// VG-3 (parent top-up) — upgrade THIS parent's child to paid Vidya Grid.
// Monthly (₹99) or yearly (₹799) via Razorpay; explicit consent checkbox first.
// Own-child is enforced server-side via the parent session.

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Plan = 'monthly' | 'yearly';

declare global {
  interface Window { Razorpay?: new (options: Record<string, unknown>) => { open: () => void } }
}

export default function VidyaGridUpgradePage() {
  const [plan, setPlan] = useState<Plan>('yearly');
  const [consent, setConsent] = useState(false);
  const [rzpReady, setRzpReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (window.Razorpay) { setRzpReady(true); return; }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    s.onload = () => setRzpReady(true);
    s.onerror = () => setError('Could not load the payment library. Check your connection and retry.');
    document.body.appendChild(s);
  }, []);

  async function upgrade() {
    if (!consent) { setError('Please tick the consent box to continue.'); return; }
    if (!rzpReady || !window.Razorpay) { setError('Payment library not ready yet. Please wait a moment.'); return; }
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/parent/vidya-grid/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_order', plan, grant_consent: true }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || 'Could not start the payment.'); setBusy(false); return; }

      const rzp = new window.Razorpay({
        key: d.key_id,
        order_id: d.order_id,
        amount: d.amount_paise,
        currency: d.currency,
        name: 'EdProSys — Vidya Grid',
        description: plan === 'yearly' ? 'Yearly upgrade (₹799)' : 'Monthly upgrade (₹99)',
        handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            const c = await fetch('/api/parent/vidya-grid/subscribe', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'confirm', plan,
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
              }),
            });
            const cd = await c.json().catch(() => ({}));
            if (c.ok) setDone(true); else setError(cd.error || 'Payment could not be confirmed.');
          } catch { setError('Payment confirmation failed. If you were charged, contact your school.'); }
          finally { setBusy(false); }
        },
        modal: { ondismiss: () => setBusy(false) },
        theme: { color: '#4F46E5' },
      });
      rzp.open();
    } catch {
      setError('Network error. Please try again.');
      setBusy(false);
    }
  }

  const price = plan === 'yearly' ? '₹799 / year' : '₹99 / month';

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', paddingBottom: 40 }}>
      <div style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', padding: '16px 16px 22px' }}>
        <Link href="/parent" style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, textDecoration: 'none', fontWeight: 600 }}>← Back</Link>
        <div style={{ color: '#fff', fontSize: 20, fontWeight: 800, marginTop: 10 }}>Upgrade Vidya Grid</div>
        <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 }}>Unlock diagnostics, AI remediation, parent reports & mocks for your child.</div>
      </div>

      <div style={{ padding: 16, maxWidth: 460, margin: '0 auto' }}>
        {done ? (
          <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 14, padding: 20, color: '#065F46' }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>✅ Upgrade active</div>
            <div style={{ fontSize: 14 }}>Your child now has paid Vidya Grid access. It may take a moment to reflect in the app.</div>
            <Link href="/parent" style={{ display: 'inline-block', marginTop: 14, background: '#fff', color: '#065F46', border: '1px solid #A7F3D0', borderRadius: 10, padding: '9px 16px', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>Back to home</Link>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {(['yearly', 'monthly'] as Plan[]).map(p => (
                <button key={p} onClick={() => setPlan(p)}
                  style={{ textAlign: 'left', background: '#fff', border: `2px solid ${plan === p ? '#4F46E5' : '#E5E7EB'}`, borderRadius: 14, padding: 16, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>{p === 'yearly' ? 'Yearly' : 'Monthly'}</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#4F46E5' }}>{p === 'yearly' ? '₹799' : '₹99'}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{p === 'yearly' ? 'Best value — ~₹67/month, billed yearly' : 'Billed monthly'}</div>
                </button>
              ))}
            </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#4B5563', cursor: 'pointer', marginBottom: 14, lineHeight: 1.5 }}>
              <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ marginTop: 2 }} />
              I consent to my child&apos;s learning data being processed by the adaptive learning AI to provide diagnostics, remediation and progress reports.
            </label>

            {error && <div style={{ marginBottom: 12, fontSize: 13, color: '#B91C1C' }}>{error}</div>}

            <button onClick={() => void upgrade()} disabled={busy || !consent}
              style={{ width: '100%', background: (busy || !consent) ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 800, cursor: (busy || !consent) ? 'not-allowed' : 'pointer' }}>
              {busy ? 'Processing…' : `Pay ${price}`}
            </button>
            <div style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 10 }}>Secure payment via Razorpay. Applies to your child only.</div>
          </>
        )}
      </div>
    </div>
  );
}
