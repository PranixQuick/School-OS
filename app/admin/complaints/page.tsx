'use client';
// PATH: app/admin/complaints/page.tsx
// PR-2 Task A: Admin / Principal complaint management.
// Status pill row at top, list view below, slide-in drawer for edits.

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface StudentRef { id: string; name: string; class: string | null; section: string | null }
interface Complaint {
  id: string;
  complaint_type: string;
  subject: string;
  description: string;
  status: string;
  resolution: string | null;
  parent_phone: string;
  student_id: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  closed_at: string | null;
  student: StudentRef | null;
}

interface StaffOption { id: string; name: string; role: string }

const STATUS_BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  open:         { bg: '#FEF3C7', fg: '#92400E', label: 'Open' },
  under_review: { bg: '#DBEAFE', fg: '#1E40AF', label: 'Under Review' },
  escalated:    { bg: '#FEE2E2', fg: '#991B1B', label: 'Escalated' },
  resolved:     { bg: '#D1FAE5', fg: '#065F46', label: 'Resolved' },
  closed:       { bg: '#F3F4F6', fg: '#4B5563', label: 'Closed' },
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

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  open:         ['under_review','escalated','resolved','closed'],
  under_review: ['escalated','resolved','closed'],
  escalated:    ['under_review','resolved','closed'],
  resolved:     ['closed'],
  closed:       [],
};

function fmtDateTime(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
  });
}

