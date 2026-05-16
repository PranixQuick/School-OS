'use client';

// PR-2 Task A: Admin complaints management page.
// Filter by status + type, view details, update status / assign / resolve.

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

type Status = 'open' | 'under_review' | 'escalated' | 'resolved' | 'closed';

interface StudentMini {
  id: string;
  name: string;
  class: string | null;
  section: string | null;
}

interface Complaint {
  id: string;
  complaint_type: string;
  subject: string;
  description: string;
  status: Status;
  parent_phone: string;
  assigned_to: string | null;
  resolution: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  student: StudentMini | StudentMini[] | null;
}

interface StaffMini { id: string; name: string; role: string | null; }

const STATUS_COLORS: Record<Status, { bg: string; fg: string; label: string }> = {
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

function firstStudent(s: StudentMini | StudentMini[] | null): StudentMini | null {
  if (!s) return null;
  return Array.isArray(s) ? (s[0] ?? null) : s;
}

function fmtDateTime(s: string): string {
  return new Date(s).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
  });
}

export default function ComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [selected, setSelected] = useState<Complaint | null>(null);
  const [staff, setStaff] = useState<StaffMini[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  // Drawer state
  const [editStatus, setEditStatus] = useState<Status>('open');
  const [editAssignedTo, setEditAssignedTo] = useState<string>('');
  const [editResolution, setEditResolution] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus) params.set('status', filterStatus);
    if (filterType) params.set('type', filterType);
    const url = '/api/admin/complaints' + (params.toString() ? '?' + params.toString() : '');
    try {
      const res = await fetch(url);
      const d = await res.json() as { complaints?: Complaint[]; stats?: Record<string, number> };
      setComplaints(d.complaints ?? []);
      setStats(d.stats ?? {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterType]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    // Lazy load staff list when drawer opens
    if (selected && staff.length === 0) {
      void fetch('/api/admin/staff?limit=200')
        .then(r => r.ok ? r.json() : null)
        .then((d: { staff?: StaffMini[] } | null) => {
          if (d?.staff) setStaff(d.staff);
        })
        .catch(() => {});
    }
  }, [selected, staff.length]);

  function openDrawer(c: Complaint) {
    setSelected(c);
    setEditStatus(c.status);
    setEditAssignedTo(c.assigned_to ?? '');
    setEditResolution(c.resolution ?? '');
  }

  function closeDrawer() {
    setSelected(null);
    setToast('');
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    setToast('');
    try {
      const body: Record<string, unknown> = {};
      if (editStatus !== selected.status) body.status = editStatus;
      if ((editAssignedTo || null) !== selected.assigned_to) {
        body.assigned_to = editAssignedTo || null;
      }
      if ((editResolution || null) !== selected.resolution) {
        body.resolution = editResolution || null;
      }
      if (Object.keys(body).length === 0) {
        setToast('No changes to save');
        setSaving(false);
        return;
      }
      const res = await fetch('/api/admin/complaints/' + selected.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) {
        setToast('Save failed: ' + (d.error ?? res.statusText));
      } else {
        setToast('Saved');
        await load();
        // Re-find the updated complaint in the fresh list
        setSelected(null);
      }
    } catch (e) {
      setToast('Save failed: ' + String(e));
    } finally {
      setSaving(false);
    }
  }

  const labelStyle = { fontSize: 11, fontWeight: 700 as const, color: '#6B7280', marginBottom: 4, display: 'block' as const };
  const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: 13, boxSizing: 'border-box' as const };

  return (
    <Layout title="Parent Complaints" subtitle="Grievance lifecycle: open → under review → resolved → closed">
      {/* Stats row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {(['open','under_review','escalated','resolved','closed'] as Status[]).map(s => {
          const col = STATUS_COLORS[s];
          const count = stats[s] ?? 0;
          return (
            <div key={s} style={{ background: col.bg, color: col.fg, padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
              {col.label}: {count}
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #E5E7EB', fontSize: 12 }}>
          <option value="">All statuses</option>
          {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{STATUS_COLORS[s as Status].label}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #E5E7EB', fontSize: 12 }}>
          <option value="">All types</option>
          {Object.keys(TYPE_LABELS).map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
        </select>
        <button onClick={() => void load()} style={{ padding: '6px 14px', background: '#F3F4F6', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#6B7280' }}>Loading...</div>
      ) : complaints.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#6B7280', background: '#F9FAFB', borderRadius: 10 }}>
          No complaints match these filters.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {complaints.map(c => {
            const col = STATUS_COLORS[c.status];
            const stu = firstStudent(c.student);
            return (
              <div key={c.id} onClick={() => openDrawer(c)}
                   style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 16px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ background: col.bg, color: col.fg, padding: '3px 9px', borderRadius: 12, fontSize: 10, fontWeight: 700 }}>{col.label}</span>
                    <span style={{ background: '#F3F4F6', color: '#374151', padding: '3px 9px', borderRadius: 12, fontSize: 10, fontWeight: 600 }}>{TYPE_LABELS[c.complaint_type] ?? c.complaint_type}</span>
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>{fmtDateTime(c.created_at)}</span>
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>{c.subject}</div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>
                  Student: <strong>{stu?.name ?? '—'}</strong>
                  {stu?.class ? ' · Class ' + stu.class : ''}
                  {stu?.section ? '-' + stu.section : ''}
                  {' · Parent: ' + c.parent_phone}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Drawer (modal) */}
      {selected && (
        <div onClick={closeDrawer} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(520px, 92vw)', background: '#fff', height: '100vh', overflowY: 'auto', padding: 20, boxShadow: '-4px 0 24px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Complaint details</div>
              <button onClick={closeDrawer} style={{ background: '#F3F4F6', border: 'none', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>✕ Close</button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>{selected.subject}</div>
              <div style={{ fontSize: 12, color: '#6B7280' }}>
                {TYPE_LABELS[selected.complaint_type] ?? selected.complaint_type} · filed {fmtDateTime(selected.created_at)}
              </div>
            </div>

            <div style={{ background: '#F9FAFB', borderRadius: 8, padding: 12, marginBottom: 16, whiteSpace: 'pre-wrap', fontSize: 13, color: '#374151' }}>
              {selected.description}
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Status</label>
              <select value={editStatus} onChange={e => setEditStatus(e.target.value as Status)} style={inputStyle}>
                {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{STATUS_COLORS[s as Status].label}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Assign to staff (optional)</label>
              <select value={editAssignedTo} onChange={e => setEditAssignedTo(e.target.value)} style={inputStyle}>
                <option value="">— Unassigned —</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}{s.role ? ' (' + s.role + ')' : ''}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Resolution notes {editStatus === 'resolved' ? '(required)' : '(optional)'}</label>
              <textarea
                value={editResolution}
                onChange={e => setEditResolution(e.target.value)}
                rows={4}
                placeholder="What action was taken to resolve this complaint?"
                style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
              />
            </div>

            {toast && <div style={{ marginBottom: 12, padding: 10, background: toast.startsWith('Saved') ? '#D1FAE5' : '#FEF3C7', borderRadius: 7, fontSize: 12, color: '#0F172A' }}>{toast}</div>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={closeDrawer} style={{ flex: 1, padding: '10px', background: '#F3F4F6', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => void save()} disabled={saving} style={{ flex: 1, padding: '10px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </div>

            {/* Audit metadata */}
            <div style={{ marginTop: 24, fontSize: 11, color: '#9CA3AF', lineHeight: 1.7 }}>
              <div><strong>ID:</strong> {selected.id}</div>
              <div><strong>Parent phone:</strong> {selected.parent_phone}</div>
              {selected.resolved_at && <div><strong>Resolved:</strong> {fmtDateTime(selected.resolved_at)}</div>}
              {selected.closed_at && <div><strong>Closed:</strong> {fmtDateTime(selected.closed_at)}</div>}
              <div><strong>Last updated:</strong> {fmtDateTime(selected.updated_at)}</div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
