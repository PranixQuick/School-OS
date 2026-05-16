'use client';

// PR-2 Task A: Parent complaints admin UI.
// Lists complaints filed by parents, lets admin/principal update status,
// assign to staff, record resolution.
//
// Status colors: open (gray) | under_review (blue) | escalated (red) | resolved (green) | closed (slate)

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

type Status = 'open' | 'under_review' | 'escalated' | 'resolved' | 'closed';

interface Complaint {
  id: string;
  complaint_type: string;
  subject: string;
  description: string;
  status: Status;
  assigned_to: string | null;
  resolution: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  parent_phone: string;
  student_id: string;
  students: { id: string; name: string; class: string | null; section: string | null } | null;
}

interface Stats {
  open: number;
  under_review: number;
  escalated: number;
  resolved: number;
  closed: number;
}

interface StaffOption { id: string; name: string; role: string }

const STATUS_BADGE: Record<Status, { bg: string; fg: string; label: string }> = {
  open:         { bg: '#F3F4F6', fg: '#374151', label: 'Open' },
  under_review: { bg: '#DBEAFE', fg: '#1E40AF', label: 'Under Review' },
  escalated:    { bg: '#FEE2E2', fg: '#991B1B', label: 'Escalated' },
  resolved:     { bg: '#D1FAE5', fg: '#065F46', label: 'Resolved' },
  closed:       { bg: '#E5E7EB', fg: '#4B5563', label: 'Closed' },
};

const TYPE_LABELS: Record<string, string> = {
  academic: 'Academic',
  teacher_conduct: 'Teacher Conduct',
  bullying: 'Bullying',
  safety: 'Safety',
  infrastructure: 'Infrastructure',
  fee: 'Fee',
  transport: 'Transport',
  food: 'Food',
  vendor: 'Vendor',
  general: 'General',
};

const TYPES = Object.keys(TYPE_LABELS);
const STATUSES: Status[] = ['open', 'under_review', 'escalated', 'resolved', 'closed'];

function fmtDateTime(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
  });
}

