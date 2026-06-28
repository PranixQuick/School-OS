'use client';
// app/admin/payment-modes/page.tsx
// Configure how the institution accepts fees directly: UPI, bank transfer, cash, cheque.
// EdProSys never holds funds — these details are shown to parents/staff as "ways to pay".
// Online card/UPI (Razorpay, the school's own account) is configured under Settings.

import { useState, useEffect, type ReactNode } from 'react';
import Layout from '@/components/Layout';

interface PaymentModes {
  upi: { enabled: boolean; vpa: string; payee_name: string };
  bank: { enabled: boolean; account_name: string; account_number: string; ifsc: string; bank_name: string; branch: string };
  cash: { enabled: boolean; instructions: string };
  cheque: { enabled: boolean; payable_to: string; instructions: string };
  note: string;
}

const BLANK: PaymentModes = {
  upi: { enabled: false, vpa: '', payee_name: '' },
  bank: { enabled: false, account_name: '', account_number: '', ifsc: '', bank_name: '', branch: '' },
  cash: { enabled: false, instructions: '' },
  cheque: { enabled: false, payable_to: '', instructions: '' },
  note: '',
};

const card = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 18, marginBottom: 16 } as const;
const input = { width: '100%', padding: '9px 11px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' as const, background: '#F9FAFB' };
const lbl = { display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280', margin: '10px 0 4px' } as const;

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} type="button" aria-pressed={on}
      style={{ position: 'relative', width: 40, height: 22, borderRadius: 99, border: 0, cursor: 'pointer', background: on ? '#4F46E5' : '#D1D5DB', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: 99, background: '#fff', transition: 'left .15s' }} />
    </button>
  );
}

export default function PaymentModesPage() {
  const [pm, setPm] = useState<PaymentModes>(BLANK);
  const [onlineEnabled, setOnlineEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    fetch('/api/admin/settings/payment-modes')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setPm({ ...BLANK, ...d.payment_modes }); setOnlineEnabled(!!d.online_enabled); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function up<K extends keyof PaymentModes>(k: K, patch: Partial<PaymentModes[K]>) {
    setPm(prev => ({ ...prev, [k]: { ...(prev[k] as object), ...patch } }));
  }

  async function save() {
    setSaving(true); setToast(null);
    try {
      const r = await fetch('/api/admin/settings/payment-modes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payment_modes: pm }),
      });
      const d = await r.json().catch(() => ({}));
      setToast(r.ok ? { ok: true, msg: '✓ Saved' } : { ok: false, msg: d.error ?? 'Could not save' });
    } catch { setToast({ ok: false, msg: 'Network error' }); }
    finally { setSaving(false); setTimeout(() => setToast(null), 3500); }
  }

  const section = (title: string, icon: string, on: boolean, toggle: () => void, body: ReactNode) => (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>{icon} {title}</div>
        <Toggle on={on} onClick={toggle} />
      </div>
      {on && <div style={{ marginTop: 10 }}>{body}</div>}
    </div>
  );

  return (
    <Layout title="Payment acceptance" subtitle="How parents can pay your school directly — EdProSys never holds the money">
      {toast && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#fff', background: toast.ok ? '#065F46' : '#991B1B' }}>{toast.msg}</div>
      )}

      <div style={{ ...card, background: '#EEF2FF', border: '1px solid #C7D2FE' }}>
        <div style={{ fontSize: 12.5, color: '#3730A3', lineHeight: 1.6 }}>
          Money is collected by <b>your institution directly</b>. These details appear to parents and staff as “ways to pay”.
          Online card/UPI settles to your own gateway account and is {onlineEnabled ? <b>enabled</b> : <b>off</b>} (configure it under Settings → Payment configuration).
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
      ) : (
        <>
          {section('UPI', '📲', pm.upi.enabled, () => up('upi', { enabled: !pm.upi.enabled }), (
            <>
              <label style={lbl}>UPI ID (VPA) *</label>
              <input style={input} value={pm.upi.vpa} onChange={e => up('upi', { vpa: e.target.value })} placeholder="school@okhdfcbank" />
              <label style={lbl}>Payee name (as shown in UPI app)</label>
              <input style={input} value={pm.upi.payee_name} onChange={e => up('upi', { payee_name: e.target.value })} placeholder="Suchitra Academy" />
            </>
          ))}

          {section('Bank transfer (NEFT/IMPS)', '🏦', pm.bank.enabled, () => up('bank', { enabled: !pm.bank.enabled }), (
            <>
              <label style={lbl}>Account name *</label>
              <input style={input} value={pm.bank.account_name} onChange={e => up('bank', { account_name: e.target.value })} placeholder="Suchitra Academy" />
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>Account number *</label>
                  <input style={input} value={pm.bank.account_number} onChange={e => up('bank', { account_number: e.target.value })} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>IFSC *</label>
                  <input style={input} value={pm.bank.ifsc} onChange={e => up('bank', { ifsc: e.target.value.toUpperCase() })} placeholder="HDFC0000123" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>Bank name</label>
                  <input style={input} value={pm.bank.bank_name} onChange={e => up('bank', { bank_name: e.target.value })} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>Branch</label>
                  <input style={input} value={pm.bank.branch} onChange={e => up('bank', { branch: e.target.value })} />
                </div>
              </div>
            </>
          ))}

          {section('Cash (at office)', '💵', pm.cash.enabled, () => up('cash', { enabled: !pm.cash.enabled }), (
            <>
              <label style={lbl}>Instructions for parents</label>
              <input style={input} value={pm.cash.instructions} onChange={e => up('cash', { instructions: e.target.value })} placeholder="Pay at the front office, Mon–Sat 9am–3pm" />
            </>
          ))}

          {section('Cheque / DD', '🧾', pm.cheque.enabled, () => up('cheque', { enabled: !pm.cheque.enabled }), (
            <>
              <label style={lbl}>Payable to</label>
              <input style={input} value={pm.cheque.payable_to} onChange={e => up('cheque', { payable_to: e.target.value })} placeholder="Suchitra Academy" />
              <label style={lbl}>Instructions</label>
              <input style={input} value={pm.cheque.instructions} onChange={e => up('cheque', { instructions: e.target.value })} placeholder="Submit at the accounts desk with the student name + class" />
            </>
          ))}

          <div style={card}>
            <label style={lbl}>Note to parents (optional)</label>
            <input style={input} value={pm.note} onChange={e => setPm(p => ({ ...p, note: e.target.value }))} placeholder="Always mention the student name and class in the payment reference." />
          </div>

          <button onClick={save} disabled={saving}
            style={{ padding: '11px 26px', background: saving ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 0, borderRadius: 9, fontSize: 14, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving…' : 'Save payment acceptance'}
          </button>
        </>
      )}
    </Layout>
  );
}
