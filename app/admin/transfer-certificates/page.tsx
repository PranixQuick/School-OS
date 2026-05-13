'use client';
// PATH: app/admin/transfer-certificates/page.tsx
// Item #11 TC Lifecycle — PR #2
// Admin TC management: list, create request, fee clearance, approve/reject, issue, download.
// Auth: session-protected (middleware). Role actions gated client-side by session header.

import { useState, useEffect, useRef } from 'react';
import Layout from '@/components/Layout';

interface TC {
  id: string; status: string; fee_clearance_status: string;
  outstanding_fee_amount: number; reason: string; reason_category: string;
  requested_at: string; reviewed_at: string | null; issued_at: string | null;
  tc_number: string | null; rejection_reason: string | null;
  students: { name: string; class: string; section: string; admission_number: string | null } | null;
  requester: { email: string } | null;
}

interface StudentResult { id: string; name: string; class: string; section: string; admission_number: string | null }

const STATUS_BADGE: Record<string, { bg: string; fg: string }> = {
  pending:  { bg: '#FEF3C7', fg: '#92400E' },
  approved: { bg: '#DBEAFE', fg: '#1E40AF' },
  issued:   { bg: '#D1FAE5', fg: '#065F46' },
  rejected: { bg: '#FEE2E2', fg: '#991B1B' },
  revoked:  { bg: '#F3F4F6', fg: '#6B7280' },
};
const FEE_BADGE: Record<string, { bg: string; fg: string }> = {
  cleared: { bg: '#D1FAE5', fg: '#065F46' },
  pending: { bg: '#FEE2E2', fg: '#991B1B' },
  waived:  { bg: '#F3F4F6', fg: '#6B7280' },
};

