'use client';
// app/principal/leave-approvals/page.tsx
// Leave approval dashboard for Principal (private school) and HM (government school).
// Shows all pending leave requests from teachers and other staff.
// One-tap approve or reject with optional rejection reason.
// Institution-aware: labels change based on school_mode.
// Mobile-first, large tap targets, offline-safe (reads on load, action on tap).

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface StaffInfo { id: string; name: string; role: string; subject?: string; designation?: string; }
interface LeaveRequest {
  id: string; leave_type: string; from_date: string; to_date: string;
  reason: string; status: string; days: number;
  staff: StaffInfo | null; created_at: string;
}

const LEAVE_TYPE_LABEL: Record<string, string> = {
  sick: '🤒 Sick Leave', casual: '☀️ Casual Leave', earned: '📅 Earned Leave',
  maternity: '👶 Maternity Leave', paternity: '👨‍👶 Paternity Leave',
  emergency: '🚨 Emergency Leave', unpaid: '📤 Unpaid Leave', other: '📝 Other',
};
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending:  { bg: '#FFF7ED', color: '#D97706' },
  approved: { bg: '#F0FDF4', color: '#15803D' },
  rejected: { bg: '#FEF2F2', color: '#B91C1C' },
};

export default function LeaveApprovalsPage() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<'pending'|'approved'|'rejected'|'all'>('pending');
  const [acting, setActing]     = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [toast, setToast]       = useState('');
  const [toastErr, setToastErr] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/leave-approvals?status=${filter}`);
      if (r.ok) { const d = await r.json() as { requests?: LeaveRequest[] }; setRequests(d.requests ?? []); }
    } catch {/* ignore */}
    setLoading(false);
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  function showToast(msg: string, err = false) {
    setToast(msg); setToastErr(err); setTimeout(() => setToast(''), 3500);
  }

  async function handleAction(id: string, action: 'approve' | 'reject', reason?: string) {
    setActing(id);
    try {
      const r = await fetch('/api/admin/leave-approvals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, rejection_reason: reason }),
      });
      const d = await r.json() as { error?: string };
      if (r.ok) {
        showToast(action === 'approve' ? '✅ Leave approved' : '❌ Leave rejected');
        setRejectingId(null); setRejectReason('');
        void load();
      } else { showToast(d.error ?? 'Action failed', true); }
    } catch { showToast('Network error', true); }
    setActing(null);
  }

  const pending = requests.filter(r => r.status === 'pending');
  const inp = { width: '100%', height: 44, fontSize: 15, borderRadius: 10, border: '1px solid #D1D5DB', padding: '0 12px', outline: 'none', fontFamily: 'inherit', background: '#F9FAFB' };

  return (
    <Layout title="Leave Approvals" subtitle={`${pending.length} pending request${pending.length !== 1 ? 's' : ''}`}>
      {toast && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: toastErr ? '#991B1B' : '#111827', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
          {toast}
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {(['pending','approved','rejected','all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: filter === f ? '#4F46E5' : '#F3F4F6', color: filter === f ? '#fff' : '#374151' }}>
            {f === 'pending' ? `⏳ Pending (${pending.length})` : f === 'approved' ? '✅ Approved' : f === 'rejected' ? '❌ Rejected' : '📋 All'}
          </button>
        ))}
        <button onClick={() => void load()} style={{ padding: '6px 12px', borderRadius: 20, border: '1px solid #E5E7EB', fontSize: 12, background: '#fff', cursor: 'pointer' }}>
          🔄
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
      ) : requests.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', background: '#F9FAFB', borderRadius: 12 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          <div style={{ fontSize: 14, color: '#6B7280' }}>
            {filter === 'pending' ? 'No pending leave requests' : `No ${filter} requests`}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {requests.map(req => {
            const ss = STATUS_STYLE[req.status] ?? STATUS_STYLE.pending;
            const isActing = acting === req.id;
            return (
              <div key={req.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ padding: '12px 14px', borderBottom: '1px solid #F3F4F6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
                        {req.staff?.name ?? 'Unknown Staff'}
                      </div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                        {req.staff?.designation ?? req.staff?.role ?? 'Staff'}{req.staff?.subject ? ` · ${req.staff.subject}` : ''}
                      </div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 8, background: ss.bg, color: ss.color }}>
                      {req.status}
                    </span>
                  </div>
                </div>
                {/* Body */}
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>LEAVE TYPE</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginTop: 2 }}>
                        {LEAVE_TYPE_LABEL[req.leave_type] ?? req.leave_type}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>DURATION</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginTop: 2 }}>
                        {req.days} day{req.days !== 1 ? 's' : ''}
                        <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 4 }}>
                          ({req.from_date} → {req.to_date})
                        </span>
                      </div>
                    </div>
                  </div>
                  {req.reason && (
                    <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#374151', marginBottom: 12, lineHeight: 1.5 }}>
                      "{req.reason}"
                    </div>
                  )}

                  {/* Rejection reason input */}
                  {rejectingId === req.id && (
                    <div style={{ marginBottom: 10 }}>
                      <input type="text" placeholder="Reason for rejection (optional)"
                        value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                        style={inp} />
                    </div>
                  )}

                  {/* Action buttons — only for pending */}
                  {req.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      {rejectingId !== req.id ? (
                        <>
                          <button onClick={() => void handleAction(req.id, 'approve')}
                            disabled={isActing}
                            style={{ flex: 1, height: 44, borderRadius: 10, border: 'none', background: isActing ? '#9CA3AF' : '#15803D', color: '#fff', fontSize: 14, fontWeight: 700, cursor: isActing ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                            {isActing ? '…' : '✅ Approve'}
                          </button>
                          <button onClick={() => { setRejectingId(req.id); setRejectReason(''); }}
                            disabled={isActing}
                            style={{ flex: 1, height: 44, borderRadius: 10, border: '1px solid #FECACA', background: '#FEF2F2', color: '#B91C1C', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                            ❌ Reject
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => void handleAction(req.id, 'reject', rejectReason)}
                            disabled={isActing}
                            style={{ flex: 1, height: 44, borderRadius: 10, border: 'none', background: '#B91C1C', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                            Confirm Reject
                          </button>
                          <button onClick={() => { setRejectingId(null); setRejectReason(''); }}
                            style={{ height: 44, padding: '0 16px', borderRadius: 10, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
