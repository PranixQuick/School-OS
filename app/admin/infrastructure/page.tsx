'use client';
// School Infrastructure Deficiency Log
// Track: toilets, water, classrooms, labs, electricity, furniture, boundary walls
// Govt schools: auto-flag to MEO when condition=poor/non_functional
// Private schools: internal tracking only
// Mobile-first: quick tap-to-log, photo URL optional

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface InfraItem {
  id: string; category: string; condition_rating: string;
  item_count: number; notes: string | null; flagged_to_meo: boolean;
  inspection_date: string; resolved_at: string | null;
}

const CATEGORIES = [
  { value: 'toilet', label: '🚻 Toilets / Washrooms' },
  { value: 'water', label: '💧 Drinking Water' },
  { value: 'classroom', label: '🏫 Classrooms' },
  { value: 'lab', label: '🧪 Science / Computer Lab' },
  { value: 'electricity', label: '⚡ Electricity / Power' },
  { value: 'furniture', label: '🪑 Furniture / Benches' },
  { value: 'boundary_wall', label: '🧱 Boundary Wall / Gate' },
  { value: 'ramp_accessibility', label: '♿ Ramp / Accessibility' },
  { value: 'library_infra', label: '📚 Library Room' },
  { value: 'other', label: '📦 Other' },
];

const CONDITION_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  good:           { bg: '#F0FDF4', color: '#15803D', label: '✅ Good' },
  fair:           { bg: '#FFFBEB', color: '#D97706', label: '⚠️ Fair' },
  poor:           { bg: '#FFF7ED', color: '#C2410C', label: '🔴 Poor' },
  non_functional: { bg: '#FEF2F2', color: '#B91C1C', label: '❌ Non-Functional' },
};

export default function InfrastructurePage() {
  const [items, setItems]     = useState<InfraItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [filterCond, setFilterCond] = useState<'all' | 'poor' | 'non_functional'>('all');
  const [form, setForm]       = useState({
    category: 'toilet', condition_rating: 'poor', item_count: '1',
    notes: '', inspection_date: new Date().toISOString().split('T')[0],
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/infrastructure');
      if (r.ok) { const d = await r.json() as { items?: InfraItem[] }; setItems(d.items ?? []); }
    } catch {/**/}
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function addItem() {
    if (!form.category) { alert('Category required'); return; }
    setSaving(true);
    const r = await fetch('/api/admin/infrastructure', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, item_count: Number(form.item_count) }),
    });
    setSaving(false);
    if (r.ok) { setShowAdd(false); void load(); }
    else { const d = await r.json() as { error?: string }; alert(d.error ?? 'Error'); }
  }

  async function resolveItem(id: string) {
    await fetch('/api/admin/infrastructure', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, resolved: true }) });
    void load();
  }

  const filtered = items.filter(i => {
    if (filterCond === 'all') return !i.resolved_at;
    return !i.resolved_at && i.condition_rating === filterCond;
  });
  const poorCount = items.filter(i => !i.resolved_at && (i.condition_rating === 'poor' || i.condition_rating === 'non_functional')).length;
  const inp = { height: 44, borderRadius: 9, border: '1px solid #D1D5DB', padding: '0 12px', fontSize: 14, fontFamily: 'inherit', background: '#F9FAFB', width: '100%', boxSizing: 'border-box' as const };

  return (
    <Layout title="Infrastructure Log" subtitle="Record and track facility conditions">
      {poorCount > 0 && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 13, fontWeight: 700, color: '#B91C1C' }}>
          ⚠️ {poorCount} item(s) in poor/non-functional condition requiring attention
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {(['all','poor','non_functional'] as const).map(f => (
          <button key={f} onClick={() => setFilterCond(f)} style={{ padding: '5px 12px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: filterCond===f ? '#4F46E5' : '#F3F4F6', color: filterCond===f ? '#fff' : '#374151', fontFamily: 'inherit' }}>
            {f === 'all' ? `All (${items.filter(i=>!i.resolved_at).length})` : f === 'poor' ? '🔴 Poor' : '❌ Non-Functional'}
          </button>
        ))}
        <button onClick={() => setShowAdd(v => !v)} style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 20, border: 'none', background: '#4F46E5', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          {showAdd ? '✕' : '+ Log Issue'}
        </button>
      </div>

      {showAdd && (
        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Category *</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={inp}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Condition</label>
              <select value={form.condition_rating} onChange={e => setForm(p => ({ ...p, condition_rating: e.target.value }))} style={inp}>
                {Object.entries(CONDITION_STYLE).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Count</label>
              <input type="number" inputMode="numeric" value={form.item_count} onChange={e => setForm(p => ({ ...p, item_count: e.target.value }))} style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Date</label>
              <input type="date" value={form.inspection_date} onChange={e => setForm(p => ({ ...p, inspection_date: e.target.value }))} style={inp} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Notes</label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Describe the issue…" rows={3} style={{ ...inp, height: 'auto', padding: '10px 12px' }} />
            </div>
          </div>
          <button onClick={() => void addItem()} disabled={saving} style={{ width: '100%', height: 44, borderRadius: 10, border: 'none', background: saving ? '#9CA3AF' : '#4F46E5', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Saving…' : '📋 Log Infrastructure Issue'}
          </button>
        </div>
      )}

      {loading ? <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div> :
        filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', background: '#F0FDF4', borderRadius: 12 }}>
            ✅ {filterCond === 'all' ? 'No open issues logged' : `No ${filterCond.replace('_',' ')} items`}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(item => {
              const cs = CONDITION_STYLE[item.condition_rating] ?? CONDITION_STYLE.poor;
              const cat = CATEGORIES.find(c => c.value === item.category);
              return (
                <div key={item.id} style={{ background: cs.bg, border: `1px solid ${cs.color}30`, borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{cat?.label ?? item.category}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
                        {item.item_count} unit(s) · {item.inspection_date}
                        {item.flagged_to_meo && <span style={{ marginLeft: 8, color: '#1E40AF', fontWeight: 700 }}>⚑ Flagged to MEO</span>}
                      </div>
                      {item.notes && <div style={{ fontSize: 12, color: '#374151', marginTop: 4 }}>{item.notes}</div>}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 8, background: 'white', color: cs.color, flexShrink: 0, marginLeft: 8 }}>
                      {cs.label}
                    </span>
                  </div>
                  <button onClick={() => void resolveItem(item.id)} style={{ width: '100%', height: 36, borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', color: '#15803D', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    ✅ Mark Resolved
                  </button>
                </div>
              );
            })}
          </div>
        )
      }
    </Layout>
  );
}
