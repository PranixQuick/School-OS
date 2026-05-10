'use client';

// PATH: app/automation/classroom-proofs/page.tsx
//
// Principal classroom proofs review.
// Lists today's proofs (default) with signed download URLs.
// Expired rows (photo_url='') render as gray with audit_notes shown inline.
// Toggle ?include_expired=true to see those.
//
// Per v7.2 Item 11 spec correction:
//   audit_status enum is moderation state (pending/verified/flagged/rejected).
//   It does NOT include 'expired'. photo_url='' is the data-lifecycle marker.
//   UI distinguishes these two axes — gray render when is_expired, badge for audit_status.

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

interface ProofRow {
  id: string;
  taken_at: string;
  audit_status: string;
  audit_notes: string | null;
  is_expired: boolean;
  download_url: string | null;
  retention_until: string | null;
  geo_lat: number | null;
  geo_lng: number | null;
  teacher: { id: string; name: string; subject: string | null } | null;
  class: { id: string; grade_level: string; section: string } | null;
  period: { id: string; period: number; start_time: string; end_time: string } | null;
}

interface ListResponse {
  date: string;
  include_expired: boolean;
  total: number;
  proofs: ProofRow[];
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'badge-pending',
  verified: 'badge-done',
  flagged: 'badge-medium',
  rejected: 'badge-failed',
};

export default function ClassroomProofsAdmin() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [includeExpired, setIncludeExpired] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  useEffect(() => { loadAll(); }, [includeExpired]);

  async function loadAll() {
    setLoading(true);
    try {
      const url = includeExpired
        ? '/api/principal/classroom-proofs/list?include_expired=true'
        : '/api/principal/classroom-proofs/list';
      const res = await fetch(url);
      if (res.ok) {
        const d = await res.json();
        setData(d as ListResponse);
        setLastRefreshedAt(new Date());
      }
    } finally {
      setLoading(false);
    }
  }

  function fmtTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
    });
  }

  return (
    <Layout
      title="Classroom Proofs"
      subtitle={lastRefreshedAt
        ? `${data?.total ?? 0} proof${data?.total === 1 ? '' : 's'} · refreshed ${lastRefreshedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST`
        : 'Loading...'}
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B7280' }}>
            <input
              type="checkbox"
              checked={includeExpired}
              onChange={e => setIncludeExpired(e.target.checked)}
            />
            Include expired
          </label>
          <button onClick={loadAll} disabled={loading} className="btn btn-ghost btn-sm">
            {loading ? '↻ Loading...' : '↻ Refresh'}
          </button>
        </div>
      }
    >
      <div className="card">
        <div className="section-header">
          <div>
            <div className="section-title">Today&apos;s Classroom Proofs</div>
            <div className="section-sub">
              Photos teachers uploaded as proof they were physically present and teaching.
            </div>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="empty-state-icon">⏳</div>
            <div className="empty-state-title">Loading...</div>
          </div>
        ) : !data || data.proofs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📷</div>
            <div className="empty-state-title">No proofs today</div>
            <div className="empty-state-sub">
              Teachers can upload classroom photos via the Take photo button on /teacher.
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {data.proofs.map(p => {
              const isExpired = p.is_expired;
              const badgeCls = STATUS_BADGE[p.audit_status] ?? 'badge-gray';
              return (
                <div key={p.id} style={{
                  background: isExpired ? '#F3F4F6' : '#fff',
                  border: '1px solid #E5E7EB',
                  borderRadius: 12,
                  overflow: 'hidden',
                  opacity: isExpired ? 0.6 : 1,
                }}>
                  {/* Photo or expired placeholder */}
                  <div style={{ aspectRatio: '4/3', background: isExpired ? '#E5E7EB' : '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isExpired ? (
                      <div style={{ textAlign: 'center', color: '#6B7280' }}>
                        <div style={{ fontSize: 32 }}>📷</div>
                        <div style={{ fontSize: 11, marginTop: 4 }}>Expired (90+ days old)</div>
                      </div>
                    ) : p.download_url ? (
                      <img
                        src={p.download_url}
                        alt={`Proof from ${p.teacher?.name ?? 'unknown'}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ color: '#9CA3AF', fontSize: 12 }}>Image unavailable</div>
                    )}
                  </div>

                  {/* Metadata */}
                  <div style={{ padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                          {p.teacher?.name ?? 'Unknown'}
                        </div>
                        <div style={{ fontSize: 11, color: '#6B7280' }}>
                          {p.class ? `Class ${p.class.grade_level}-${p.class.section}` : 'Unknown class'}
                          {p.period ? ` · P${p.period.period}` : ''}
                        </div>
                      </div>
                      <span className={`badge ${badgeCls}`}>{p.audit_status}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                      Taken {fmtTime(p.taken_at)}
                      {(p.geo_lat !== null && p.geo_lng !== null) && ' · 📍 located'}
                    </div>
                    {p.audit_notes && (
                      <div style={{ marginTop: 8, padding: '6px 8px', background: '#FEF9C3', borderRadius: 6, fontSize: 11, color: '#A16207' }}>
                        {p.audit_notes}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer note */}
      <div style={{ marginTop: 16, fontSize: 11, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.6 }}>
        Photos auto-expire after 90 days. Expired photos retain audit_notes for compliance review.<br/>
        Audit status (pending/verified/flagged/rejected) is principal moderation; photo expiry is a separate data-lifecycle event.
      </div>
    </Layout>
  );
}
