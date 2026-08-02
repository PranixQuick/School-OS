'use client';
// components/PayrollRunActions.tsx
// Approval-chain action buttons for a payroll run. Renders only the buttons valid
// for the run's current status AND the viewer's role. The server
// (PATCH /api/admin/payroll/runs/[id]) is the source of truth and re-checks all
// of this — the client gating is purely to avoid showing dead buttons.
//
// Drop into the payroll run detail view:
//   <PayrollRunActions run={selectedRun} role={viewerRole} onUpdated={(r) => {
//     setSelectedRun(r); setRuns(p => p.map(x => x.id === r.id ? r : x));
//   }} />

import { useState, type CSSProperties } from 'react';

type RunLite = { id: string; status: string };
type Action = 'submit_for_review' | 'review' | 'approve' | 'submit_to_bank' | 'mark_paid' | 'cancel';

const BTN: Record<Action, { label: string; from: string[]; roles: string[]; tone: 'primary' | 'ghost' | 'danger' }> = {
  submit_for_review: { label: 'Send for review',        from: ['draft'],                                              roles: ['accountant', 'admin', 'owner'], tone: 'primary' },
  review:            { label: 'Review → send to owner', from: ['pending_review'],                                 roles: ['admin', 'principal', 'owner'],  tone: 'primary' },
  approve:           { label: 'Approve',                from: ['draft', 'pending_owner'],                             roles: ['owner', 'admin'],               tone: 'primary' },
  submit_to_bank:    { label: 'Submit to bank',         from: ['approved'],                                           roles: ['accountant', 'owner'],          tone: 'primary' },
  mark_paid:         { label: 'Mark paid',              from: ['approved', 'submitted'],                              roles: ['owner', 'admin', 'accountant'], tone: 'ghost' },
  cancel:            { label: 'Cancel',                 from: ['draft', 'pending_review', 'pending_owner', 'approved'], roles: ['owner', 'admin'],              tone: 'danger' },
};

const TONE: Record<string, CSSProperties> = {
  primary: { background: '#1E1B4B', color: '#fff' },
  ghost:   { background: '#fff', color: '#1E1B4B', border: '1px solid #C7D2FE' },
  danger:  { background: '#fff', color: '#B91C1C', border: '1px solid #FECACA' },
};

export default function PayrollRunActions({ run, role, onUpdated }: { run: RunLite; role: string; onUpdated?: (run: unknown) => void }) {
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  async function act(action: Action) {
    setBusy(action); setErr('');
    try {
      const res = await fetch(`/api/admin/payroll/runs/${run.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error ?? 'Action failed'); return; }
      onUpdated?.(d.run);
    } catch { setErr('Network error'); }
    finally { setBusy(''); }
  }

  const available = (Object.keys(BTN) as Action[]).filter(
    (a) => BTN[a].from.includes(run.status) && BTN[a].roles.includes(role),
  );
  const showBankFile = ['approved', 'submitted'].includes(run.status) && ['owner', 'admin', 'accountant'].includes(role);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      {available.map((a) => (
        <button
          key={a}
          disabled={!!busy}
          onClick={() => act(a)}
          style={{ ...TONE[BTN[a].tone], padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: busy ? 'wait' : 'pointer', opacity: busy && busy !== a ? 0.6 : 1 }}
        >
          {busy === a ? '…' : BTN[a].label}
        </button>
      ))}
      {showBankFile && (
        <>
          <a href={`/api/admin/payroll/export?run_id=${run.id}&format=icici_bizpay`} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#ECFDF5', color: '#065F46', textDecoration: 'none', border: '1px solid #A7F3D0' }}>
            &#8595; ICICI BizPay file
          </a>
          <a href={`/api/admin/payroll/export?run_id=${run.id}&format=neft`} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#EFF6FF', color: '#1D4ED8', textDecoration: 'none', border: '1px solid #BFDBFE' }}>
            &#8595; NEFT file
          </a>
        </>
      )}
      {err && <span style={{ color: '#B91C1C', fontSize: 12 }}>{err}</span>}
    </div>
  );
}