function Badge({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return (
    <span style={{ background: bg, color: fg, padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>
      {text.replace(/_/g,' ')}
    </span>
  );
}

const REASON_CATEGORIES = ['transfer','graduation','family_relocation','fee_default','disciplinary','other'];
const cardStyle = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 16, marginBottom: 16 };
const inputStyle = { width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: 13, boxSizing: 'border-box' as const };

export default function TCListPage() {
  const [tcs, setTcs] = useState<TC[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // New TC modal
  const [showModal, setShowModal] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentResults, setStudentResults] = useState<StudentResult[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentResult | null>(null);
  const [reasonCategory, setReasonCategory] = useState('transfer');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { void load(); }, [statusFilter]);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/transfer-certificates?status=${statusFilter}`);
    if (res.ok) { const d = await res.json(); setTcs(d.transfer_certificates ?? []); }
    setLoading(false);
  }

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  async function doAction(tcId: string, path: string, body: unknown) {
    setActionLoading(tcId + path);
    try {
      const res = await fetch(`/api/admin/transfer-certificates/${tcId}${path}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const d = await res.json();
      if (res.ok) { showToast(d.tc?.status ? `TC ${d.tc.status}` : 'Done'); void load(); }
      else showToast(d.message ?? d.error ?? 'Error', false);
    } finally { setActionLoading(null); }
  }

  async function doIssue(tcId: string) {
    setActionLoading(tcId + 'issue');
    try {
      const res = await fetch(`/api/admin/transfer-certificates/${tcId}/issue`, { method: 'POST' });
      const d = await res.json();
      if (res.ok) { showToast(`TC ${d.tc_number} issued`); void load(); }
      else showToast(d.message ?? d.error ?? 'Issue failed', false);
    } finally { setActionLoading(null); }
  }

  function doDownload(tcId: string, tcNumber: string) {
    window.open(`/api/admin/transfer-certificates/${tcId}/download`, '_blank');
  }

  // Student search for new TC modal
  useEffect(() => {
    if (!studentSearch.trim() || studentSearch.length < 2) { setStudentResults([]); return; }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/admin/stats?student_search=${encodeURIComponent(studentSearch)}`).catch(() => null);
      if (res?.ok) {
        const d = await res.json();
        setStudentResults((d.students ?? []).slice(0, 8));
      }
    }, 300);
  }, [studentSearch]);

  async function submitNewTC() {
    if (!selectedStudent || !reason.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/transfer-certificates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: selectedStudent.id, reason: reason.trim(), reason_category: reasonCategory }),
      });
      const d = await res.json();
      if (res.ok) {
        showToast(`TC request created. Fee status: ${d.fee_clearance_status}`);
        setShowModal(false); setSelectedStudent(null); setStudentSearch(''); setReason('');
        void load();
      } else showToast(d.message ?? d.error ?? 'Failed', false);
    } finally { setSubmitting(false); }
  }

  const isLoading = (id: string, suffix: string) => actionLoading === id + suffix;

  return (
    <Layout title="Transfer Certificates" subtitle="TC lifecycle management">

      {toast && (
        <div style={{ position:'fixed', top:16, right:16, zIndex:9999, padding:'10px 18px', borderRadius:8,
          background: toast.ok ? '#065F46' : '#991B1B', color:'#fff', fontSize:13, fontWeight:600, boxShadow:'0 4px 12px rgba(0,0,0,0.15)' }}>
          {toast.msg}
        </div>
      )}

      {/* Header + Filter + New TC */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {['all','pending','approved','issued','rejected'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{ padding:'5px 12px', borderRadius:6, border: statusFilter===s ? 'none' : '1px solid #D1D5DB',
                background: statusFilter===s ? '#4F46E5' : '#fff', color: statusFilter===s ? '#fff' : '#374151',
                fontSize:12, fontWeight:600, cursor:'pointer' }}>
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <button onClick={() => setShowModal(true)}
          style={{ padding:'8px 16px', background:'#4F46E5', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}>
          + New TC Request
        </button>
      </div>

      {/* TC Table */}
      <div style={{ ...cardStyle, padding:0, overflow:'hidden' }}>
        {loading ? (
          <div style={{ padding:40, textAlign:'center', color:'#6B7280', fontSize:13 }}>Loading...</div>
        ) : tcs.length === 0 ? (
          <div style={{ padding:40, textAlign:'center', color:'#9CA3AF', fontSize:13 }}>No transfer certificate requests found.</div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ background:'#F9FAFB', borderBottom:'1px solid #E5E7EB' }}>
                  {['Student','Class','Status','Fee Clearance','TC Number','Requested','Actions'].map(h => (
                    <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:10, fontWeight:700, color:'#6B7280', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tcs.map(tc => {
                  const sBadge = STATUS_BADGE[tc.status] ?? STATUS_BADGE['pending'];
                  const fBadge = FEE_BADGE[tc.fee_clearance_status] ?? FEE_BADGE['pending'];
                  const canClear = tc.status === 'pending' && tc.fee_clearance_status === 'pending';
                  const canApprove = tc.status === 'pending' && tc.fee_clearance_status !== 'pending';
                  const loadKey = (s: string) => isLoading(tc.id, s);
                  return (
                    <tr key={tc.id} style={{ borderBottom:'1px solid #F3F4F6' }}>
                      <td style={{ padding:'9px 12px', fontWeight:600 }}>{tc.students?.name ?? '—'}</td>
                      <td style={{ padding:'9px 12px', color:'#6B7280' }}>
                        {tc.students ? `Grade ${tc.students.class}-${tc.students.section}` : '—'}
                      </td>
                      <td style={{ padding:'9px 12px' }}><Badge text={tc.status} {...sBadge} /></td>
                      <td style={{ padding:'9px 12px' }}>
                        <Badge text={tc.fee_clearance_status} {...fBadge} />
                        {tc.outstanding_fee_amount > 0 && tc.fee_clearance_status === 'pending' && (
                          <div style={{ fontSize:10, color:'#991B1B', marginTop:2 }}>₹{Math.round(tc.outstanding_fee_amount).toLocaleString('en-IN')}</div>
                        )}
                      </td>
                      <td style={{ padding:'9px 12px', color:'#374151', fontWeight:600 }}>{tc.tc_number ?? '—'}</td>
                      <td style={{ padding:'9px 12px', color:'#6B7280', whiteSpace:'nowrap' }}>
                        {new Date(tc.requested_at).toLocaleDateString('en-IN')}
                      </td>
                      <td style={{ padding:'9px 12px' }}>
                        <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                          {canClear && (
                            <>
                              <button onClick={() => void doAction(tc.id, '/fee-clearance', { action:'clear' })}
                                disabled={!!actionLoading}
                                style={{ padding:'3px 8px', background:'#065F46', color:'#fff', border:'none', borderRadius:5, fontSize:10, fontWeight:700, cursor:'pointer', opacity: loadKey('/fee-clearance') ? 0.6 : 1 }}>
                                {loadKey('/fee-clearance') ? '…' : 'Clear Fees'}
                              </button>
                              <button onClick={() => void doAction(tc.id, '/fee-clearance', { action:'waive' })}
                                disabled={!!actionLoading}
                                style={{ padding:'3px 8px', background:'#6B7280', color:'#fff', border:'none', borderRadius:5, fontSize:10, fontWeight:700, cursor:'pointer' }}>
                                Waive
                              </button>
                            </>
                          )}
                          {canApprove && (
                            <>
                              <button onClick={() => void doAction(tc.id, '/review', { action:'approve' })}
                                disabled={!!actionLoading}
                                style={{ padding:'3px 8px', background:'#1E40AF', color:'#fff', border:'none', borderRadius:5, fontSize:10, fontWeight:700, cursor:'pointer', opacity: loadKey('/review') ? 0.6 : 1 }}>
                                {loadKey('/review') ? '…' : 'Approve'}
                              </button>
                              <button onClick={() => { const r = prompt('Rejection reason:'); if(r) void doAction(tc.id, '/review', { action:'reject', rejection_reason:r }); }}
                                disabled={!!actionLoading}
                                style={{ padding:'3px 8px', background:'#991B1B', color:'#fff', border:'none', borderRadius:5, fontSize:10, fontWeight:700, cursor:'pointer' }}>
                                Reject
                              </button>
                            </>
                          )}
                          {tc.status === 'approved' && (
                            <button onClick={() => void doIssue(tc.id)}
                              disabled={!!actionLoading}
                              style={{ padding:'3px 10px', background:'#065F46', color:'#fff', border:'none', borderRadius:5, fontSize:10, fontWeight:700, cursor:'pointer', opacity: loadKey('issue') ? 0.6 : 1 }}>
                              {loadKey('issue') ? 'Generating…' : 'Issue TC + PDF'}
                            </button>
                          )}
                          {tc.status === 'issued' && (
                            <button onClick={() => doDownload(tc.id, tc.tc_number ?? 'TC')}
                              style={{ padding:'3px 10px', background:'#4F46E5', color:'#fff', border:'none', borderRadius:5, fontSize:10, fontWeight:700, cursor:'pointer' }}>
                              ⬇ Download PDF
                            </button>
                          )}
                          {tc.status === 'rejected' && tc.rejection_reason && (
                            <span style={{ fontSize:10, color:'#991B1B', maxWidth:120 }} title={tc.rejection_reason}>
                              {tc.rejection_reason.slice(0, 30)}{tc.rejection_reason.length > 30 ? '…' : ''}
                            </span>
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

      {/* New TC Modal */}
      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:12, padding:24, width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ fontWeight:700, fontSize:16, marginBottom:16 }}>New TC Request</div>

            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, fontWeight:600, color:'#6B7280', marginBottom:4, display:'block' }}>Student</label>
              {selectedStudent ? (
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background:'#EFF6FF', borderRadius:7 }}>
                  <span style={{ fontWeight:600, fontSize:13 }}>{selectedStudent.name} — Grade {selectedStudent.class}-{selectedStudent.section}</span>
                  <button onClick={() => setSelectedStudent(null)} style={{ background:'none', border:'none', color:'#991B1B', cursor:'pointer', fontSize:14 }}>×</button>
                </div>
              ) : (
                <>
                  <input style={inputStyle} value={studentSearch} onChange={e => setStudentSearch(e.target.value)} placeholder="Type student name..." />
                  {studentResults.length > 0 && (
                    <div style={{ border:'1px solid #E5E7EB', borderRadius:7, marginTop:2, maxHeight:160, overflowY:'auto' }}>
                      {studentResults.map(s => (
                        <div key={s.id} onClick={() => { setSelectedStudent(s); setStudentSearch(''); setStudentResults([]); }}
                          style={{ padding:'8px 12px', cursor:'pointer', fontSize:13, borderBottom:'1px solid #F3F4F6' }}
                          onMouseEnter={e => (e.currentTarget.style.background='#F9FAFB')}
                          onMouseLeave={e => (e.currentTarget.style.background='#fff')}>
                          {s.name} — Grade {s.class}-{s.section}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, fontWeight:600, color:'#6B7280', marginBottom:4, display:'block' }}>Reason Category</label>
              <select style={inputStyle} value={reasonCategory} onChange={e => setReasonCategory(e.target.value)}>
                {REASON_CATEGORIES.map(r => <option key={r} value={r}>{r.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
              </select>
            </div>

            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:11, fontWeight:600, color:'#6B7280', marginBottom:4, display:'block' }}>Reason *</label>
              <textarea style={{ ...inputStyle, height:72, resize:'vertical' }} value={reason} onChange={e => setReason(e.target.value)} placeholder="Detailed reason for transfer/leaving..." />
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => { setShowModal(false); setSelectedStudent(null); setStudentSearch(''); }}
                style={{ flex:1, padding:'9px', background:'#F3F4F6', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>
                Cancel
              </button>
              <button onClick={() => void submitNewTC()} disabled={!selectedStudent || !reason.trim() || submitting}
                style={{ flex:2, padding:'9px', background: (!selectedStudent || !reason.trim()) ? '#9CA3AF' : '#4F46E5', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor: submitting ? 'wait' : 'pointer' }}>
                {submitting ? 'Creating…' : 'Create TC Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
