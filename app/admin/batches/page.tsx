'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

interface Batch { id: string; label: string; entry_year: number; capacity: number | null; group_code: string | null; student_count: number; department?: { name: string; code: string } | null; }
interface Dept { id: string; code: string; name: string; }

export default function BatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(true);
  const [institutionType, setInstitutionType] = useState('school_k10');
  const [form, setForm] = useState({ label: '', entry_year: new Date().getFullYear().toString(), capacity: '', group_code: 'MPC', department_id: '' });
  const [groupPreset, setGroupPreset] = useState('MPC');
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  async function load() {
    setLoading(true);
    const [b, d, c] = await Promise.all([
      fetch(`/api/admin/batches${showArchived ? '?include_archived=1' : ''}`).then(r => r.json()),
      fetch('/api/admin/departments').then(r => r.json()),
      fetch('/api/config').then(r => r.ok ? r.json() : null),
    ]);
    setBatches(b.batches ?? []);
    setDepts(d.departments ?? []);
    if (c?.institution_type) {
      setInstitutionType(c.institution_type);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, [showArchived]);

  async function save() {
    setSaving(true); setMsg('');
    const method = editId ? 'PATCH' : 'POST';
    const body = editId
      ? { id: editId, label: form.label, entry_year: Number(form.entry_year), capacity: form.capacity ? Number(form.capacity) : null, group_code: form.group_code || null, department_id: form.department_id || null }
      : { label: form.label, entry_year: Number(form.entry_year), capacity: form.capacity ? Number(form.capacity) : null, group_code: form.group_code || null, department_id: form.department_id || null };
    const res = await fetch('/api/admin/batches', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await res.json();
    if (res.ok) {
      setMsg('Saved');
      setEditId(null);
      setForm({ label: '', entry_year: new Date().getFullYear().toString(), capacity: '', group_code: 'MPC', department_id: '' });
      setGroupPreset('MPC');
      void load();
    }
    else setMsg(d.error ?? 'Error');
    setSaving(false);
  }

  async function autoCreateCollegeCohorts() {
    setSaving(true); setMsg('Creating cohorts...');
    const currentYear = new Date().getFullYear();
    const batch1 = { label: 'Intermediate 1st Year', entry_year: currentYear, capacity: 100, group_code: 'MPC' };
    const batch2 = { label: 'Intermediate 2nd Year', entry_year: currentYear + 1, capacity: 100, group_code: 'MPC' };
    try {
      const r1 = await fetch('/api/admin/batches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(batch1) });
      const r2 = await fetch('/api/admin/batches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(batch2) });
      if (r1.ok && r2.ok) {
        setMsg('Successfully created Intermediate 1st & 2nd Year cohorts!');
        void load();
      } else {
        setMsg('Failed to auto-create some cohorts.');
      }
    } catch {
      setMsg('Error auto-creating cohorts.');
    }
    setSaving(false);
  }

  async function archive(id: string) {
    await fetch('/api/admin/batches', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'archive' }) });
    void load();
  }

  const inputStyle = { width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' as const };

  return (
    <Layout title="Batches" subtitle="Manage student batches for colleges and coaching centres">
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 0 40px' }}>
        
        {institutionType === 'junior_college' && (
          <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 12, padding: '16px 20px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#3730A3' }}>Private Junior College Quick Setup</div>
              <div style={{ fontSize: 12, color: '#4F46E5', marginTop: 2 }}>Auto-provision your Intermediate 1st Year & 2nd year cohorts with one click.</div>
            </div>
            <button onClick={autoCreateCollegeCohorts} disabled={saving} style={{ padding: '8px 16px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              Create Both Cohorts
            </button>
          </div>
        )}

        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>{editId ? 'Edit Batch' : 'Add Batch'}</div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>BATCH LABEL</label>
              <input placeholder="Label (e.g. 2026 Intermediate 1st Year)" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>ENTRY YEAR</label>
              <input type="number" placeholder="Entry year" value={form.entry_year} onChange={e => setForm(f => ({ ...f, entry_year: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>CAPACITY</label>
              <input type="number" placeholder="Capacity (optional)" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>GROUP / STREAM</label>
              <select
                value={groupPreset}
                onChange={e => {
                  const val = e.target.value;
                  setGroupPreset(val);
                  if (val !== 'custom') {
                    setForm(f => ({ ...f, group_code: val }));
                  } else {
                    setForm(f => ({ ...f, group_code: '' }));
                  }
                }}
                style={{ ...inputStyle, background: '#fff' }}
              >
                <option value="MPC">MPC (Maths, Physics, Chemistry)</option>
                <option value="BiPC">BiPC (Biology, Physics, Chemistry)</option>
                <option value="CEC">CEC (Civics, Economics, Commerce)</option>
                <option value="HEC">HEC (History, Economics, Civics)</option>
                <option value="MEC">MEC (Maths, Economics, Commerce)</option>
                <option value="custom">Other (Custom Group...)</option>
              </select>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>DEPARTMENT</label>
              <select value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))} style={{ ...inputStyle, background: '#fff' }}>
                <option value="">Department (optional)</option>
                {depts.map(d => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
              </select>
            </div>
          </div>

          {groupPreset === 'custom' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>CUSTOM GROUP CODE</label>
              <input
                placeholder="Type custom group code (e.g. PCMC, MBiPC)"
                value={form.group_code}
                onChange={e => setForm(f => ({ ...f, group_code: e.target.value }))}
                style={inputStyle}
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={save} disabled={saving || !form.label} style={{ padding: '8px 20px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {saving ? 'Saving...' : editId ? 'Update' : 'Add Batch'}
            </button>
            {editId && <button onClick={() => { setEditId(null); setForm({ label: '', entry_year: new Date().getFullYear().toString(), capacity: '', group_code: 'MPC', department_id: '' }); setGroupPreset('MPC'); }} style={{ padding: '8px 14px', background: '#F3F4F6', border: 'none', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>Cancel</button>}
            {msg && <span style={{ fontSize: 13, color: msg.includes('Error') || msg.includes('Failed') ? '#991B1B' : '#065F46' }}>{msg}</span>}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{batches.length} batch{batches.length !== 1 ? 'es' : ''}</div>
          <label style={{ fontSize: 13, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} /> Show archived
          </label>
        </div>

        {loading ? <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Loading...</div> : (
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
            {batches.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>No batches yet.</div>
            ) : batches.map(b => {
              const archived = b.label.startsWith('[archived]');
              return (
                <div key={b.id} style={{ padding: '14px 18px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 12, opacity: archived ? 0.5 : 1 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{b.label}</div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                      {b.entry_year} · {b.student_count} students{b.capacity ? ` / ${b.capacity} capacity` : ''}{b.group_code ? ` · ${b.group_code}` : ''}{b.department ? ` · ${b.department.code}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {!archived && <button onClick={() => {
                      setEditId(b.id);
                      setForm({ label: b.label, entry_year: String(b.entry_year), capacity: b.capacity ? String(b.capacity) : '', group_code: b.group_code ?? '', department_id: '' });
                      const presets = ['MPC', 'BiPC', 'CEC', 'HEC', 'MEC'];
                      if (b.group_code && presets.includes(b.group_code)) {
                        setGroupPreset(b.group_code);
                      } else {
                        setGroupPreset('custom');
                      }
                    }} style={{ padding: '5px 12px', background: '#F3F4F6', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Edit</button>}
                    {!archived && <button onClick={() => archive(b.id)} style={{ padding: '5px 12px', background: '#FEF3C7', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#92400E' }}>Archive</button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
