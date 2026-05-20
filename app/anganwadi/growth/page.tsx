'use client';
// app/anganwadi/growth/page.tsx
// Anganwadi child growth record entry.
// AWW enters monthly weight, height, MUAC, malnutrition category.
// Mobile-first, large inputs for rural Android. Telugu UI.

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import { useLang } from '@/lib/useLang';

interface Child { id: string; name: string; class: string; roll_number: string; date_of_birth?: string; }
interface GrowthRecord {
  weight_kg?: number; height_cm?: number; muac_cm?: number;
  malnutrition_cat?: string; grade_for_age?: string; notes?: string;
}

const MAL_CATS = [
  { value: 'normal',     label: 'Normal / సాధారణం',      color: '#15803D', bg: '#F0FDF4' },
  { value: 'mam',        label: 'MAM (మితమైన)',           color: '#D97706', bg: '#FFF7ED' },
  { value: 'sam',        label: 'SAM (తీవ్రమైన) ⚠️',      color: '#B91C1C', bg: '#FEF2F2' },
  { value: 'overweight', label: 'Overweight',              color: '#7C3AED', bg: '#F5F3FF' },
];

export default function AnganwadiGrowthPage() {
  const { lang } = useLang();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<string>('');
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [form, setForm]         = useState<GrowthRecord>({});
  const [recent, setRecent]     = useState<Array<GrowthRecord & { recorded_date: string; child_name: string }>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/anganwadi/children');
      if (r.ok) { const d = await r.json() as { students?: Child[] }; setChildren(d.students ?? []); }
    } catch {/* ignore */}
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save() {
    if (!selected) { alert('దయచేసి పిల్లవాడిని ఎంచుకోండి'); return; }
    if (!form.weight_kg) { alert('బరువు తప్పనిసరి'); return; }
    setSaving(true); setSaved(false);
    try {
      const res = await fetch('/api/anganwadi/growth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: selected, ...form }),
      });
      if (res.ok) {
        setSaved(true);
        setForm({});
        setSelected('');
        setTimeout(() => setSaved(false), 3000);
        // Refresh recent records
        const r2 = await fetch('/api/anganwadi/growth/recent');
        if (r2.ok) { const d = await r2.json() as { records?: typeof recent }; setRecent(d.records ?? []); }
      } else {
        const d = await res.json() as { error?: string };
        alert(d.error ?? 'Save failed');
      }
    } catch { alert('Network error'); }
    setSaving(false);
  }

  useEffect(() => {
    fetch('/api/anganwadi/growth/recent')
      .then(r => r.ok ? r.json() : null)
      .then((d: { records?: typeof recent } | null) => { if (d?.records) setRecent(d.records); })
      .catch(() => {/* ignore */});
  }, []);

  const inp = { width: '100%', height: 52, fontSize: 18, borderRadius: 10, border: '1px solid #D1D5DB', padding: '0 14px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const, background: '#F9FAFB' };
  const lbl = { fontSize: 13, fontWeight: 700 as const, color: '#374151', display: 'block' as const, marginBottom: 6 };

  const ageMonths = selected && children.find(c => c.id === selected)?.date_of_birth
    ? Math.floor((Date.now() - new Date(children.find(c=>c.id===selected)!.date_of_birth!).getTime()) / (1000*60*60*24*30.4))
    : null;

  return (
    <Layout title="పిల్లల వృద్ధి నమోదు" subtitle="Child Growth Records">
      {saved && (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '12px 16px', marginBottom: 14, fontSize: 14, fontWeight: 600, color: '#15803D' }}>
          ✅ వృద్ధి వివరాలు సేవ్ అయ్యాయి!
        </div>
      )}

      {/* Child selector */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 18, marginBottom: 16 }}>
        <label style={lbl}>పిల్లవాడిని ఎంచుకోండి (Select Child)</label>
        {loading ? (
          <div style={{ color: '#9CA3AF', fontSize: 13 }}>Loading children…</div>
        ) : (
          <select value={selected} onChange={e => setSelected(e.target.value)}
            style={{ ...inp, height: 52, paddingLeft: 14 }}>
            <option value="">— పిల్లవాడిని ఎంచుకోండి —</option>
            {children.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.class} | {c.roll_number})
              </option>
            ))}
          </select>
        )}
        {ageMonths !== null && (
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 6 }}>
            వయస్సు: ~{ageMonths} నెలలు ({ageMonths < 12 ? `${ageMonths}m` : `${Math.floor(ageMonths/12)}y ${ageMonths%12}m`})
          </div>
        )}
      </div>

      {/* Measurements form */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 16 }}>📏 కొలతలు నమోదు చేయండి</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={lbl}>బరువు (kg) *</label>
            <input type="number" inputMode="decimal" step="0.1" min="1" max="50"
              value={form.weight_kg ?? ''} onChange={e => setForm(f => ({ ...f, weight_kg: parseFloat(e.target.value) || undefined }))}
              placeholder="e.g. 10.5" style={inp} />
          </div>
          <div>
            <label style={lbl}>ఎత్తు (cm)</label>
            <input type="number" inputMode="decimal" step="0.5" min="30" max="150"
              value={form.height_cm ?? ''} onChange={e => setForm(f => ({ ...f, height_cm: parseFloat(e.target.value) || undefined }))}
              placeholder="e.g. 85.0" style={inp} />
          </div>
          <div>
            <label style={lbl}>MUAC (cm)</label>
            <input type="number" inputMode="decimal" step="0.1" min="5" max="25"
              value={form.muac_cm ?? ''} onChange={e => setForm(f => ({ ...f, muac_cm: parseFloat(e.target.value) || undefined }))}
              placeholder="e.g. 12.5" style={inp} />
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>
              &lt;11.5cm = SAM | 11.5-12.5 = MAM | &gt;12.5 = Normal
            </div>
          </div>
        </div>

        {/* Malnutrition category */}
        <label style={{ ...lbl, marginBottom: 10 }}>పోషణ స్థితి (Nutrition Status)</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {MAL_CATS.map(cat => (
            <button key={cat.value} type="button"
              onClick={() => setForm(f => ({ ...f, malnutrition_cat: cat.value }))}
              style={{ padding: '12px 10px', borderRadius: 10, border: `2px solid ${form.malnutrition_cat === cat.value ? cat.color : '#E5E7EB'}`, background: form.malnutrition_cat === cat.value ? cat.bg : '#fff', color: cat.color, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' }}>
              {cat.label}
            </button>
          ))}
        </div>

        {/* SAM warning */}
        {form.malnutrition_cat === 'sam' && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#B91C1C' }}>⚠️ SAM అలర్ట్</div>
            <div style={{ fontSize: 13, color: '#B91C1C', marginTop: 4 }}>
              ఈ పిల్లవాడికి తక్షణ NRC రెఫరల్ అవసరం. Supervisor కి తెలియజేయండి.
            </div>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>గమనికలు (Notes)</label>
          <textarea value={form.notes ?? ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="ఏదైనా ప్రత్యేక గమనికలు…"
            rows={3}
            style={{ width: '100%', fontSize: 14, borderRadius: 10, border: '1px solid #D1D5DB', padding: '10px 14px', outline: 'none', fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box', background: '#F9FAFB' }} />
        </div>

        <button onClick={() => void save()} disabled={saving || !selected}
          style={{ width: '100%', height: 52, borderRadius: 12, border: 'none', background: saving || !selected ? '#9CA3AF' : '#15803D', color: '#fff', fontSize: 16, fontWeight: 800, cursor: saving || !selected ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
          {saving ? 'సేవ్ చేస్తోంది…' : '💾 వివరాలు సేవ్ చేయి'}
        </button>
      </div>

      {/* Recent records */}
      {recent.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#6B7280', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 10 }}>
            ఇటీవలి రికార్డులు
          </div>
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden' }}>
            {recent.slice(0, 5).map((r, i) => {
              const cat = MAL_CATS.find(c => c.value === r.malnutrition_cat);
              return (
                <div key={i} style={{ padding: '10px 14px', borderBottom: i < 4 ? '1px solid #F9FAFB' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{r.child_name}</div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>
                      {r.recorded_date ? new Date(r.recorded_date).toLocaleDateString('en-IN') : ''}
                      {r.weight_kg ? ` · ${r.weight_kg}kg` : ''}
                      {r.height_cm ? ` · ${r.height_cm}cm` : ''}
                    </div>
                  </div>
                  {cat && (
                    <span style={{ padding: '3px 10px', borderRadius: 8, background: cat.bg, color: cat.color, fontSize: 12, fontWeight: 700 }}>
                      {cat.value.toUpperCase()}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </Layout>
  );
}
