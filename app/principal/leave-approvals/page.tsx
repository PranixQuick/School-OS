'use client';
// app/principal/leave-approvals/page.tsx
// Leave approval dashboard for Principal (private school) and HM (government school).
// Shows all pending leave requests from teachers and other staff.
// One-tap approve or reject with optional rejection reason.
// Institution-aware: labels change based on school_mode.
// Mobile-first, large tap targets, offline-safe (reads on load, action on tap).

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface StaffInfo { id: string; name: string; role: string; subject?: string; designation?: string; email?: string; }
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

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [coverageData, setCoverageData] = useState<Record<string, any>>({});
  const [coverageLoading, setCoverageLoading] = useState<string | null>(null);
  const [showRoster, setShowRoster] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/leave-approvals?status=${filter}`);
      if (r.ok) { const d = await r.json() as { requests?: LeaveRequest[] }; setRequests(d.requests ?? []); }
    } catch {/* ignore */}
    setLoading(false);
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!coverageData[id]) {
      setCoverageLoading(id);
      try {
        const r = await fetch(`/api/admin/leave-approvals/${id}/coverage`);
        if (r.ok) {
          const d = await r.json();
          setCoverageData(prev => ({ ...prev, [id]: d.coverage }));
        }
      } catch (err) {
        console.error('Failed to load coverage:', err);
      }
      setCoverageLoading(null);
    }
  };

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

      {/* Statistics Dashboard */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <div style={{ background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)', padding: 14, borderRadius: 12, border: '1px solid #C7D2FE' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4F46E5', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Requests</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#1E1B4B', marginTop: 4 }}>{requests.length}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)', padding: 14, borderRadius: 12, border: '1px solid #FDBA74' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.5px' }}>⏳ Pending</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#7C2D12', marginTop: 4 }}>{requests.filter(r => r.status === 'pending').length}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)', padding: 14, borderRadius: 12, border: '1px solid #86EFAC' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>✅ Approved</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#064E3B', marginTop: 4 }}>{requests.filter(r => r.status === 'approved').length}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)', padding: 14, borderRadius: 12, border: '1px solid #FCA5A5' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.5px' }}>❌ Rejected</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#7F1D1D', marginTop: 4 }}>{requests.filter(r => r.status === 'rejected').length}</div>
        </div>
      </div>

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
              <div key={req.id} onClick={() => void toggleExpand(req.id)}
                style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden', cursor: 'pointer' }}>
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
                    <div style={{ marginBottom: 10 }} onClick={(e) => e.stopPropagation()}>
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
                          <button onClick={(e) => { e.stopPropagation(); void handleAction(req.id, 'approve'); }}
                            disabled={isActing}
                            style={{ flex: 1, height: 44, borderRadius: 10, border: 'none', background: isActing ? '#9CA3AF' : '#15803D', color: '#fff', fontSize: 14, fontWeight: 700, cursor: isActing ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                            {isActing ? '…' : '✅ Approve'}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setRejectingId(req.id); setRejectReason(''); }}
                            disabled={isActing}
                            style={{ flex: 1, height: 44, borderRadius: 10, border: '1px solid #FECACA', background: '#FEF2F2', color: '#B91C1C', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                            ❌ Reject
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); void handleAction(req.id, 'reject', rejectReason); }}
                            disabled={isActing}
                            style={{ flex: 1, height: 44, borderRadius: 10, border: 'none', background: '#B91C1C', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                            Confirm Reject
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setRejectingId(null); setRejectReason(''); }}
                            style={{ height: 44, padding: '0 16px', borderRadius: 10, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Expanded Coverage Details */}
                  {expandedId === req.id && (
                    <div style={{ marginTop: 12, borderTop: '1px dashed #E5E7EB', paddingTop: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                        📧 Contact Email: <span style={{ fontWeight: 500, color: '#6B7280' }}>{req.staff?.email ?? 'N/A'}</span>
                      </div>

                      {coverageLoading === req.id ? (
                        <div style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic', padding: '6px 0' }}>Loading rosters & assignments…</div>
                      ) : !coverageData[req.id] || coverageData[req.id].length === 0 ? (
                        <div style={{ fontSize: 12, color: '#6B7280', fontStyle: 'italic', padding: '6px 0' }}>No class assignments registered for this teacher.</div>
                      ) : (
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#4F46E5', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Class Coverage Impact</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {(coverageData[req.id] ?? []).map((cov: any, idx: number) => {
                              const rosterKey = `${req.id}-${cov.class}-${cov.section}`;
                              const isRosterVisible = !!showRoster[rosterKey];
                              return (
                                <div key={idx} style={{ background: '#F9FAFB', borderRadius: 10, padding: 12, border: '1px solid #EEF2FF' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                                    <div>
                                      <span style={{ fontWeight: 800, fontSize: 14, color: '#1E1B4B' }}>Class {cov.class}-{cov.section}</span>
                                      {cov.is_class_teacher && (
                                        <span style={{ marginLeft: 6, padding: '2px 6px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: '#FEF3C7', color: '#D97706', border: '1px solid #FDE68A' }}>
                                          Class Teacher
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: 12, color: '#6B7280' }}>
                                      Subjects: <span style={{ fontWeight: 600, color: '#374151' }}>{cov.subjects.join(', ') || 'N/A'}</span>
                                    </div>
                                  </div>

                                  <div style={{ marginTop: 8 }}>
                                    <button onClick={(e) => { e.stopPropagation(); setShowRoster(prev => ({ ...prev, [rosterKey]: !isRosterVisible })); }}
                                      style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', color: '#4F46E5', fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 6, cursor: 'pointer' }}>
                                      {isRosterVisible ? 'Hide Student Roster ▲' : `Show Student Roster (${cov.students.length}) ▼`}
                                    </button>
                                  </div>

                                  {isRosterVisible && (
                                    <div style={{ marginTop: 8, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, maxHeight: 150, overflowY: 'auto', padding: 8 }} onClick={(e) => e.stopPropagation()}>
                                      {cov.students.length === 0 ? (
                                        <div style={{ fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' }}>No students in this class.</div>
                                      ) : (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                          {cov.students.map((stu: any, sIdx: number) => (
                                            <div key={stu.id} style={{ fontSize: 12, color: '#374151', display: 'flex', gap: 4 }}>
                                              <span style={{ color: '#9CA3AF', fontWeight: 600 }}>{sIdx + 1}.</span>
                                              <span>{stu.name}</span>
                                              {stu.roll_number && <span style={{ color: '#9CA3AF', fontSize: 10 }}>(Roll {stu.roll_number})</span>}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
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
