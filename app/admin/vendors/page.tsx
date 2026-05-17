'use client';
import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface Vendor { id: string; name: string; vendor_type: string; contact_name: string | null; contact_phone: string | null; contract_start: string | null; contract_end: string | null; is_active: boolean; notes: string | null; }

const VENDOR_TYPES = ['transport', 'food', 'maintenance', 'it', 'security', 'cleaning', 'other'];
const TYPE_ICON: Record<string, string> = { transport: '🚌', food: '🍽', maintenance: '🔧', it: '💻', security: '🔒', cleaning: '🧹', other: '📦' };

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [toast, setToast] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', vendor_type: 'transport', contact_name: '', contact_phone: '', contact_email: '', gst_number: '', address: '', contract_start: '', contract_end: '', notes: '' });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const q = filterType ? `?type=${filterType}` : '';
    const r = await fetch(`/api/admin/vendors${q}`);
    const d = await r.json();
    setVendors(d.vendors ?? []);
    setLoading(false);
  }, [filterType]);

  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!form.name) { setFormError('Vendor name required'); return; }
    setSubmitting(true); setFormError('');
    const isEdit = !!editId;
    const r = await fetch('/api/admin/vendors', {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isEdit ? { id: editId, ...form } : form),
    });
    const d = await r.json(); setSubmitting(false);
    if (!r.ok) { setFormError(d.error ?? 'Failed'); return; }
    setToast(isEdit ? 'Vendor updated' : 'Vendor added'); setTimeout(() => setToast(''), 3000);
    setShowAdd(false); setEditId(null); setForm({ name: '', vendor_type: 'transport', contact_name: '', contact_phone: '', contact_email: '', gst_number: '', address: '', contract_start: '', contract_end: '', notes: '' });
    load();
  }

  function editVendor(v: Vendor) {
    setEditId(v.id);
    setForm({ name: v.name, vendor_type: v.vendor_type, contact_name: v.contact_name ?? '', contact_phone: v.contact_phone ?? '', contact_email: '', gst_number: '', address: '', contract_start: v.contract_start ?? '', contract_end: v.contract_end ?? '', notes: v.notes ?? '' });
    setShowAdd(true);
  }

  async function toggleActive(v: Vendor) {
    const r = await fetch('/api/admin/vendors', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: v.id, is_active: !v.is_active }) });
    if (r.ok) { setToast(v.is_active ? 'Vendor deactivated' : 'Vendor reactivated'); setTimeout(() => setToast(''), 3000); load(); }
  }

  return (
    <Layout title="Vendors" subtitle="Transport, food, maintenance and other service providers">
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: '#111827', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>{toast}</div>}

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {['', ...VENDOR_TYPES].map(t => (
          <button key={t} onClick={() => setFilterType(t)}
            style={{ padding: '5px 12px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: filterType === t ? '#4F46E5' : '#F3F4F6', color: filterType === t ? '#fff' : '#374151' }}>
            {t ? `${TYPE_ICON[t] ?? '📦'} ${t.charAt(0).toUpperCase() + t.slice(1)}` : 'All'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => { setShowAdd(v => !v); setEditId(null); }}
          style={{ padding: '8px 16px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {showAdd && !editId ? 'Cancel' : '+ Add Vendor'}
        </button>
      </div>

      {showAdd && (
        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{editId ? 'Edit Vendor' : 'Add Vendor'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
            <div><label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={{ width: '100%', height: 36, border: '1px solid #D1D5DB', borderRadius: 7, padding: '0 10px', fontSize: 13, boxSizing: 'border-box' }} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>Type</label>
              <select value={form.vendor_type} onChange={e => setForm(f => ({ ...f, vendor_type: e.target.value }))} style={{ width: '100%', height: 36, border: '1px solid #D1D5DB', borderRadius: 7, padding: '0 8px', fontSize: 13 }}>
                {VENDOR_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select></div>
            {[['Contact Person', 'contact_name'], ['Phone', 'contact_phone'], ['Email', 'contact_email'], ['GST Number', 'gst_number'], ['Contract Start', 'contract_start'], ['Contract End', 'contract_end']].map(([label, key]) => (
              <div key={key}><label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>{label}</label>
                <input type={key.includes('start') || key.includes('end') ? 'date' : 'text'} value={(form as Record<string, string>)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={{ width: '100%', height: 36, border: '1px solid #D1D5DB', borderRadius: 7, padding: '0 10px', fontSize: 13, boxSizing: 'border-box' }} /></div>
            ))}
          </div>
          <div style={{ marginTop: 8 }}><label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ width: '100%', border: '1px solid #D1D5DB', borderRadius: 7, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} /></div>
          {formError && <div style={{ color: '#991B1B', fontSize: 12, marginTop: 8 }}>{formError}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={submit} disabled={submitting} style={{ padding: '8px 14px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {submitting ? 'Saving...' : editId ? 'Update' : 'Add Vendor'}
            </button>
            <button onClick={() => { setShowAdd(false); setEditId(null); }} style={{ padding: '8px 14px', background: '#fff', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>Loading...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {vendors.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>No vendors added yet.</div>}
          {vendors.map(v => (
            <div key={v.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 16 }}>{TYPE_ICON[v.vendor_type] ?? '📦'}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: v.is_active ? '#111827' : '#9CA3AF' }}>{v.name}</span>
                  {!v.is_active && <span style={{ fontSize: 10, background: '#F3F4F6', color: '#6B7280', padding: '1px 6px', borderRadius: 6, fontWeight: 600 }}>INACTIVE</span>}
                </div>
                {v.contact_name && <div style={{ fontSize: 12, color: '#6B7280' }}>{v.contact_name}{v.contact_phone ? ` · ${v.contact_phone}` : ''}</div>}
                {(v.contract_start || v.contract_end) && <div style={{ fontSize: 11, color: '#9CA3AF' }}>Contract: {v.contract_start ?? '—'} → {v.contract_end ?? 'ongoing'}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => editVendor(v)} style={{ padding: '5px 10px', background: '#fff', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Edit</button>
                <button onClick={() => toggleActive(v)} style={{ padding: '5px 10px', background: v.is_active ? '#FEF2F2' : '#F0FDF4', border: `1px solid ${v.is_active ? '#FECACA' : '#BBF7D0'}`, borderRadius: 6, fontSize: 12, cursor: 'pointer', color: v.is_active ? '#991B1B' : '#065F46' }}>
                  {v.is_active ? 'Deactivate' : 'Reactivate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
