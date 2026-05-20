'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { T, type Lang } from '@/lib/i18n';

interface Vendor { id: string; name: string; vendor_type: string; contact_name: string | null; contact_phone: string | null; contact_email: string | null; gst_number: string | null; contract_start: string | null; contract_end: string | null; is_active: boolean; notes: string | null; }

const VENDOR_TYPES = ['transport', 'food', 'maintenance', 'it', 'security', 'cleaning', 'other'];
const TYPE_ICON: Record<string, string> = { transport: '🚌', food: '🍽', maintenance: '🔧', it: '💻', security: '🔒', cleaning: '🧹', other: '📦' };

export default function VendorsPage() {
  const [lang, setLang] = useState<Lang>('en');
  useEffect(() => {
    const stored = localStorage.getItem('edprosys_lang') as Lang | null;
    if (stored) setLang(stored);
    const h = () => { const u = localStorage.getItem('edprosys_lang') as Lang | null; if (u) setLang(u); };
    window.addEventListener('edprosys_lang_change', h);
    return () => window.removeEventListener('edprosys_lang_change', h);
  }, []);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [form, setForm] = useState({ name: '', vendor_type: 'transport', contact_name: '', contact_phone: '', contact_email: '', gst_number: '', contract_start: '', contract_end: '', notes: '' });
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    setLoading(true);
    const url = typeFilter ? `/api/admin/vendors?type=${typeFilter}` : '/api/admin/vendors';
    const d = await fetch(url).then(r => r.json());
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
    if (res.ok) { setMsg('Saved'); setEditId(null); setForm({ name: '', vendor_type: 'transport', contact_name: '', contact_phone: '', contact_email: '', gst_number: '', contract_start: '', contract_end: '', notes: '' }); void load(); }
    else setMsg(d.error ?? 'Error');
    setSaving(false);
  }

  async function toggle(v: Vendor) {
    await fetch('/api/admin/vendors', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: v.id, is_active: !v.is_active }) });
    void load();
  }

  const inputStyle = { width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const };

  return (
    <Layout title={T('vendors', lang)} subtitle="Manage service vendors — transport, food, maintenance and more">
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 0 40px' }}>

        {/* Form */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 18, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{editId ? 'Edit Vendor' : 'Add Vendor'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 8 }}>
            <input placeholder="Vendor name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
            <select value={form.vendor_type} onChange={e => setForm(f => ({ ...f, vendor_type: e.target.value }))} style={{ ...inputStyle, background: '#fff' }}>
              {VENDOR_TYPES.map(t => <option key={t} value={t}>{TYPE_ICON[t]} {t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
            <input placeholder="Contact name" value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} style={inputStyle} />
            <input placeholder="Phone" value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} style={inputStyle} />
            <input placeholder="Email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
            <input placeholder="GST number" value={form.gst_number} onChange={e => setForm(f => ({ ...f, gst_number: e.target.value }))} style={inputStyle} />
            <input type="date" placeholder="Contract start" value={form.contract_start} onChange={e => setForm(f => ({ ...f, contract_start: e.target.value }))} style={inputStyle} />
            <input type="date" placeholder="Contract end" value={form.contract_end} onChange={e => setForm(f => ({ ...f, contract_end: e.target.value }))} style={inputStyle} />
          </div>
          <input placeholder="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ ...inputStyle, marginBottom: 10 }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={save} disabled={saving || !form.name} style={{ padding: '8px 20px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {saving ? 'Saving...' : editId ? 'Update' : 'Add Vendor'}
            </button>
            {editId && <button onClick={() => { setEditId(null); setForm({ name: '', vendor_type: 'transport', contact_name: '', contact_phone: '', contact_email: '', gst_number: '', contract_start: '', contract_end: '', notes: '' }); }} style={{ padding: '8px 14px', background: '#F3F4F6', border: 'none', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>Cancel</button>}
            {msg && <span style={{ fontSize: 12, color: msg === 'Saved' ? '#065F46' : '#991B1B' }}>{msg}</span>}
          </div>
        </div>

        {/* Filter + List */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          <button onClick={() => setTypeFilter('')} style={{ padding: '5px 12px', background: !typeFilter ? '#4F46E5' : '#F3F4F6', color: !typeFilter ? '#fff' : '#374151', border: 'none', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>All</button>
          {VENDOR_TYPES.map(t => (
            <button key={t} onClick={() => setTypeFilter(t === typeFilter ? '' : t)} style={{ padding: '5px 12px', background: typeFilter === t ? '#4F46E5' : '#F3F4F6', color: typeFilter === t ? '#fff' : '#374151', border: 'none', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {TYPE_ICON[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {loading ? <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Loading...</div> : (
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
            {vendors.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>No vendors yet.</div> : vendors.map(v => (
              <div key={v.id} style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 12, opacity: v.is_active ? 1 : 0.5 }}>
                <div style={{ fontSize: 20 }}>{TYPE_ICON[v.vendor_type] ?? '📦'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{v.name}</div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>
                    {v.contact_name}{v.contact_phone ? ` · ${v.contact_phone}` : ''}{v.contact_email ? ` · ${v.contact_email}` : ''}
                    {v.contract_end ? ` · Contract until ${new Date(v.contract_end).toLocaleDateString('en-IN')}` : ''}
                  </div>
                  {v.gst_number && <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>GST: {v.gst_number}</div>}
                  {v.notes && <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1, fontStyle: 'italic' }}>{v.notes}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => { setEditId(v.id); setForm({ name: v.name, vendor_type: v.vendor_type, contact_name: v.contact_name ?? '', contact_phone: v.contact_phone ?? '', contact_email: v.contact_email ?? '', gst_number: v.gst_number ?? '', contract_start: v.contract_start ?? '', contract_end: v.contract_end ?? '', notes: v.notes ?? '' }); }} style={{ padding: '5px 10px', background: '#F3F4F6', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Edit</button>
                  <button onClick={() => toggle(v)} style={{ padding: '5px 10px', background: v.is_active ? '#FEE2E2' : '#D1FAE5', color: v.is_active ? '#991B1B' : '#065F46', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>{v.is_active ? 'Deactivate' : 'Activate'}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
