'use client';
// app/admin/scholarships/page.tsx
// Batch 4A — Scholarship tracking.
// Guard: scholarship_tracking_enabled feature flag.
// List + Add modal + per-row status update.

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface Scholarship { id: string; student_id: string; student_name: string; student_class?: string; student_section?: string; scholarship_name: string; provider: string; amount: number | null; status: string; applied_at: string; approved_at: string | null; expiry_date: string | null; notes: string | null; }

const PROVIDERS = ['NSP','state_govt','PM_POSHAN','custom'];
const STATUS_COLORS: Record<string, [string,string]> = {
  active: ['#D1FAE5','#065F46'], applied: ['#FEF9C3','#92400E'],
  approved: ['#DBEAFE','#1E40AF'], expired: ['#F3F4F6','#6B7280'],
  rejected: ['#FEE2E2','#991B1B'],
};

function Badge({ status }: { status: string }) {
  const [bg, fg] = STATUS_COLORS[status] ?? ['#F3F4F6','#374151'];
  return <span style={{ background: bg, color: fg, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5 }}>{status}</span>;
}

export default function ScholarshipsPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [students, setStudents] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ student_id: '', scholarship_name: '', provider: 'NSP', amount: '', expiry_date: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [updateState, setUpdateState] = useState<Record<string, string>>({});

  useEffect(() => {
    void fetch('/api/admin/institution-config')
      .then(r => r.json()).then((d: { feature_flags?: Record<string, unknown> }) => {
        setEnabled(!!(d.feature_flags?.scholarship_tracking_enabled));
      }).catch(() => setEnabled(false));
    // Load student list for modal
    void fetch('/api/admin/students?limit=200').then(r => r.ok ? r.json() : null)
      .then((d: { students?: { id: string; name: string }[] } | null) => { if (d?.students) setStudents(d.students); });
  }, []);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    const res = await fetch(`/api/admin/scholarships?status=${statusFilter}`);
    const d = await res.json() as { scholarships?: Scholarship[] };
    setScholarships(d.scholarships ?? []);
    setLoading(false);
  }, [enabled, statusFilter]);

  useEffect(() => { if (enabled) void load(); }, [enabled, load]);

  async function addScholarship() {
    setSaving(true);
    const res = await fetch('/api/admin/scholarships', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: form.amount ? parseFloat(form.amount) : null }),
    });
    if (res.ok) { setShowModal(false); setForm({ student_id:'',scholarship_name:'',provider:'NSP',amount:'',expiry_date:'',notes:'' }); void load(); }
    setSaving(false);
  }

  async function updateStatus(id: string, status: string) {
    setUpdateState(prev => ({ ...prev, [id]: 'loading' }));
    const res = await fetch(`/api/admin/scholarships/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setUpdateState(prev => ({ ...prev, [id]: res.ok ? 'done' : 'error' }));
    if (res.ok) void load();
    setTimeout(() => setUpdateState(prev => { const n = { ...prev }; delete n[id]; return n; }), 2000);
  }

  const cardStyle = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, marginBottom: 20 };
  const inputStyle = { width: '100%', padding: '6px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 12, boxSizing: 'border-box' as const, marginTop: 3 };

  if (enabled === null) return <Layout title="Scholarships"><div style={{ padding: 40, color: '#9CA3AF' }}>Loading...</div></Layout>;
  if (!enabled) return (
    <Layout title="Scholarships">
      <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🎓</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#374151' }}>Scholarship tracking not enabled</div>
        <div style={{ fontSize: 12, marginTop: 6 }}>Enable "Scholarship tracking" in Settings → Institution.</div>
      </div>
    </Layout>
  );

  return (
    <Layout title="Scholarships" subtitle="Track student scholarships and welfare programmes"
      actions={<button onClick={() => setShowModal(true)} style={{ padding: '6px 14px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Add Scholarship</button>}>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {['all','active','applied','approved','expired','rejected'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            style={{ padding: '4px 12px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: statusFilter===s ? '#4F46E5' : '#fff', color: statusFilter===s ? '#fff' : '#374151' }}>
            {s}
          </button>
        ))}
      </div>

      <div style={cardStyle}>
        {loading ? <div style={{ color: '#9CA3AF', fontSize: 12, padding: 20 }}>Loading...</div> : scholarships.length === 0 ? (
          <div style={{ color: '#9CA3AF', fontSize: 12, padding: 20, textAlign: 'center' }}>No scholarships found.</div>
        ) : (
          <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  {['Student','Scholarship','Provider','Amount','Status','Expiry','Actions'].map(h => (
                    <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, fontSize: 10, color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scholarships.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '7px 10px', fontWeight: 600 }}>{s.student_name}<div style={{ fontSize: 10, color: '#9CA3AF' }}>{s.student_class}-{s.student_section}</div></td>
                    <td style={{ padding: '7px 10px' }}>{s.scholarship_name}</td>
                    <td style={{ padding: '7px 10px', color: '#6B7280' }}>{s.provider}</td>
                    <td style={{ padding: '7px 10px', fontWeight: 700 }}>{s.amount != null ? `₹${Number(s.amount).toLocaleString('en-IN')}` : '—'}</td>
                    <td style={{ padding: '7px 10px' }}><Badge status={s.status} /></td>
                    <td style={{ padding: '7px 10px', color: '#6B7280' }}>{s.expiry_date ?? '—'}</td>
                    <td style={{ padding: '7px 10px' }}>
                      <select value="" onChange={e => { if (e.target.value) void updateStatus(s.id, e.target.value); }}
                        disabled={updateState[s.id]==='loading'}
                        style={{ fontSize: 10, padding: '3px 6px', border: '1px solid #D1D5DB', borderRadius: 5, cursor: 'pointer' }}>
                        <option value="">Update...</option>
                        {['approved','active','expired','rejected'].filter(v => v !== s.status).map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                      {updateState[s.id]==='done' && <span style={{ fontSize: 9, color: '#065F46', marginLeft: 4 }}>✓</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000080', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 420, maxWidth: '95vw' }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 18 }}>Add Scholarship</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280' }}>Student</div>
                <select value={form.student_id} onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))} style={inputStyle}>
                  <option value="">Select student...</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div><div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280' }}>Scholarship Name</div>
                <input value={form.scholarship_name} onChange={e => setForm(f => ({ ...f, scholarship_name: e.target.value }))} style={inputStyle} />
              </div>
              <div><div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280' }}>Provider</div>
                <select value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} style={inputStyle}>
                  {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div><div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280' }}>Amount (₹)</div>
                <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={inputStyle} />
              </div>
              <div><div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280' }}>Expiry Date</div>
                <input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} style={inputStyle} />
              </div>
              <div><div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280' }}>Notes</div>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'none' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '8px', background: '#F3F4F6', border: 'none', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => void addScholarship()} disabled={saving || !form.student_id || !form.scholarship_name}
                style={{ flex: 2, padding: '8px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {saving ? 'Saving...' : 'Add Scholarship'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