export default function AdminComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({
    open: 0, under_review: 0, escalated: 0, resolved: 0, closed: 0,
  });
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);

  // Edit drawer
  const [editing, setEditing] = useState<Complaint | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editAssigned, setEditAssigned] = useState('');
  const [editResolution, setEditResolution] = useState('');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (statusFilter) qs.set('status', statusFilter);
    if (typeFilter) qs.set('type', typeFilter);
    qs.set('limit', '200');
    try {
      const res = await fetch(`/api/admin/complaints?${qs.toString()}`);
      const d = await res.json() as {
        complaints?: Complaint[];
        stats?: { by_status: Record<string, number> };
      };
      setComplaints(d.complaints ?? []);
      if (d.stats?.by_status) setStats(d.stats.by_status);
    } catch (e) {
      console.error('Load complaints failed:', e);
    }
    setLoading(false);
  }, [statusFilter, typeFilter]);

  useEffect(() => { void load(); }, [load]);

  // Lazy-load staff options when drawer opens
  useEffect(() => {
    if (editing && staffOptions.length === 0) {
      fetch('/api/admin/staff?limit=500').then(async r => {
        if (!r.ok) return;
        const d = await r.json() as { staff?: { id: string; name: string; role: string }[] };
        setStaffOptions(d.staff ?? []);
      }).catch(() => {});
    }
  }, [editing, staffOptions.length]);

  function openDrawer(c: Complaint) {
    setEditing(c);
    setEditStatus(c.status);
    setEditAssigned(c.assigned_to ?? '');
    setEditResolution(c.resolution ?? '');
    setEditError('');
  }

  async function saveDrawer() {
    if (!editing) return;
    setSaving(true);
    setEditError('');

    const updates: Record<string, unknown> = {};
    if (editStatus !== editing.status) updates.status = editStatus;
    if (editAssigned !== (editing.assigned_to ?? '')) updates.assigned_to = editAssigned || null;
    if (editStatus === 'resolved' || (editResolution !== (editing.resolution ?? '') && editStatus === editing.status)) {
      updates.resolution = editResolution;
    }

    if (Object.keys(updates).length === 0) {
      setEditError('No changes to save');
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(`/api/admin/complaints/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const d = await res.json() as { error?: string };
      if (!res.ok) {
        setEditError(d.error ?? 'Update failed');
        setSaving(false);
        return;
      }
      setEditing(null);
      await load();
    } catch (e) {
      setEditError(String(e));
    } finally {
      setSaving(false);
    }
  }

  const allowedNextStatuses = editing
    ? [editing.status, ...ALLOWED_TRANSITIONS[editing.status]]
    : [];

  return (
    <Layout title="Parent Complaints" subtitle="View, triage, and resolve complaints filed by parents">
      {/* Stats pill row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        {(['open','under_review','escalated','resolved','closed'] as const).map(s => {
          const b = STATUS_BADGE[s];
          const active = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(active ? '' : s)}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                border: active ? `1px solid ${b.fg}` : '1px solid #E5E7EB',
                background: active ? b.bg : '#fff',
                color: active ? b.fg : '#374151',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {b.label}
              <span style={{
                background: active ? '#fff' : b.bg,
                color: b.fg,
                padding: '1px 7px',
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 800,
              }}>{stats[s] ?? 0}</span>
            </button>
          );
        })}
        {(statusFilter || typeFilter) && (
          <button
            onClick={() => { setStatusFilter(''); setTypeFilter(''); }}
            style={{
              padding: '6px 14px', borderRadius: 20, border: '1px solid #E5E7EB',
              background: '#F9FAFB', color: '#6B7280', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>Clear filters</button>
        )}
      </div>

      {/* Type filter */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</span>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12 }}
        >
          <option value="">All types</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <button
          onClick={() => void load()}
          style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
        >🔄 Refresh</button>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#6B7280', fontSize: 13 }}>Loading complaints…</div>
      ) : complaints.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13, background: '#F9FAFB', borderRadius: 8 }}>
          No complaints match the current filters.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {complaints.map(c => {
            const b = STATUS_BADGE[c.status] ?? STATUS_BADGE.open;
            return (
              <div
                key={c.id}
                onClick={() => openDrawer(c)}
                style={{
                  background: '#fff',
                  border: '1px solid #E5E7EB',
                  borderRadius: 10,
                  padding: 14,
                  cursor: 'pointer',
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  gap: 12,
                  alignItems: 'start',
                }}
              >
                <span style={{
                  background: b.bg, color: b.fg, padding: '3px 9px',
                  borderRadius: 12, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                }}>{b.label}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 4 }}>
                    {c.subject}
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span>{TYPE_LABELS[c.complaint_type] ?? c.complaint_type}</span>
                    <span>·</span>
                    <span>{c.student?.name ?? '(student?)'}{c.student?.class ? ` — ${c.student.class}${c.student.section ?? ''}` : ''}</span>
                    <span>·</span>
                    <span>{c.parent_phone}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#374151', marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.description}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#9CA3AF', whiteSpace: 'nowrap', textAlign: 'right' }}>
                  {fmtDateTime(c.created_at)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit drawer */}
      {editing && (
        <div
          onClick={() => setEditing(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            zIndex: 200, display: 'flex', justifyContent: 'flex-end',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 'min(520px, 100%)',
              height: '100%',
              background: '#fff',
              padding: 24,
              overflowY: 'auto',
              boxShadow: '-4px 0 24px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {TYPE_LABELS[editing.complaint_type] ?? editing.complaint_type}
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: '4px 0 0', letterSpacing: '-0.3px' }}>
                  {editing.subject}
                </h2>
              </div>
              <button onClick={() => setEditing(null)} style={{ background: 'transparent', border: 'none', fontSize: 22, color: '#9CA3AF', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 14 }}>
              From <strong style={{ color: '#374151' }}>{editing.parent_phone}</strong>
              {editing.student?.name && <> · about <strong style={{ color: '#374151' }}>{editing.student.name}</strong>{editing.student.class ? ` (${editing.student.class}${editing.student.section ?? ''})` : ''}</>}
            </div>

            <div style={{ background: '#F9FAFB', borderRadius: 8, padding: 12, fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap', marginBottom: 18, lineHeight: 1.55 }}>
              {editing.description}
            </div>

            {/* Status */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Status</label>
              <select
                value={editStatus}
                onChange={e => setEditStatus(e.target.value)}
                disabled={editing.status === 'closed'}
                style={{ width: '100%', padding: '9px 11px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: 13 }}
              >
                {allowedNextStatuses.map(s => (
                  <option key={s} value={s}>{STATUS_BADGE[s]?.label ?? s}</option>
                ))}
              </select>
              {editing.status === 'closed' && (
                <div style={{ fontSize: 11, color: '#92400E', marginTop: 4 }}>Closed complaints cannot be modified.</div>
              )}
            </div>

            {/* Assignment */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Assigned to</label>
              <select
                value={editAssigned}
                onChange={e => setEditAssigned(e.target.value)}
                disabled={editing.status === 'closed'}
                style={{ width: '100%', padding: '9px 11px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: 13 }}
              >
                <option value="">(unassigned)</option>
                {staffOptions.map(s => (
                  <option key={s.id} value={s.id}>{s.name} — {s.role}</option>
                ))}
              </select>
            </div>

            {/* Resolution */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                Resolution {editStatus === 'resolved' && <span style={{ color: '#991B1B' }}>*</span>}
              </label>
              <textarea
                value={editResolution}
                onChange={e => setEditResolution(e.target.value)}
                disabled={editing.status === 'closed'}
                placeholder="Describe what was done to resolve this complaint…"
                maxLength={4000}
                rows={5}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>

            {editError && (
              <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '8px 12px', borderRadius: 6, fontSize: 12, marginBottom: 12 }}>
                {editError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEditing(null)}
                style={{ padding: '9px 16px', borderRadius: 7, border: '1px solid #E5E7EB', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >Cancel</button>
              {editing.status !== 'closed' && (
                <button
                  onClick={() => void saveDrawer()}
                  disabled={saving}
                  style={{ padding: '9px 18px', borderRadius: 7, border: 'none', background: '#4F46E5', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
                >{saving ? 'Saving…' : 'Save Changes'}</button>
              )}
            </div>

            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 24, borderTop: '1px solid #F3F4F6', paddingTop: 12 }}>
              Filed {fmtDateTime(editing.created_at)}
              {editing.resolved_at && <> · Resolved {fmtDateTime(editing.resolved_at)}</>}
              {editing.closed_at && <> · Closed {fmtDateTime(editing.closed_at)}</>}
              <br />Last updated {fmtDateTime(editing.updated_at)}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
