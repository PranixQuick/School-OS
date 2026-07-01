'use client';
import { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import EntityDetailCard, { DetailField } from '@/components/EntityDetailCard';
import { T } from '@/lib/i18n';
import { useLang } from '@/lib/useLang';

interface Parent { id: string; name: string; phone: string; student_name?: string; class?: string; section?: string; last_access?: string; }

export default function AdminParentsPage() {
  const { lang } = useLang();
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowMsg, setRowMsg] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [detail, setDetail] = useState<Parent | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '' });
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');

  const classesList = useMemo(() => Array.from(new Set(parents.map(p => p.class).filter(Boolean))).sort(), [parents]);
  const sectionsList = useMemo(() => Array.from(new Set(parents.filter(p => !selectedClass || p.class === selectedClass).map(p => p.section).filter(Boolean))).sort(), [parents, selectedClass]);

  useEffect(() => {
    fetch('/api/admin/parents').then(r => r.ok ? r.json() : { parents: [] })
      .then(d => { setParents(d.parents ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const visible = parents.filter(p => {
    if (selectedClass && p.class !== selectedClass) return false;
    if (selectedSection && p.section !== selectedSection) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !p.phone.includes(search) && !(p.student_name ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const detailFields: DetailField[] = detail ? [
    { label: 'Phone', value: detail.phone || '—', href: detail.phone ? `tel:${detail.phone}` : undefined },
    { label: 'Student', value: detail.student_name || '—' },
    { label: 'Class', value: [detail.class, detail.section].filter(Boolean).join('-') || '—' },
    { label: 'Last access', value: detail.last_access ? new Date(detail.last_access).toLocaleString() : 'Never' },
  ] : [];

  async function sendCredentials(p: Parent) {
    if (busyId) return;
    if (!window.confirm(`Send login PIN to ${p.name} (${p.phone}) by WhatsApp/SMS?`)) return;
    setBusyId(p.id);
    setRowMsg(m => ({ ...m, [p.id]: { ok: true, text: 'Sending…' } }));
    try {
      const r = await fetch('/api/admin/parents/resend-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent_id: p.id }),
      });
      const d = await r.json().catch(() => ({}));
      setRowMsg(m => ({ ...m, [p.id]: r.ok ? { ok: true, text: 'PIN sent ✓' } : { ok: false, text: (d as { error?: string }).error || 'Failed' } }));
    } catch {
      setRowMsg(m => ({ ...m, [p.id]: { ok: false, text: 'Network error' } }));
    } finally {
      setBusyId(null);
    }
  }

  async function resetPin(p: Parent) {
    if (busyId) return;
    if (!window.confirm(`Reset ${p.name}'s PIN? A new PIN will be generated and sent to ${p.phone}.`)) return;
    setBusyId(p.id);
    setRowMsg(m => ({ ...m, [p.id]: { ok: true, text: 'Resetting…' } }));
    try {
      const r = await fetch(`/api/admin/parents/${p.id}/reset-pin`, { method: 'PATCH' });
      const d = await r.json().catch(() => ({}));
      setRowMsg(m => ({ ...m, [p.id]: r.ok ? { ok: true, text: 'PIN reset & sent ✓' } : { ok: false, text: (d as { error?: string }).error || 'Failed' } }));
    } catch {
      setRowMsg(m => ({ ...m, [p.id]: { ok: false, text: 'Network error' } }));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Layout title={T('parents', lang)} subtitle={`${parents.length} registered parents`}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, phone, or student…" className="input"
          style={{ flex: 2, minWidth: 180, height: 38, fontSize: 13, boxSizing: 'border-box', border: '1px solid #D1D5DB', borderRadius: 8, padding: '0 12px' }} />
        
        <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedSection(''); }}
          style={{ height: 38, border: '1px solid #D1D5DB', borderRadius: 8, padding: '0 8px', fontSize: 13, background: '#fff', minWidth: 120 }}>
          <option value="">All Classes</option>
          {classesList.map(c => <option key={c} value={c ?? ''}>Class {c}</option>)}
        </select>

        <select value={selectedSection} onChange={e => setSelectedSection(e.target.value)}
          style={{ height: 38, border: '1px solid #D1D5DB', borderRadius: 8, padding: '0 8px', fontSize: 13, background: '#fff', minWidth: 100 }}>
          <option value="">All Sections</option>
          {sectionsList.map(s => <option key={s} value={s ?? ''}>Section {s}</option>)}
        </select>
      </div>
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👨‍👩‍👧</div>
          <div className="empty-state-title">No parents registered</div>
          <div className="empty-state-sub">Parents register automatically when a student is added with a phone number.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {visible.map((p, i) => {
            const msg = rowMsg[p.id];
            return (
              <div key={p.id} style={{ padding: '11px 16px', borderBottom: i < visible.length-1 ? '1px solid #F3F4F6' : 'none',
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#EEF2FF', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#4F46E5', fontSize: 13 }}>
                  {p.name[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <button onClick={() => setDetail(p)} style={{ fontWeight: 600, fontSize: 14, color: '#4F46E5', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>{p.name}</button>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>
                    {p.phone}{p.student_name ? ` · ${p.student_name}` : ''}{p.class ? ` (Class ${p.class}${p.section ?? ''})` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {msg && <span style={{ fontSize: 11, fontWeight: 600, color: msg.ok ? '#15803D' : '#B91C1C' }}>{msg.text}</span>}
                  <button onClick={() => sendCredentials(p)} disabled={busyId === p.id}
                    style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: '1px solid #C7D2FE',
                      background: '#EEF2FF', color: '#4F46E5', cursor: busyId === p.id ? 'default' : 'pointer', opacity: busyId === p.id ? 0.6 : 1 }}>
                    Send PIN
                  </button>
                  <button onClick={() => resetPin(p)} disabled={busyId === p.id}
                    style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: '1px solid #E5E7EB',
                      background: '#fff', color: '#374151', cursor: busyId === p.id ? 'default' : 'pointer', opacity: busyId === p.id ? 0.6 : 1 }}>
                    Reset PIN
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <EntityDetailCard
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.name ?? 'Parent'}
        subtitle={detail?.phone}
        fields={detailFields}
        footer={
          detail && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => {
                setEditId(detail.id);
                setEditForm({ name: detail.name, phone: detail.phone });
                setDetail(null);
              }} style={{ padding: '6px 12px', fontSize: 12, background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                Edit Details
              </button>
              <button onClick={async () => {
                if (window.confirm(`Deactivate parent ${detail.name}?`)) {
                  const res = await fetch('/api/admin/parents', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: detail.id, is_active: false })
                  });
                  if (res.ok) {
                    setDetail(null);
                    const d = await fetch('/api/admin/parents').then(r => r.json());
                    setParents(d.parents ?? []);
                  }
                }
              }} style={{ padding: '6px 12px', fontSize: 12, background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                Deactivate
              </button>
            </div>
          )
        }
      />
      {editId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, width: 320 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Edit Parent Details</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Full Name</label>
              <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                style={{ width: '100%', height: 36, border: '1px solid #D1D5DB', borderRadius: 8, padding: '0 10px', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Phone Number</label>
              <input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                style={{ width: '100%', height: 36, border: '1px solid #D1D5DB', borderRadius: 8, padding: '0 10px', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditId(null)} style={{ padding: '6px 12px', background: '#F3F4F6', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Cancel</button>
              <button onClick={async () => {
                const res = await fetch('/api/admin/parents', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: editId, name: editForm.name, phone: editForm.phone })
                });
                if (res.ok) {
                  setEditId(null);
                  const d = await fetch('/api/admin/parents').then(r => r.json());
                  setParents(d.parents ?? []);
                } else {
                  alert('Failed to update parent details');
                }
              }} style={{ padding: '6px 12px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
