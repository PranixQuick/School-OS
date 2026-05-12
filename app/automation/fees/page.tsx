'use client';

// PATH: app/automation/fees/page.tsx
// Item #13 — Admin fee management view.
// Auth: school session cookie (middleware). Roles: owner | principal | admin_staff | accountant.
//
// Features:
//  - List all fees with status filter + class filter
//  - Mark Paid dropdown: Cash / Cheque / Waiver
//  - pending_verification rows: Verify Payment + screenshot link
//  - Discount badge on rows with discount_amount > 0

import { useState, useEffect, FormEvent } from 'react';
import Layout from '@/components/Layout';

interface FeeRow {
  id: string;
  student_id: string;
  amount: number;
  original_amount: number | null;
  due_date: string;
  paid_date: string | null;
  status: string;
  fee_type: string | null;
  description: string | null;
  fee_receipt_number: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  payment_screenshot_url: string | null;
  payment_verified_at: string | null;
  discount_amount: number | null;
  discount_reason: string | null;
  students: { name: string; class: string | null; section: string | null } | null;
}

const STATUS_BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  pending:              { bg: '#FEF3C7', fg: '#92400E', label: 'Pending' },
  overdue:              { bg: '#FEE2E2', fg: '#991B1B', label: 'Overdue' },
  paid:                 { bg: '#D1FAE5', fg: '#065F46', label: 'Paid' },
  waived:               { bg: '#E0E7FF', fg: '#3730A3', label: 'Waived' },
  partial:              { bg: '#DBEAFE', fg: '#1E40AF', label: 'Partial' },
  pending_verification: { bg: '#FEF9C3', fg: '#713F12', label: 'Pending Verification' },
};

