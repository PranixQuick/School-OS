'use client';
// app/anganwadi/mdm-stock/page.tsx
// Anganwadi MDM (Mid-Day Meal) stock management.
// AWW enters daily opening/received/consumed; closing auto-calculated.
// Shortage alert triggered when closing < threshold.
// Mobile-first, large inputs, Telugu labels, low-end Android safe.

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface StockItem {
  id: string; item_name: string; opening_stock: number; received_qty: number;
  consumed_qty: number; closing_stock: number; unit: string; record_date: string;
  shortage_alert: boolean; min_threshold?: number;
}

const ITEMS = ['Rice','Dal (Toor)','Eggs','Groundnut Oil','Milk Powder','Vegetables','Other'];
const UNITS: Record<string, string> = {
  'Rice': 'kg', 'Dal (Toor)': 'kg', 'Eggs': 'units', 'Groundnut Oil': 'kg',
  'Milk Powder': 'kg', 'Vegetables': 'kg', 'Other': 'units',
};
const THRESHOLDS: Record<string, number> = {
  'Rice': 10, 'Dal (Toor)': 3, 'Eggs': 50, 'Groundnut Oil': 1,
  'Milk Powder': 2, 'Vegetables': 2, 'Other': 0,
};

export default function MDMStockPage() {
  const today = new Date().toISOString().split('T')[0];
  const [stocks, setStocks]     = useState<StockItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [item, setItem]         = useState('');
  const [opening, setOpening]   = useState('');
  const [received, setReceived] = useState('');
  const [consumed, setConsumed] = useState('');
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/anganwadi/mdm-stock');
      if (r.ok) { const d = await r.json() as { stocks?: StockItem[] }; setStocks(d.stocks ?? []); }
    } catch {/* ignore */}
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Compute closing stock: null when opening not entered yet
  const closingNum: number | null = opening
    ? Number(opening) + Number(received || 0) - Number(consumed || 0)
    : null;
  const unit      = UNITS[item]      ?? 'units';
  const threshold = THRESHOLDS[item] ?? 0;
  const shortage  = closingNum !== null && closingNum < threshold;

  async function save() {
    if (!item || !opening) { alert('వస్తువు మరియు ఓపెనింగ్ స్టాక్ అవసరం'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/anganwadi/mdm-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_name:      item,
          opening_stock:  Number(opening),
          received_qty:   Number(received || 0),
          consumed_qty:   Number(consumed || 0),
          unit,
          record_date:    today,
          min_threshold:  threshold || null,
          shortage_alert: shortage,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setItem(''); setOpening(''); setReceived(''); setConsumed('');
        setTimeout(() => setSaved(false), 3000);
        await load();
      } else {
        const d = await res.json() as { error?: string };
        alert(d.error ?? 'Save failed');
      }
    } catch { alert('Network error'); }
    setSaving(false);
  }

  const shortageItems = stocks.filter(s => s.shortage_alert);
  const inp = { width:'100%', height:50, fontSize:17, borderRadius:10, border:'1px solid #D1D5DB',
    padding:'0 14px', outline:'none', fontFamily:'inherit', boxSizing:'border-box' as const, background:'#F9FAFB' };
  const lbl = { fontSize:13, fontWeight:700 as const, color:'#374151', display:'block' as const, marginBottom:6 };

  return (
    <Layout title="MDM స్టాక్ నిర్వహణ" subtitle="Mid-Day Meal Stock Register">

      {/* Shortage alerts banner */}
      {shortageItems.length > 0 && (
        <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:12, padding:'12px 14px', marginBottom:14 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#B91C1C', marginBottom:4 }}>
            ⚠️ స్టాక్ హెచ్చరికలు ({shortageItems.length})
          </div>
          {shortageItems.map(s => (
            <div key={s.id} style={{ fontSize:13, color:'#B91C1C' }}>
              {s.item_name}: {s.closing_stock} {s.unit} మిగిలింది (కనిష్ఠం: {s.min_threshold ?? 0} {s.unit})
            </div>
          ))}
        </div>
      )}

      {saved && (
        <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:14, fontWeight:600, color:'#15803D' }}>
          ✅ స్టాక్ సేవ్ అయింది!
        </div>
      )}

      {/* Entry form */}
      <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:14, padding:18, marginBottom:16 }}>
        <div style={{ fontSize:14, fontWeight:700, color:'#111827', marginBottom:14 }}>📦 స్టాక్ నమోదు చేయండి</div>

        <div style={{ marginBottom:14 }}>
          <label style={lbl}>వస్తువు (Item)</label>
          <select value={item} onChange={e => setItem(e.target.value)} style={inp}>
            <option value="">— వస్తువు ఎంచుకోండి —</option>
            {ITEMS.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
          <div>
            <label style={lbl}>ఓపెనింగ్ స్టాక్ ({unit}) *</label>
            <input type="number" inputMode="decimal" value={opening}
              onChange={e => setOpening(e.target.value)} placeholder="0.0" style={inp} />
          </div>
          <div>
            <label style={lbl}>మళ్ళీ వచ్చింది ({unit})</label>
            <input type="number" inputMode="decimal" value={received}
              onChange={e => setReceived(e.target.value)} placeholder="0.0" style={inp} />
          </div>
          <div>
            <label style={lbl}>వాడినది ({unit})</label>
            <input type="number" inputMode="decimal" value={consumed}
              onChange={e => setConsumed(e.target.value)} placeholder="0.0" style={inp} />
          </div>
          <div>
            <label style={lbl}>మిగిలింది ({unit})</label>
            <div style={{ height:50, borderRadius:10, border:'2px solid', borderColor: shortage ? '#FECACA' : '#BBF7D0', background: shortage ? '#FEF2F2' : '#F0FDF4', display:'flex', alignItems:'center', padding:'0 14px', fontSize:18, fontWeight:800, color: shortage ? '#B91C1C' : '#15803D' }}>
              {closingNum !== null ? `${closingNum.toFixed(1)} ${unit}` : '—'}
            </div>
            {shortage && <div style={{ fontSize:11, color:'#B91C1C', marginTop:3 }}>⚠️ స్టాక్ తక్కువగా ఉంది!</div>}
          </div>
        </div>

        <button onClick={() => void save()} disabled={saving || !item || !opening}
          style={{ width:'100%', height:50, borderRadius:12, border:'none', background: saving || !item || !opening ? '#9CA3AF' : '#15803D', color:'#fff', fontSize:15, fontWeight:800, cursor: saving || !item || !opening ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}>
          {saving ? 'సేవ్ చేస్తోంది…' : '💾 స్టాక్ సేవ్ చేయి'}
        </button>
      </div>

      {/* Stock history for today */}
      <div style={{ fontSize:13, fontWeight:700, color:'#6B7280', letterSpacing:'.04em', textTransform:'uppercase', marginBottom:10 }}>
        నేటి స్టాక్ ({today})
      </div>
      {loading ? (
        <div style={{ padding:20, textAlign:'center', color:'#9CA3AF' }}>Loading…</div>
      ) : stocks.length === 0 ? (
        <div style={{ padding:20, textAlign:'center', color:'#9CA3AF', fontSize:13 }}>
          ఇంకా ఏ స్టాక్ నమోదు కాలేదు
        </div>
      ) : (
        <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:14, overflow:'hidden' }}>
          {stocks.map((s, i) => (
            <div key={s.id} style={{ padding:'10px 14px', borderBottom: i < stocks.length-1 ? '1px solid #F9FAFB' : 'none', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'#111827' }}>{s.item_name}</div>
                <div style={{ fontSize:11, color:'#9CA3AF' }}>
                  Open: {s.opening_stock} | +{s.received_qty} | -{s.consumed_qty} = {s.closing_stock} {s.unit}
                </div>
              </div>
              <span style={{ fontSize:12, fontWeight:700, padding:'3px 10px', borderRadius:8, background: s.shortage_alert ? '#FEF2F2' : '#F0FDF4', color: s.shortage_alert ? '#B91C1C' : '#15803D' }}>
                {s.shortage_alert ? '⚠️ తక్కువ' : '✅ OK'}
              </span>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
