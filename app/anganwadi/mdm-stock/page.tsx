'use client';
// app/anganwadi/mdm-stock/page.tsx
// Anganwadi Mid-Day Meal stock management.
// AWW enters daily stock: rice, dal, eggs, oil, milk powder.
// Closing stock auto-calculated. Shortage alert when below threshold.

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface StockItem {
  id: string; item_name: string; item_category?: string;
  opening_stock: number; received_qty: number; consumed_qty: number;
  closing_stock: number; unit: string; min_threshold?: number;
  shortage_alert: boolean; record_date: string;
}

const ITEMS = ['Rice','Dal (Toor)','Eggs','Groundnut Oil','Milk Powder','Vegetables','Pulses'];
const UNITS: Record<string, string> = {
  'Rice':'kg','Dal (Toor)':'kg','Eggs':'units','Groundnut Oil':'kg','Milk Powder':'kg',
  'Vegetables':'kg','Pulses':'kg',
};
const THRESHOLDS: Record<string, number> = {
  'Rice':10,'Dal (Toor)':3,'Eggs':50,'Groundnut Oil':1,'Milk Powder':2,
};

export default function AnganwadiMDMStockPage() {
  const [stocks, setStocks]     = useState<StockItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [item, setItem]         = useState('');
  const [opening, setOpening]   = useState('');
  const [received, setReceived] = useState('');
  const [consumed, setConsumed] = useState('');
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const today = new Date().toISOString().split('T')[0];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/anganwadi/mdm-stock');
      if (r.ok) { const d = await r.json() as { stocks?: StockItem[] }; setStocks(d.stocks ?? []); }
    } catch {/* ignore */}
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const closing = opening && (Number(opening) + Number(received || 0) - Number(consumed || 0));
  const unit = UNITS[item] ?? 'units';
  const threshold = THRESHOLDS[item] ?? 0;
  const shortage = closing !== false && closing < threshold;

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
        setSaved(true); setItem(''); setOpening(''); setReceived(''); setConsumed('');
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
  const inp = { width:'100%', height:50, fontSize:17, borderRadius:10, border:'1px solid #D1D5DB', padding:'0 14px', outline:'none', fontFamily:'inherit', boxSizing:'border-box' as const, background:'#F9FAFB' };
  const lbl = { fontSize:13, fontWeight:700 as const, color:'#374151', display:'block' as const, marginBottom:6 };

  return (
    <Layout title="ఆహార నిల్వ నమోదు" subtitle="MDM Stock Register">
      {saved && (
        <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:10, padding:'12px 16px', marginBottom:14, fontSize:14, fontWeight:600, color:'#15803D' }}>
          ✅ స్టాక్ సేవ్ అయింది!
        </div>
      )}

      {/* Shortage alerts */}
      {shortageItems.length > 0 && (
        <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:10, padding:'10px 14px', marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#B91C1C', marginBottom:6 }}>⚠️ నిల్వ తక్కువగా ఉంది:</div>
          {shortageItems.map(s => (
            <div key={s.id} style={{ fontSize:12, color:'#B91C1C' }}>
              {s.item_name}: {s.closing_stock} {s.unit} remaining
            </div>
          ))}
        </div>
      )}

      {/* Entry form */}
      <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:14, padding:18, marginBottom:16 }}>
        <div style={{ fontSize:14, fontWeight:700, color:'#111827', marginBottom:14 }}>🍱 నేటి స్టాక్ నమోదు ({today})</div>
        <div style={{ marginBottom:12 }}>
          <label style={lbl}>వస్తువు ఎంచుకోండి</label>
          <select value={item} onChange={e => setItem(e.target.value)} style={{...inp}}>
            <option value="">— వస్తువు —</option>
            {ITEMS.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:12 }}>
          <div>
            <label style={lbl}>ఓపెనింగ్ ({unit})</label>
            <input type="number" inputMode="decimal" min="0" value={opening}
              onChange={e => setOpening(e.target.value)} placeholder="0" style={inp} />
          </div>
          <div>
            <label style={lbl}>వచ్చినది ({unit})</label>
            <input type="number" inputMode="decimal" min="0" value={received}
              onChange={e => setReceived(e.target.value)} placeholder="0" style={inp} />
          </div>
          <div>
            <label style={lbl}>వాడినది ({unit})</label>
            <input type="number" inputMode="decimal" min="0" value={consumed}
              onChange={e => setConsumed(e.target.value)} placeholder="0" style={inp} />
          </div>
        </div>

        {/* Closing stock preview */}
        {item && opening && (
          <div style={{ marginBottom:14, padding:'10px 14px', background:shortage ? '#FEF2F2' : '#F0FDF4', borderRadius:10, border:`1px solid ${shortage ? '#FECACA' : '#BBF7D0'}` }}>
            <span style={{ fontSize:14, fontWeight:700, color:shortage ? '#B91C1C' : '#15803D' }}>
              క్లోజింగ్ స్టాక్: {closing} {unit}
              {shortage ? ` ⚠️ తక్కువగా ఉంది (minimum ${threshold} ${unit})` : ' ✓'}
            </span>
          </div>
        )}

        <button onClick={() => void save()} disabled={saving || !item || !opening}
          style={{ width:'100%', height:50, borderRadius:12, border:'none', background:saving || !item || !opening ? '#9CA3AF' : '#15803D', color:'#fff', fontSize:15, fontWeight:800, cursor:saving || !item || !opening ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}>
          {saving ? 'సేవ్ చేస్తోంది…' : '💾 సేవ్ చేయి'}
        </button>
      </div>

      {/* Today's stocks */}
      {!loading && stocks.length > 0 && (
        <>
          <div style={{ fontSize:13, fontWeight:700, color:'#6B7280', letterSpacing:'.04em', textTransform:'uppercase', marginBottom:10 }}>
            నేటి నిల్వ ({today})
          </div>
          <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:14, overflow:'hidden' }}>
            {stocks.map((s, i) => (
              <div key={s.id} style={{ padding:'10px 16px', borderBottom:i<stocks.length-1 ? '1px solid #F9FAFB' : 'none', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'#111827' }}>{s.item_name}</div>
                  <div style={{ fontSize:11, color:'#9CA3AF' }}>
                    Open: {s.opening_stock} + Recd: {s.received_qty} - Used: {s.consumed_qty}
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:15, fontWeight:800, color:s.shortage_alert ? '#B91C1C' : '#15803D' }}>
                    {s.closing_stock} {s.unit}
                  </div>
                  {s.shortage_alert && <div style={{ fontSize:10, color:'#B91C1C', fontWeight:600 }}>⚠ తక్కువ</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Layout>
  );
}