export default function AdminComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [stats, setStats] = useState<Stats>({ open: 0, under_review: 0, escalated: 0, resolved: 0, closed: 0 });
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Complaint | null>(null);
  const [editStatus, setEditStatus] = useState<Status>('open');
  const [editAssignedTo, setEditAssignedTo] = useState<string>('');
  const [editResolution, setEditResolution] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [staff, setStaff] = useState<StaffOption[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (typeFilter !== 'all') params.set('type', typeFilter);
    params.set('limit', '100');
    try {
      const res = await fetch(`/api/admin/complaints?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load');
        setComplaints([]);
      } else {
        setComplaints(data.complaints ?? []);
        setStats(data.stats ?? { open: 0, under_review: 0, escalated: 0, resolved: 0, closed: 0 });
      }
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }, [statusFilter, typeFilter]);

  useEffect(() => { void load(); }, [load]);

  // Load staff list once for the assignment dropdown
  useEffect(() => {
    void fetch('/api/admin/staff?limit=200')
      .then(r => r.ok ? r.json() : null)
      .then((d: { staff?: StaffOption[] } | null) => {
        if (d?.staff) setStaff(d.staff);
      })
      .catch(() => {});
  }, []);

  function openDetail(c: Complaint) {
    setSelected(c);
    setEditStatus(c.status);
    setEditAssignedTo(c.assigned_to ?? '');
    setEditResolution(c.resolution ?? '');
    setError('');
  }

  async function saveComplaint() {
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      const body: Record<string, unknown> = {};
      if (editStatus !== selected.status) body.status = editStatus;
      if ((editAssignedTo || null) !== (selected.assigned_to ?? null)) {
        body.assigned_to = editAssignedTo || null;
      }
      if ((editResolution.trim() || null) !== (selected.resolution ?? null)) {
        body.resolution = editResolution.trim();
      }
      if (Object.keys(body).length === 0) {
        setError('No changes to save');
        setSaving(false);
        return;
      }
      const res = await fetch(`/api/admin/complaints/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Save failed');
      } else {
        setSelected(null);
        await load();
      }
    } catch (e) {
      setError(String(e));
    }
    setSaving(false);
  }

  return (
    <Layout title="Parent Complaints" subtitle="Lifecycle management for parent-filed grievances">
      {/* Stats row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        {STATUSES.map(s => {
          const cfg = STATUS_BADGE[s];
          return (
            <button key={s}
              onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
              style={{
                padding: '8px 14px', borderRadius: 8,
                background: statusFilter === s ? cfg.fg : cfg.bg,
                color: statusFilter === s ? '#fff' : cfg.fg,
                border: `1px solid ${cfg.fg}`, cursor: 'pointer',
                fontSize: 12, fontWeight: 600,
              }}>
              {cfg.label}: {stats[s]}
            </button>
          );
        })}
        <button onClick={() => setStatusFilter('all')}
          style={{ padding: '8px 14px', borderRadius: 8, background: statusFilter === 'all' ? '#4F46E5' : '#fff', color: statusFilter === 'all' ? '#fff' : '#4F46E5', border: '1px solid #4F46E5', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
          All
        </button>
      </div>

      {/* Type filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280' }}>TYPE:</span>
        <button onClick={() => setTypeFilter('all')}
          style={{ padding: '4px 10px', borderRadius: 6, background: typeFilter === 'all' ? '#4F46E5' : '#fff', color: typeFilter === 'all' ? '#fff' : '#374151', border: '1px solid #E5E7EB', cursor: 'pointer', fontSize: 11 }}>
          All
        </button>
        {TYPES.map(t => (
          <button key={t} onClick={() => setTypeFilter(t)}
            style={{ padding: '4px 10px', borderRadius: 6, background: typeFilter === t ? '#4F46E5' : '#fff', color: typeFilter === t ? '#fff' : '#374151', border: '1px solid #E5E7EB', cursor: 'pointer', fontSize: 11 }}>
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {error && <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{error}</div>}

      {loading && <div style={{ padding: 20, color: '#6B7280', fontSize: 13 }}>Loading…</div>}

      {!loading && complaints.length === 0 && (
        <div style={{ padding: 30, textAlign: 'center', color: '#9CA3AF', fontSize: 13, background: '#F9FAFB', borderRadius: 10 }}>
          No complaints match the current filters.
        </div>
      )}

      {/* Complaint list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {complaints.map(c => {
          const badge = STATUS_BADGE[c.status];
          return (
            <div key={c.id}
              onClick={() => openDetail(c)}
              style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 14, cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>
                      {TYPE_LABELS[c.complaint_type] ?? c.complaint_type}
                    </span>
                    <span style={{ fontSize: 10, color: '#9CA3AF' }}>•</span>
                    <span style={{ fontSize: 11, color: '#6B7280' }}>
                      {c.students?.name ?? '(student missing)'}
                      {c.students?.class ? ` · ${c.students.class}` : ''}
                      {c.students?.section ? c.students.section : ''}
                    </span>
                    <span style={{ fontSize: 10, color: '#9CA3AF' }}>•</span>
                    <span style={{ fontSize: 11, color: '#6B7280' }}>{c.parent_phone}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
                    {c.subject}
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {c.description}
                  </div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>
                    Filed {fmtDateTime(c.created_at)}
                    {c.resolved_at && ` · Resolved ${fmtDateTime(c.resolved_at)}`}
                  </div>
                </div>
                <span style={{
                  background: badge.bg, color: badge.fg,
                  padding: '4px 10px', borderRadius: 12,
                  fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                }}>
                  {badge.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail / edit drawer */}
      {selected && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
        }} onClick={() => setSelected(null)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', width: '100%', maxWidth: 560, height: '100vh', overflowY: 'auto', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>Complaint Detail</h2>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6B7280' }}>✕</button>
            </div>

            <div style={{ marginBottom: 18, padding: 14, background: '#F9FAFB', borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginBottom: 6 }}>
                {TYPE_LABELS[selected.complaint_type] ?? selected.complaint_type}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 8 }}>{selected.subject}</div>
              <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{selected.description}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 10 }}>
                From {selected.parent_phone} · Filed {fmtDateTime(selected.created_at)}
                {selected.students && ` · Student: ${selected.students.name}`}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Status</label>
              <select value={editStatus} onChange={e => setEditStatus(e.target.value as Status)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: 13 }}>
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_BADGE[s].label}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Assigned To</label>
              <select value={editAssignedTo} onChange={e => setEditAssignedTo(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: 13 }}>
                <option value="">— Unassigned —</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Resolution Notes</label>
              <textarea value={editResolution} onChange={e => setEditResolution(e.target.value)}
                rows={5}
                placeholder="Describe the resolution, actions taken, or notes for the parent."
                style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} />
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{editResolution.length}/4000</div>
            </div>

            {error && <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setSelected(null)}
                style={{ flex: 1, padding: '10px', background: '#F3F4F6', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => void saveComplaint()} disabled={saving}
                style={{ flex: 2, padding: '10px', background: saving ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>

            <div style={{ marginTop: 16, padding: '10px 12px', background: '#F9FAFB', borderRadius: 8, fontSize: 11, color: '#6B7280' }}>
              <div>Last updated: {fmtDateTime(selected.updated_at)}</div>
              {selected.resolved_at && <div>Resolved at: {fmtDateTime(selected.resolved_at)}</div>}
              {selected.closed_at && <div>Closed at: {fmtDateTime(selected.closed_at)}</div>}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