export default function AdminFeesPage() {
  const [fees, setFees] = useState<FeeRow[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');

  // Mark-paid modal
  const [markModal, setMarkModal] = useState<{ feeId: string; studentName: string } | null>(null);
  const [markMethod, setMarkMethod] = useState<'cash' | 'cheque' | 'waiver' | 'other'>('cash');
  const [markRef, setMarkRef] = useState('');
  const [discountAmt, setDiscountAmt] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [markSaving, setMarkSaving] = useState(false);
  const [markError, setMarkError] = useState('');

  // Verify-payment
  const [verifyId, setVerifyId] = useState<string | null>(null);
  const [verifySaving, setVerifySaving] = useState(false);

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  async function loadFees() {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (classFilter) params.set('class', classFilter);
    params.set('limit', '200');
    const res = await fetch('/api/admin/fees?' + params.toString());
    const d = await res.json();
    setFees(d.fees ?? []);
    setSummary(d.summary ?? {});
    setLoading(false);
  }

  useEffect(() => { void loadFees(); }, [statusFilter, classFilter]);

  async function submitMarkPaid(e: FormEvent) {
    e.preventDefault();
    if (!markModal) return;
    setMarkSaving(true);
    setMarkError('');
    const body: Record<string, unknown> = { method: markMethod };
    if (markRef.trim()) body.reference = markRef.trim();
    if (markMethod === 'waiver' && discountAmt) {
      body.discount_amount = parseFloat(discountAmt);
      body.discount_reason = discountReason;
    }
    const res = await fetch(`/api/admin/fees/${markModal.feeId}/mark-paid`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    setMarkSaving(false);
    if (!res.ok) { setMarkError(d.error ?? 'Failed'); return; }
    setMarkModal(null);
    showToast('Fee marked as ' + (markMethod === 'waiver' ? 'waived' : 'paid'), true);
    void loadFees();
  }

  async function handleVerify(feeId: string, approved: boolean) {
    setVerifyId(feeId);
    setVerifySaving(true);
    const res = await fetch(`/api/admin/fees/${feeId}/verify-payment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved }),
    });
    const d = await res.json();
    setVerifySaving(false);
    setVerifyId(null);
    if (!res.ok) { showToast(d.error ?? 'Failed', false); return; }
    showToast(approved ? 'Payment verified' : 'Payment rejected — reverted to pending', approved);
    void loadFees();
  }

  function openMarkModal(fee: FeeRow) {
    setMarkModal({ feeId: fee.id, studentName: fee.students?.name ?? 'Unknown' });
    setMarkMethod('cash'); setMarkRef(''); setDiscountAmt(''); setDiscountReason(''); setMarkError('');
  }

  const statusFilters = ['', 'pending', 'overdue', 'pending_verification', 'paid', 'waived', 'partial'];

  return (
    <Layout title="Fee Management" subtitle={`${fees.length} records`}>
      {toast && (
        <div style={{
          position: 'fixed', top: 16, right: 16, zIndex: 9999,
          background: toast.ok ? '#D1FAE5' : '#FEE2E2',
          color: toast.ok ? '#065F46' : '#991B1B',
          padding: '10px 18px', borderRadius: 8, fontWeight: 600, fontSize: 13, boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        }}>{toast.msg}</div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 13, background: '#fff' }}>
          {statusFilters.map(s => (
            <option key={s} value={s}>{s ? STATUS_BADGE[s]?.label ?? s : 'All Statuses'}</option>
          ))}
        </select>
        <input value={classFilter} onChange={e => setClassFilter(e.target.value)}
          placeholder="Filter by class (e.g. 5)"
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 13, width: 160 }} />
      </div>

      {/* Summary strip */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {Object.entries(STATUS_BADGE).map(([s, b]) => summary[s] ? (
          <div key={s} style={{ background: b.bg, color: b.fg, padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            onClick={() => setStatusFilter(s)}>
            {b.label}: {summary[s]}
          </div>
        ) : null)}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>Loading...</div>
      ) : fees.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 36 }}>₹</div>
          <div style={{ color: '#6B7280', marginTop: 8 }}>No fee records found</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {fees.map(f => {
            const b = STATUS_BADGE[f.status] ?? STATUS_BADGE['pending'];
            const canMarkPaid = ['pending', 'overdue'].includes(f.status);
            const isPendingVerify = f.status === 'pending_verification';
            const hasDiscount = (f.discount_amount ?? 0) > 0;
            const studentLabel = f.students
              ? `${f.students.name} · Grade ${f.students.class ?? '?'}${f.students.section ? '-' + f.students.section : ''}`
              : '—';

            return (
              <div key={f.id} style={{
                background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px',
                borderLeft: '4px solid ' + b.bg,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{studentLabel}</div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                      {f.fee_type ?? 'Fee'}{f.description ? ' · ' + f.description : ''} · Due {f.due_date}
                    </div>
                    {f.fee_receipt_number && (
                      <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>Receipt #{f.fee_receipt_number}</div>
                    )}
                    {hasDiscount && (
                      <span style={{ display: 'inline-block', marginTop: 4, background: '#E0E7FF', color: '#3730A3', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
                        Discount ₹{Math.round(f.discount_amount!)} — {f.discount_reason}
                      </span>
                    )}
                    {isPendingVerify && f.payment_screenshot_url && (
                      <div style={{ marginTop: 4 }}>
                        <a href={f.payment_screenshot_url} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 11, color: '#4F46E5', textDecoration: 'underline' }}>View screenshot →</a>
                        {f.payment_reference && <span style={{ fontSize: 11, color: '#6B7280', marginLeft: 8 }}>Ref: {f.payment_reference}</span>}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>
                      ₹{Math.round(Number(f.amount)).toLocaleString('en-IN')}
                    </div>
                    <span style={{ background: b.bg, color: b.fg, padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{b.label}</span>

                    {canMarkPaid && (
                      <button onClick={() => openMarkModal(f)}
                        style={{ padding: '6px 14px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        Mark Paid
                      </button>
                    )}

                    {isPendingVerify && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => handleVerify(f.id, true)}
                          disabled={verifySaving && verifyId === f.id}
                          style={{ padding: '5px 12px', background: '#065F46', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                          ✓ Approve
                        </button>
                        <button onClick={() => handleVerify(f.id, false)}
                          disabled={verifySaving && verifyId === f.id}
                          style={{ padding: '5px 12px', background: '#991B1B', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                          ✕ Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Mark-paid modal */}
      {markModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 380, boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Mark Paid — {markModal.studentName}</div>
            <form onSubmit={submitMarkPaid}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>PAYMENT METHOD</label>
                <select value={markMethod} onChange={e => setMarkMethod(e.target.value as typeof markMethod)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13 }}>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="other">Other Transfer</option>
                  <option value="waiver">Waiver / Write-off</option>
                </select>
              </div>
              {markMethod !== 'waiver' && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>REFERENCE (optional)</label>
                  <input value={markRef} onChange={e => setMarkRef(e.target.value)} placeholder="Cheque no, UTR, etc."
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              )}
              {markMethod === 'waiver' && (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>DISCOUNT AMOUNT (₹)</label>
                    <input type="number" min="0" value={discountAmt} onChange={e => setDiscountAmt(e.target.value)}
                      placeholder="Amount waived"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>REASON (required)</label>
                    <input value={discountReason} onChange={e => setDiscountReason(e.target.value)} required placeholder="Scholarship, hardship, etc."
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                </>
              )}
              {markError && <div style={{ color: '#991B1B', fontSize: 12, marginBottom: 10 }}>{markError}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button type="button" onClick={() => setMarkModal(null)}
                  style={{ flex: 1, padding: '10px', background: '#F3F4F6', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" disabled={markSaving}
                  style={{ flex: 2, padding: '10px', background: markMethod === 'waiver' ? '#6D28D9' : '#065F46', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: markSaving ? 'not-allowed' : 'pointer' }}>
                  {markSaving ? 'Saving...' : markMethod === 'waiver' ? 'Apply Waiver' : 'Confirm Paid'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
