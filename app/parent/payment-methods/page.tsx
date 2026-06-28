'use client';
// app/parent/payment-methods/page.tsx
// "Ways to pay your school" — the institution's own acceptance details (UPI, bank,
// cash, cheque) plus the in-app online option. Money goes to the school directly;
// EdProSys never holds it.
import { useState, useEffect, type CSSProperties } from 'react';
import Link from 'next/link';

interface Modes {
  upi?: { vpa: string; payee_name: string | null };
  bank?: { account_name: string | null; account_number: string; ifsc: string | null; bank_name: string | null; branch: string | null };
  cash?: { instructions: string | null };
  cheque?: { payable_to: string | null; instructions: string | null };
}
interface Payload { school_name: string; online_enabled: boolean; note: string | null; modes: Modes }

const card: CSSProperties = { background: '#fff', borderRadius: 14, boxShadow: '0 1px 3px rgba(16,24,40,0.06)', padding: 16, marginBottom: 12 };

function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }).catch(() => {}); }}
      style={{ fontSize: 11, fontWeight: 700, color: '#4F46E5', background: '#EEF2FF', border: 0, borderRadius: 8, padding: '4px 10px', cursor: 'pointer', flexShrink: 0 }}>
      {done ? '✓ Copied' : 'Copy'}
    </button>
  );
}

function Field({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: '#9CA3AF' }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', wordBreak: 'break-word' }}>{value}</div>
      </div>
      {copy && <Copy text={value} />}
    </div>
  );
}

export default function ParentPaymentMethodsPage() {
  const [d, setD] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/parent/payment-modes')
      .then(r => r.ok ? r.json() : null)
      .then(setD).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const page: CSSProperties = { minHeight: '100vh', background: '#F4F5F7', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' };
  const modes = d?.modes ?? {};
  const hasAny = d && (d.online_enabled || Object.keys(modes).length > 0);

  return (
    <div style={page}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <div style={{ background: 'linear-gradient(135deg,#4F46E5 0%,#6D28D9 100%)', padding: '16px 18px 22px' }}>
          <Link href="/parent/fees" style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, textDecoration: 'none', display: 'inline-block', marginBottom: 10 }}>← Fees</Link>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>Ways to pay</div>
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.82)', marginTop: 2 }}>Pay {d?.school_name ?? 'your school'} directly</div>
        </div>

        <div style={{ padding: 16 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading…</div>
          ) : !hasAny ? (
            <div style={{ ...card, textAlign: 'center', padding: 36 }}>
              <div style={{ fontSize: 32 }}>🏫</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginTop: 8 }}>No payment details published yet</div>
              <div style={{ fontSize: 12.5, color: '#9CA3AF', marginTop: 4 }}>Please contact the school office.</div>
            </div>
          ) : (
            <>
              {d?.online_enabled && (
                <Link href="/parent/fees" style={{ display: 'block', textDecoration: 'none' }}>
                  <div style={{ ...card, border: '1px solid #C7D2FE', background: '#EEF2FF', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 24 }}>💳</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 800, color: '#3730A3' }}>Pay online (UPI, card, net-banking)</div>
                      <div style={{ fontSize: 12, color: '#4338CA' }}>Instant — open a fee and tap Pay</div>
                    </div>
                    <div style={{ fontSize: 18, color: '#4F46E5' }}>›</div>
                  </div>
                </Link>
              )}

              {modes.upi && (
                <div style={card}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 4 }}>📲 UPI</div>
                  <Field label="UPI ID" value={modes.upi.vpa} copy />
                  {modes.upi.payee_name && <Field label="Payee" value={modes.upi.payee_name} />}
                </div>
              )}

              {modes.bank && (
                <div style={card}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 4 }}>🏦 Bank transfer (NEFT/IMPS)</div>
                  {modes.bank.account_name && <Field label="Account name" value={modes.bank.account_name} />}
                  <Field label="Account number" value={modes.bank.account_number} copy />
                  {modes.bank.ifsc && <Field label="IFSC" value={modes.bank.ifsc} copy />}
                  {modes.bank.bank_name && <Field label="Bank" value={[modes.bank.bank_name, modes.bank.branch].filter(Boolean).join(' · ')} />}
                </div>
              )}

              {modes.cash && (
                <div style={card}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 4 }}>💵 Cash</div>
                  <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{modes.cash.instructions || 'Pay at the school office.'}</div>
                </div>
              )}

              {modes.cheque && (
                <div style={card}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 4 }}>🧾 Cheque / DD</div>
                  {modes.cheque.payable_to && <Field label="Payable to" value={modes.cheque.payable_to} />}
                  {modes.cheque.instructions && <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5, marginTop: 6 }}>{modes.cheque.instructions}</div>}
                </div>
              )}

              {d?.note && (
                <div style={{ ...card, background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                  <div style={{ fontSize: 12.5, color: '#92400E', lineHeight: 1.5 }}>ℹ️ {d.note}</div>
                </div>
              )}

              <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: '#9CA3AF', lineHeight: 1.5 }}>
                Payments are collected by the school directly. After paying offline, the office will mark your fee paid and issue a receipt.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
