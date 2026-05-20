'use client';
import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import { T } from '@/lib/i18n';
import { useLang } from '@/lib/useLang';

interface TC {
  id: string; student_name: string; student_id: string;
  reason_category: string; reason: string;
  status: 'pending' | 'approved' | 'issued' | 'rejected';
  requested_at: string; approved_at?: string; issued_at?: string;
  class?: string; section?: string;
}

const STATUS_COLOR: Record<string, string> = { pending: '#A16207', approved: '#1D4ED8', issued: '#15803D', rejected: '#B91C1C' };
const STATUS_BG: Record<string, string> = { pending: '#FEF9C3', approved: '#DBEAFE', issued: '#DCFCE7', rejected: '#FEE2E2' };
const REASON_LABELS: Record<string, string> = {
  transfer: 'Parent Transfer', migration: 'City Migration', fees: 'Fee Issues',
  performance: 'Academic Concerns', family: 'Family Reason', other: 'Other',
};

export default function TransferCertificatesPage() {
  const { lang } = useLang();
  const [tcs, setTcs] = useState<TC[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all'|TC['status']>('all');
  const [actionId, setActionId] = useState<string|null>(null);

  const loadTcs = useCallback(async () => {
    setLoading(true);
    try {
      const url = statusFilter === 'all' ? '/api/admin/transfer-certificates' : `/api/admin/transfer-certificates?status=${statusFilter}`;
      const res = await fetch(url);
      if (res.ok) { const d = await res.json(); setTcs(d.transfer_certificates ?? []); }
    } catch { /* ignore */ }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { loadTcs(); }, [loadTcs]);

  async function updateStatus(id: string, status: string) {
    setActionId(id);
    try {
      await fetch('/api/admin/transfer-certificates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      await loadTcs();
    } catch { /* ignore */ }
    setActionId(null);
  }

  const counts = {
    pending: tcs.filter(t => t.status === 'pending').length,
    approved: tcs.filter(t => t.status === 'approved').length,
    issued: tcs.filter(t => t.status === 'issued').length,
  };

  return (
    <Layout title={T('transfer_certs', lang)} subtitle="Review and issue student transfer certificates">
      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {([['all', 'All'], ['pending', 'Pending'], ['approved', 'Approved'], ['issued', 'Issued']] as const).map(([s, label]) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: statusFilter === s ? '#4F46E5' : '#F3F4F6',
              color: statusFilter === s ? '#fff' : '#374151' }}>
            {label} {s === 'pending' ? `(${counts.pending})` : s === 'approved' ? `(${counts.approved})` :
              s === 'issued' ? `(${counts.issued})` : `(${tcs.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
      ) : tcs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📄</div>
          <div className="empty-state-title">No transfer certificates</div>
          <div className="empty-state-sub">{statusFilter === 'pending' ? 'No pending TC requests.' : 'TC requests from parents will appear here.'}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tcs.map(tc => (
            <div key={tc.id} className="card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{tc.student_name}</div>
                  {tc.class && <div style={{ fontSize: 12, color: '#6B7280' }}>Class {tc.class}{tc.section}</div>}
                </div>
                <span style={{ padding: '3px 9px', borderRadius: 7,
                  background: STATUS_BG[tc.status], color: STATUS_COLOR[tc.status],
                  fontSize: 11, fontWeight: 700, textTransform: 'uppercase', flexShrink: 0 }}>
                  {tc.status}
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>
                <strong>Reason:</strong> {REASON_LABELS[tc.reason_category] ?? tc.reason_category}
              </div>
              {tc.reason && (
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8, fontStyle: 'italic' }}>{tc.reason}</div>
              )}
              <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 10 }}>
                Requested {new Date(tc.requested_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                {tc.approved_at && ` · Approved ${new Date(tc.approved_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
              </div>
              {tc.status === 'pending' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => updateStatus(tc.id, 'approved')} disabled={actionId === tc.id}
                    className="btn btn-primary btn-sm">
                    {actionId === tc.id ? '…' : '✓ Approve'}
                  </button>
                  <button onClick={() => updateStatus(tc.id, 'rejected')} disabled={actionId === tc.id}
                    className="btn btn-ghost btn-sm" style={{ color: '#B91C1C', borderColor: '#FECACA' }}>
                    Reject
                  </button>
                </div>
              )}
              {tc.status === 'approved' && (
                <button onClick={() => updateStatus(tc.id, 'issued')} disabled={actionId === tc.id}
                  className="btn btn-primary btn-sm" style={{ background: '#15803D' }}>
                  {actionId === tc.id ? '…' : '📄 Issue TC'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
