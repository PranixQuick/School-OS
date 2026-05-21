'use client';
// Sanitary inventory — menstrual hygiene, soap, cleaning supplies
// Applicable: govt schools, residential, premium private
// Mobile-first, large inputs, Telugu support

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface InventoryItem {
  id: string; item_name: string; item_type: string;
  stock_count: number; min_stock_alert: number;
  last_restocked_at: string | null;
}

const ITEM_TYPES = [
  { value: 'sanitary_pad', label: '🩸 Sanitary Pads (Whisper/Stayfree)', te: 'శానిటరీ ప్యాడ్స్' },
  { value: 'soap', label: '🧼 Hand Soap / Bar Soap', te: 'సబ్బు' },
  { value: 'toilet_paper', label: '🧻 Toilet Paper', te: 'టాయిలెట్ పేపర్' },
  { value: 'cleaning_liquid', label: '🧴 Cleaning Liquid / Phenyl', te: 'ఫినైల్' },
  { value: 'disinfectant', label: '💧 Disinfectant Spray', te: 'స్ప్రే' },
  { value: 'bucket_mug', label: '🪣 Bucket / Mug Set', te: 'బకెట్' },
  { value: 'other', label: '📦 Other', te: 'ఇతర' },
];

export default function SanitaryInventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ item_name: '', item_type: 'sanitary_pad', stock_count: '', min_stock_alert: '10' });
  const [restockId, setRestockId] = useState<string | null>(null);
  const [restockQty, setRestockQty] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/sanitary-inventory');
      if (r.ok) { const d = await r.json() as { items?: InventoryItem[] }; setItems(d.items ?? []); }
    } catch {/**/}
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function addItem() {
    if (!form.item_name || !form.stock_count) { alert('Item name and quantity required'); return; }
    setAdding(true);
    const r = await fetch('/api/admin/sanitary-inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, stock_count: Number(form.stock_count), min_stock_alert: Number(form.min_stock_alert) }),
    });
    setAdding(false);
    if (r.ok) { setShowAdd(false); setForm({ item_name: '', item_type: 'sanitary_pad', stock_count: '', min_stock_alert: '10' }); void load(); }
  }

  async function restock(id: string) {
    if (!restockQty) { alert('Enter quantity'); return; }
    const r = await fetch('/api/admin/sanitary-inventory', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, restock_qty: Number(restockQty) }),
    });
    if (r.ok) { setRestockId(null); setRestockQty(''); void load(); }
  }

  const shortages = items.filter(i => i.stock_count <= i.min_stock_alert);
  const inp = { height: 46, borderRadius: 9, border: '1px solid #D1D5DB', padding: '0 12px', fontSize: 15, fontFamily: 'inherit', background: '#F9FAFB', width: '100%', boxSizing: 'border-box' as const };

  return (
    <Layout title="Sanitary Inventory" subtitle="స్వచ్ఛత నిర్వహణ">
      {shortages.length > 0 && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: 13, fontWeight: 700, color: '#B91C1C' }}>
          ⚠️ Low stock: {shortages.map(s => s.item_name).join(', ')}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{items.length} items tracked</div>
        <button onClick={() => setShowAdd(v => !v)}
          style={{ padding: '8px 16px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          {showAdd ? 'Cancel' : '+ Add Item'}
        </button>
      </div>

      {showAdd && (
        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Item Type</label>
              <select value={form.item_type} onChange={e => setForm(p => ({ ...p, item_type: e.target.value, item_name: ITEM_TYPES.find(t => t.value === e.target.value)?.label ?? '' }))} style={inp}>
                {ITEM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Item Name</label>
              <input value={form.item_name} onChange={e => setForm(p => ({ ...p, item_name: e.target.value }))} placeholder="Custom name" style={inp} />
            </div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Current Stock (units)</label>
              <input type="number" inputMode="numeric" value={form.stock_count} onChange={e => setForm(p => ({ ...p, stock_count: e.target.value }))} placeholder="0" style={inp} />
            </div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Alert Threshold</label>
              <input type="number" inputMode="numeric" value={form.min_stock_alert} onChange={e => setForm(p => ({ ...p, min_stock_alert: e.target.value }))} placeholder="10" style={inp} />
            </div>
          </div>
          <button onClick={() => void addItem()} disabled={adding}
            style={{ width: '100%', height: 46, marginTop: 12, borderRadius: 10, border: 'none', background: adding ? '#9CA3AF' : '#15803D', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {adding ? 'Saving…' : '💾 Save Item'}
          </button>
        </div>
      )}

      {loading ? <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(item => {
            const isLow = item.stock_count <= item.min_stock_alert;
            return (
              <div key={item.id} style={{ background: '#fff', border: `1px solid ${isLow ? '#FECACA' : '#E5E7EB'}`, borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{item.item_name}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>Alert at: {item.min_stock_alert} units</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: isLow ? '#B91C1C' : '#15803D' }}>{item.stock_count}</div>
                    <div style={{ fontSize: 10, color: '#9CA3AF' }}>units</div>
                  </div>
                </div>
                {restockId === item.id ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="number" inputMode="numeric" value={restockQty} onChange={e => setRestockQty(e.target.value)} placeholder="Qty to add" style={{ ...inp, flex: 1 }} />
                    <button onClick={() => void restock(item.id)} style={{ padding: '0 14px', height: 46, borderRadius: 9, border: 'none', background: '#4F46E5', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
                    <button onClick={() => setRestockId(null)} style={{ padding: '0 12px', height: 46, borderRadius: 9, border: '1px solid #E5E7EB', background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                  </div>
                ) : (
                  <button onClick={() => { setRestockId(item.id); setRestockQty(''); }}
                    style={{ width: '100%', height: 38, borderRadius: 8, border: '1px solid #E5E7EB', background: '#F9FAFB', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    + Restock
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
