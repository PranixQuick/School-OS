'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

interface Vendor { id: string; name: string; vendor_type: string; contact_name: string | null; contact_phone: string | null; contract_end: string | null; is_active: boolean; notes: string | null; }

const VENDOR_TYPES = ['transport', 'food', 'maintenance', 'it', 'security', 'cleaning', 'other'];
const TYPE_ICON: Record<string, string> = { transport: '🚌', food: '🍽', maintenance: '🔧', it: '💻', security: '🔒', cleaning: '🧹', other: '🤝' };

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', vendor_type: 'transport', contact_name: '', contact_phone: '', contact_email: '', gst_number: '', address: '', contract_start: '', contract_end: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    setLoading(true);
    const q = typeFilter !== 'all' ? `?type=${typeFilter}` : '';
    const d = await fetch(`/api/admin/vendors${q}`).then(r => r.json());
    setVendors(d.vendors ?? []);
    setLoading(false);
  }
  useEffect(() => { void load(); }, [typeFilter]);

  async function save() {
    setSaving(true); setMsg('');
    const method = editId ? 'PATCH' : 'POST';
    const body = editId ? { id: editId, ...form } : form;
    const res = await fetch('/api/admin/vendors', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await res.json();
    setSaving(false);
    if (res.ok) { setMsg('Saved'); setShowForm(false); setEditId(null); setForm({ name: '', vendor_type: 'transport', contact_name: '', contact_phone: '', contact_email: '', gst_number: '', address: '', contract_start: '', contract_end: '', notes: '' }); void load(); }
    else setMsg(d.error ?? 'Error');
  }

  async function toggle(v: Vendor) {
    await fetch('/api/admin/vendors', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: v.id, is_active: !v.is_active }) });
    void load();
  }

  const S = { card: { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 14, marginBottom: 8 } as React.CSSProperties };

  return (
    <Layout title="Vendors" subtitle="External service providers — transport, food, maintenance">
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px 40px' }}>
        {msg && <div style={{ background: msg.includes('rror') ? '#FEE2E2' : '#D1FAE5', color: msg.includes('rror') ? '#991B1B' : '#065F46', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>{msg}</div>}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['all', ...VENDOR_TYPES].map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                style={{ padding: '5px 12px', border: 'none', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: typeFilter === t ? '#4F46E5' : '#F3F4F6', color: typeFilter === t ? '#fff' : '#374151' }}>
                {t === 'all' ? 'All' : `${TYPE_ICON[t] ?? ''} ${t}`}
              </button>
            ))}
          </div>
          <button onClick={() => { setShowForm(true); setEditId(null); setForm({ name: '', vendor_type: 'transport', contact_name: '', contact_phone: '', contact_email: '', gst_number: '', address: '', contract_start: '', contract_end: '', notes: '' }); }}
            style={{ padding: '8px 16px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            + Add Vendor
          </button>
        </div>

        {showForm && (
          <div style={{ ...S.card, border: '2px solid #4F46E5', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>{editId ? 'Edit Vendor' : 'New Vendor'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>VENDOR NAME *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={{ width: '100%', padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' as const }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>TYPE</label>
                <select value={form.vendor_type} onChange={e => setForm(f => ({ ...f, vendor_type: e.target.value }))} style={{ width: '100%', padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13 }}>
                  {VENDOR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              {(['contact_name', 'contact_phone', 'contact_email', 'gst_number'] as const).map(k => (
                <div key={k}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>{k.replace('_', ' ').toUpperCase()}</label>
                  <input value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} style={{ width: '100%', padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' as const }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              {(['contract_start', 'contract_end'] as const).map(k => (
                <div key={k}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>{k === 'contract_start' ? 'CONTRACT START' : 'CONTRACT END'}</label>
                  <input type="date" value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} style={{ width: '100%', padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13 }} />
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>NOTES</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ width: '100%', padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' as const }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={save} disabled={saving || !form.name} style={{ flex: 1, padding: '8px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{saving ? 'Saving...' : editId ? 'Update' : 'Add Vendor'}</button>
              <button onClick={() => { setShowForm(false); setEditId(null); }} style={{ padding: '8px 14px', background: '#F3F4F6', border: 'none', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}

        {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading...</div> :
          vendors.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#9CA3AF' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🤝</div>
              <div>No vendors yet. Add your transport, food or maintenance vendors.</div>
            </div>
          ) : vendors.map(v => (
            <div key={v.id} style={{ ...S.card, opacity: v.is_active ? 1 : 0.55 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 16 }}>{TYPE_ICON[v.vendor_type] ?? '🤝'}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{v.name}</span>
                    <span style={{ background: '#F3F4F6', color: '#374151', borderRadius: 5, padding: '1px 6px', fontSize: 10, fontWeight: 600 }}>{v.vendor_type}</span>
                  </div>
                  {v.contact_name && <div style={{ fontSize: 12, color: '#6B7280' }}>{v.contact_name}{v.contact_phone ? ` · ${v.contact_phone}` : ''}</div>}
                  {v.contract_end && <div style={{ fontSize: 11, color: new Date(v.contract_end) < new Date() ? '#991B1B' : '#374151', marginTop: 2 }}>Contract ends: {v.contract_end}</div>}
                  {v.notes && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{v.notes}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => { setEditId(v.id); setForm({ name: v.name, vendor_type: v.vendor_type, contact_name: v.contact_name ?? '', contact_phone: v.contact_phone ?? '', contact_email: '', gst_number: '', address: '', contract_start: '', contract_end: v.contract_end ?? '', notes: v.notes ?? '' }); setShowForm(true); }}
                    style={{ padding: '5px 10px', background: '#F3F4F6', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Edit</button>
                  <button onClick={() => void toggle(v)} style={{ padding: '5px 10px', background: v.is_active ? '#FEE2E2' : '#D1FAE5', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: v.is_active ? '#991B1B' : '#065F46', fontWeight: 600 }}>
                    {v.is_active ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
            </div>
          ))}
      </div>
    </Layout>
  );
}
