'use client';
// PATH: app/admin/data-privacy/page.tsx
// Item #3 DPDP Compliance — PR #2
// Admin DSR management: list, complete, reject, anonymize.

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

interface DSR {
  id: string; requester_type: string; requester_id: string; requester_name: string | null;
  request_type: string; status: string; requested_at: string; completed_at: string | null;
  rejection_reason: string | null; export_url: string | null; notes: string | null;
}

const STATUS_BADGE: Record<string, { bg: string; fg: string }> = {
  pending:     { bg: '#FEF3C7', fg: '#92400E' },
  in_progress: { bg: '#DBEAFE', fg: '#1E40AF' },
  completed:   { bg: '#D1FAE5', fg: '#065F46' },
  rejected:    { bg: '#FEE2E2', fg: '#991B1B' },
};

const cardStyle = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 0, overflow: 'hidden' };
const inputStyle = { width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: 13, boxSizing: 'border-box' as const };

export default function DataPrivacyPage() {
  const [dsrs, setDsrs] = useState<DSR[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // New DSR modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newReqType, setNewReqType] = useState('export');
  const [newRequesterType, setNewRequesterType] = useState('parent');
  const [newRequesterId, setNewRequesterId] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Complete modal
  const [completeModal, setCompleteModal] = useState<{ id: string; requestType: string } | null>(null);
  const [exportUrl, setExportUrl] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [completeAction, setCompleteAction] = useState<'complete' | 'reject'>('complete');

  // Anonymize confirm modal
  const [anonModal, setAnonModal] = useState<{ id: string; name: string | null } | null>(null);

  useEffect(() => { void load(); }, [statusFilter]);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/data-subject-requests?status=${statusFilter}`);
    if (res.ok) { const d = await res.json(); setDsrs(d.data_subject_requests ?? []); }
    setLoading(false);
  }

  function showToast(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); }

  async function submitComplete() {
    if (!completeModal) return;
    setActionLoading(completeModal.id + 'complete');
    const res = await fetch(`/api/admin/data-subject-requests/${completeModal.id}/complete`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: completeAction, export_url: exportUrl || null, rejection_reason: rejectReason || null }),
    });
    const d = await res.json();
    if (res.ok) { showToast(`DSR ${completeAction === 'complete' ? 'completed' : 'rejected'}`); setCompleteModal(null); void load(); }
    else showToast(d.error ?? 'Failed', false);
    setActionLoading(null);
  }

  async function submitAnon() {
    if (!anonModal) return;
    setActionLoading(anonModal.id + 'anon');
    const res = await fetch(`/api/admin/data-subject-requests/${anonModal.id}/anonymize`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmed: true }),
    });
    const d = await res.json();
    if (res.ok) { showToast('Data anonymized. Legal records preserved.'); setAnonModal(null); void load(); }
    else showToast(d.error ?? 'Failed', false);
    setActionLoading(null);
  }

  async function submitNewDSR() {
    setSubmitting(true);
    const res = await fetch('/api/admin/data-subject-requests', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requester_type: newRequesterType, requester_id: newRequesterId, request_type: newReqType, notes: newNotes || null }),
    });
    const d = await res.json();
    if (res.ok) { showToast('DSR created'); setShowNewModal(false); setNewRequesterId(''); setNewNotes(''); void load(); }
    else showToast(d.error ?? 'Failed', false);
    setSubmitting(false);
  }

  return (
    <Layout title="Data Privacy" subtitle="DPDP compliance — data subject requests">

      {toast && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, padding: '9px 16px',
          background: toast.ok ? '#065F46' : '#991B1B', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['all','pending','in_progress','completed','rejected'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{ padding: '4px 12px', borderRadius: 6, border: statusFilter === s ? 'none' : '1px solid #D1D5DB',
                background: statusFilter === s ? '#4F46E5' : '#fff', color: statusFilter === s ? '#fff' : '#374151',
                fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              {s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </button>
          ))}
        </div>
        <button onClick={() => setShowNewModal(true)}
          style={{ padding: '7px 14px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          + New Request
        </button>
      </div>

      <div style={cardStyle}>
        {loading ? <div style={{ padding: 32, textAlign: 'center', color: '#6B7280', fontSize: 12 }}>Loading...</div>
        : dsrs.length === 0 ? <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>No data subject requests found.</div>
        : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  {['Requester','Type','Request','Status','Requested','Actions'].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#6B7280', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dsrs.map(dsr => {
                  const badge = STATUS_BADGE[dsr.status] ?? { bg: '#F3F4F6', fg: '#374151' };
                  const canComplete = dsr.status === 'pending' || dsr.status === 'in_progress';
                  const canAnon = dsr.status === 'completed' && dsr.request_type === 'deletion';
                  return (
                    <tr key={dsr.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ fontWeight: 600 }}>{dsr.requester_name ?? '—'}</div>
                        <div style={{ color: '#9CA3AF', fontSize: 10 }}>{dsr.requester_type}</div>
                      </td>
                      <td style={{ padding: '8px 12px', color: '#374151' }}>{dsr.requester_type}</td>
                      <td style={{ padding: '8px 12px', color: '#374151' }}>{dsr.request_type}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ background: badge.bg, color: badge.fg, padding: '2px 7px', borderRadius: 4, fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}>
                          {dsr.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                        {new Date(dsr.requested_at).toLocaleDateString('en-IN')}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {canComplete && (
                            <>
                              <button onClick={() => { setCompleteModal({ id: dsr.id, requestType: dsr.request_type }); setCompleteAction('complete'); setExportUrl(''); setRejectReason(''); }}
                                disabled={!!actionLoading}
                                style={{ padding: '3px 8px', background: '#065F46', color: '#fff', border: 'none', borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                                Mark Complete
                              </button>
                              <button onClick={() => { setCompleteModal({ id: dsr.id, requestType: dsr.request_type }); setCompleteAction('reject'); setExportUrl(''); setRejectReason(''); }}
                                style={{ padding: '3px 8px', background: '#991B1B', color: '#fff', border: 'none', borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                                Reject
                              </button>
                            </>
                          )}
                          {canAnon && (
                            <button onClick={() => setAnonModal({ id: dsr.id, name: dsr.requester_name })}
                              style={{ padding: '3px 8px', background: '#92400E', color: '#fff', border: 'none', borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                              Anonymize Data
                            </button>
                          )}
                          {dsr.export_url && (
                            <a href={dsr.export_url} target="_blank" rel="noopener noreferrer"
                              style={{ padding: '3px 8px', background: '#4F46E5', color: '#fff', borderRadius: 4, fontSize: 10, fontWeight: 700, textDecoration: 'none' }}>
                              Export ↗
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Complete/Reject Modal */}
      {completeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 22, width: '100%', maxWidth: 420 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>
              {completeAction === 'complete' ? 'Mark Complete' : 'Reject Request'}
            </div>
            {completeAction === 'complete' && completeModal.requestType === 'export' && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 4, display: 'block' }}>Export URL (optional)</label>
                <input style={inputStyle} value={exportUrl} onChange={e => setExportUrl(e.target.value)} placeholder="https://..." />
              </div>
            )}
            {completeAction === 'reject' && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 4, display: 'block' }}>Rejection Reason *</label>
                <textarea style={{ ...inputStyle, height: 64, resize: 'vertical' }} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason for rejection..." />
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setCompleteModal(null)} style={{ flex: 1, padding: '8px', background: '#F3F4F6', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => void submitComplete()} disabled={completeAction === 'reject' && !rejectReason.trim()}
                style={{ flex: 2, padding: '8px', background: completeAction === 'complete' ? '#065F46' : '#991B1B', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {completeAction === 'complete' ? 'Confirm Complete' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Anonymize Confirm Modal */}
      {anonModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 22, width: '100%', maxWidth: 420 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, color: '#92400E' }}>⚠️ Anonymize Personal Data</div>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, marginBottom: 14 }}>
              This will anonymize personal data for <strong>{anonModal.name ?? 'this person'}</strong>.<br />
              Legal records (transfer certificates, fee payments, Section 65B logs) are preserved.<br />
              <strong>This cannot be undone.</strong>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setAnonModal(null)} style={{ flex: 1, padding: '8px', background: '#F3F4F6', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => void submitAnon()}
                style={{ flex: 2, padding: '8px', background: '#92400E', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                Anonymize
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New DSR Modal */}
      {showNewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 22, width: '100%', maxWidth: 420 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>New Data Subject Request</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 3, display: 'block' }}>Requester Type</label>
                <select style={inputStyle} value={newRequesterType} onChange={e => setNewRequesterType(e.target.value)}>
                  {['parent','student','staff'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 3, display: 'block' }}>Request Type</label>
                <select style={inputStyle} value={newReqType} onChange={e => setNewReqType(e.target.value)}>
                  {['export','deletion','correction','portability'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 3, display: 'block' }}>Requester ID (UUID)</label>
              <input style={inputStyle} value={newRequesterId} onChange={e => setNewRequesterId(e.target.value)} placeholder="parent/student/staff UUID" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 3, display: 'block' }}>Notes (optional)</label>
              <textarea style={{ ...inputStyle, height: 56, resize: 'vertical' }} value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Additional context..." />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowNewModal(false)} style={{ flex: 1, padding: '8px', background: '#F3F4F6', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => void submitNewDSR()} disabled={!newRequesterId.trim() || submitting}
                style={{ flex: 2, padding: '8px', background: !newRequesterId.trim() ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {submitting ? 'Creating...' : 'Create Request'}
              </button>
            </div>
          </div>
        </div>
      )}

    </Layout>
  );
}
