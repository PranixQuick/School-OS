'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { T } from '@/lib/i18n';
import { useLang } from '@/lib/useLang';

interface Vendor {
  id: string; name: string; vendor_type: string;
  contact_name: string | null; contact_phone: string | null;
  contact_email: string | null; gst_number: string | null;
  contract_start: string | null; contract_end: string | null;
  is_active: boolean; notes: string | null;
}

const VENDOR_TYPES = ['transport', 'food', 'maintenance', 'it', 'security', 'cleaning', 'other'];
const TYPE_ICON: Record<string, string> = {
  transport: '🚌', food: '🍽', maintenance: '🔧',
  it: '💻', security: '🔒', cleaning: '🧹', other: '📦',
};
// i18n keys for vendor type labels
const TYPE_KEY: Record<string, string> = {
  transport: 'transport', food: 'food', maintenance: 'maintenance',
  it: 'it', security: 'security', cleaning: 'cleaning', other: 'other',
};

export default function VendorsPage() {
  const { lang } = useLang();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [form, setForm] = useState({
    name: '', vendor_type: 'transport', contact_name: '', contact_phone: '',
    contact_email: '', gst_number: '', contract_start: '', contract_end: '', notes: '',
  });
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
    const res = await fetch('/api/admin/vendors', {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const d = await res.json();
    if (res.ok) {
      setMsg(T('vendor_saved', lang as never));
      setEditId(null);
      setForm({ name: '', vendor_type: 'transport', contact_name: '', contact_phone: '', contact_email: '', gst_number: '', contract_start: '', contract_end: '', notes: '' });
      void load();
    } else {
      setMsg(d.error ?? T('error', lang as never));
    }
    setSaving(false);
  }

  async function toggle(v: Vendor) {
    await fetch('/api/admin/vendors', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: v.id, is_active: !v.is_active }),
    });
    void load();
  }

  const inputStyle = {
    width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB',
    borderRadius: 7, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const,
  };

  const vendorTypeLabel = (type: string) =>
    `${TYPE_ICON[type] ?? '📦'} ${T(TYPE_KEY[type] ?? 'other', lang as never)}`;

  return (
    <Layout title={T('vendors', lang as never)} subtitle={T('vendor_management', lang as never)}>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 0 40px' }}>

        {/* Form */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 18, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
            {editId ? T('edit_vendor', lang as never) : T('add_vendor', lang as never)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 8 }}>
            <input
              placeholder={T('vendor_name_ph', lang as never)}
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              style={inputStyle} />
            <select value={form.vendor_type}
              onChange={e => setForm(f => ({ ...f, vendor_type: e.target.value }))}
              style={{ ...inputStyle, background: '#fff' }}>
              {VENDOR_TYPES.map(t => (
                <option key={t} value={t}>{vendorTypeLabel(t)}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
            <input placeholder={T('contact_name_ph', lang as never)} value={form.contact_name}
              onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} style={inputStyle} />
            <input placeholder={T('phone', lang as never)} value={form.contact_phone}
              onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} style={inputStyle} />
            <input placeholder={T('email', lang as never)} value={form.contact_email}
              onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
            <input placeholder={T('gst_number_ph', lang as never)} value={form.gst_number}
              onChange={e => setForm(f => ({ ...f, gst_number: e.target.value }))} style={inputStyle} />
            <input type="date" value={form.contract_start}
              onChange={e => setForm(f => ({ ...f, contract_start: e.target.value }))} style={inputStyle} />
            <input type="date" value={form.contract_end}
              onChange={e => setForm(f => ({ ...f, contract_end: e.target.value }))} style={inputStyle} />
          </div>
          <input placeholder={T('notes_ph', lang as never)} value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            style={{ ...inputStyle, marginBottom: 10 }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={save} disabled={saving || !form.name}
              style={{ padding: '8px 20px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {saving
                ? T('saving_vendor', lang as never)
                : editId ? T('update_vendor', lang as never) : T('add_vendor', lang as never)}
            </button>
            {editId && (
              <button onClick={() => {
                setEditId(null);
                setForm({ name: '', vendor_type: 'transport', contact_name: '', contact_phone: '', contact_email: '', gst_number: '', contract_start: '', contract_end: '', notes: '' });
              }} style={{ padding: '8px 14px', background: '#F3F4F6', border: 'none', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>
                {T('cancel', lang as never)}
              </button>
            )}
            {msg && (
              <span style={{ fontSize: 12, color: msg === T('vendor_saved', lang as never) ? '#065F46' : '#991B1B' }}>
                {msg}
              </span>
            )}
          </div>
        </div>

        {/* Filter */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          <button onClick={() => setTypeFilter('')}
            style={{ padding: '5px 12px', background: !typeFilter ? '#4F46E5' : '#F3F4F6', color: !typeFilter ? '#fff' : '#374151', border: 'none', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {T('all_filter', lang as never)}
          </button>
          {VENDOR_TYPES.map(t => (
            <button key={t} onClick={() => setTypeFilter(t === typeFilter ? '' : t)}
              style={{ padding: '5px 12px', background: typeFilter === t ? '#4F46E5' : '#F3F4F6', color: typeFilter === t ? '#fff' : '#374151', border: 'none', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {vendorTypeLabel(t)}
            </button>
          ))}
        </div>

        {/* Vendor list */}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>{T('loading', lang as never)}</div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
            {vendors.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>
                {T('no_vendors_yet', lang as never)}
              </div>
            ) : vendors.map(v => (
              <div key={v.id} style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 12, opacity: v.is_active ? 1 : 0.5 }}>
                <div style={{ fontSize: 20 }}>{TYPE_ICON[v.vendor_type] ?? '📦'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{v.name}</div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>
                    {v.contact_name}{v.contact_phone ? ` · ${v.contact_phone}` : ''}{v.contact_email ? ` · ${v.contact_email}` : ''}
                    {v.contract_end ? ` · ${T('contract_until', lang as never)} ${new Date(v.contract_end).toLocaleDateString('en-IN')}` : ''}
                  </div>
                  {v.gst_number && <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>GST: {v.gst_number}</div>}
                  {v.notes && <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1, fontStyle: 'italic' }}>{v.notes}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => {
                    setEditId(v.id);
                    setForm({ name: v.name, vendor_type: v.vendor_type, contact_name: v.contact_name ?? '', contact_phone: v.contact_phone ?? '', contact_email: v.contact_email ?? '', gst_number: v.gst_number ?? '', contract_start: v.contract_start ?? '', contract_end: v.contract_end ?? '', notes: v.notes ?? '' });
                  }} style={{ padding: '5px 10px', background: '#F3F4F6', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                    {T('edit', lang as never)}
                  </button>
                  <button onClick={() => toggle(v)}
                    style={{ padding: '5px 10px', background: v.is_active ? '#FEE2E2' : '#D1FAE5', color: v.is_active ? '#991B1B' : '#065F46', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                    {v.is_active ? T('deactivate', lang as never) : T('activate', lang as never)}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
