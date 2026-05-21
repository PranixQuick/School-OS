'use client';
// Anganwadi nutrition supplement distribution log
// AWW records: egg distribution (Mon/Wed/Fri), iron tablets, Vitamin A, IFA for pregnant mothers

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface Child { id: string; name: string; class: string; }
interface LogEntry { id: string; supplement_type: string; quantity: number; unit: string; distribution_date: string; student?: { name: string }; }

const SUPPLEMENTS = [
  { value: 'egg', label: '🥚 Egg', unit: 'units', default_qty: 1 },
  { value: 'milk_powder', label: '🥛 Milk Powder', unit: 'grams', default_qty: 30 },
  { value: 'groundnut_chikki', label: '🥜 Groundnut Chikki', unit: 'pieces', default_qty: 2 },
  { value: 'iron_tablet', label: '💊 Iron Folic Acid (IFA)', unit: 'tablets', default_qty: 1 },
  { value: 'vitamin_a', label: '💉 Vitamin A (dose)', unit: 'doses', default_qty: 1 },
  { value: 'deworming_tablet', label: '💊 Deworming Tablet', unit: 'tablets', default_qty: 1 },
  { value: 'thr_rice', label: '🍚 THR Rice (Take-Home Ration)', unit: 'kg', default_qty: 3 },
  { value: 'thr_dal', label: '🫘 THR Dal', unit: 'kg', default_qty: 1 },
];

export default function AnganwadiNutritionPage() {
  const today = new Date().toISOString().split('T')[0];
  const [children, setChildren] = useState<Child[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Bulk distribution form
  const [supplement, setSupplement] = useState('egg');
  const [qty, setQty] = useState('1');
  const [date, setDate] = useState(today);
  const [mode, setMode] = useState<'all'|'select'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cr, lr] = await Promise.all([
        fetch('/api/anganwadi/children'),
        fetch(`/api/anganwadi/nutrition?date=${today}`),
      ]);
      if (cr.ok) { const d = await cr.json() as { students?: Child[] }; setChildren(d.students ?? []); }
      if (lr.ok) { const d = await lr.json() as { logs?: LogEntry[] }; setLogs(d.logs ?? []); }
    } catch {/**/}
    setLoading(false);
  }, [today]);

  useEffect(() => { void load(); }, [load]);

  const selectedSupp = SUPPLEMENTS.find(s => s.value === supplement);

  async function save() {
    if (!supplement) { alert('Select supplement'); return; }
    const targetIds = mode === 'all' ? children.map(c => c.id) : Array.from(selectedIds);
    if (targetIds.length === 0) { alert('Select at least one child'); return; }
    setSaving(true);
    try {
      const r = await fetch('/api/anganwadi/nutrition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplement_type: supplement,
          quantity: Number(qty),
          unit: selectedSupp?.unit ?? 'units',
          distribution_date: date,
          student_ids: targetIds,
        }),
      });
      if (r.ok) { setSelectedIds(new Set()); void load(); }
      else { const d = await r.json() as { error?: string }; alert(d.error ?? 'Error'); }
    } catch { alert('Network error'); }
    setSaving(false);
  }

  const inp = { height: 46, borderRadius: 9, border: '1px solid #D1D5DB', padding: '0 12px', fontSize: 15, fontFamily: 'inherit', background: '#F9FAFB', boxSizing: 'border-box' as const };

  return (
    <Layout title="పోషక పంపిణీ" subtitle="Nutrition Supplement Distribution">
      {/* Distribution form */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 12 }}>💊 పోషకాలు పంచండి</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Supplement</label>
            <select value={supplement} onChange={e => { setSupplement(e.target.value); setQty(String(SUPPLEMENTS.find(s => s.value === e.target.value)?.default_qty ?? 1)); }} style={{ ...inp, width: '100%' }}>
              {SUPPLEMENTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Qty ({selectedSupp?.unit})</label>
            <input type="number" inputMode="decimal" value={qty} onChange={e => setQty(e.target.value)} style={{ ...inp, width: '100%' }} />
          </div>
          <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inp, width: '100%' }} />
          </div>
          <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Distribute To</label>
            <select value={mode} onChange={e => setMode(e.target.value as 'all'|'select')} style={{ ...inp, width: '100%' }}>
              <option value="all">All {children.length} children</option>
              <option value="select">Select children</option>
            </select>
          </div>
        </div>
        {mode === 'select' && (
          <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #E5E7EB', borderRadius: 8, marginBottom: 10 }}>
            {children.map(c => (
              <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid #F9FAFB', cursor: 'pointer' }}>
                <input type="checkbox" checked={selectedIds.has(c.id)} onChange={e => { const s = new Set(selectedIds); e.target.checked ? s.add(c.id) : s.delete(c.id); setSelectedIds(s); }} />
                <span style={{ fontSize: 13, color: '#374151' }}>{c.name} ({c.class})</span>
              </label>
            ))}
          </div>
        )}
        <button onClick={() => void save()} disabled={saving}
          style={{ width: '100%', height: 48, borderRadius: 12, border: 'none', background: saving ? '#9CA3AF' : '#D97706', color: '#fff', fontSize: 15, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
          {saving ? 'పంచుతోంది…' : `💊 Distribute to ${mode === 'all' ? children.length : selectedIds.size} children`}
        </button>
      </div>

      {/* Today's log */}
      {!loading && logs.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>నేటి పంపిణీ ({today})</div>
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
            {logs.slice(0, 10).map((log, i) => (
              <div key={log.id} style={{ padding: '8px 14px', borderBottom: i < Math.min(logs.length,10)-1 ? '1px solid #F9FAFB' : 'none', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#374151' }}>{log.supplement_type.replace(/_/g,' ')}</span>
                <span style={{ color: '#6B7280' }}>{log.quantity} {log.unit}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Layout>
  );
}
