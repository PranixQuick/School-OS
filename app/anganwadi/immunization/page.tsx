'use client';
// app/anganwadi/immunization/page.tsx
// Anganwadi immunization record entry.
// AWW marks vaccines as administered or missed per child.
// Mobile-first, large inputs, Telugu labels.

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface Child { id: string; name: string; class: string; roll_number: string; date_of_birth?: string; }
interface ImmRecord {
  id: string; vaccine_name: string; scheduled_date?: string;
  administered_date?: string; status: string; dose_number: number;
}

const VACCINES = [
  { name: 'BCG',                  age: 'Birth',    dose: 1 },
  { name: 'OPV 0',                age: 'Birth',    dose: 1 },
  { name: 'Hepatitis B Birth',    age: 'Birth',    dose: 1 },
  { name: 'DPT 1 + OPV 1',       age: '6 Weeks',  dose: 1 },
  { name: 'DPT 2 + OPV 2',       age: '10 Weeks', dose: 2 },
  { name: 'DPT 3 + OPV 3',       age: '14 Weeks', dose: 3 },
  { name: 'Measles',              age: '9 Months', dose: 1 },
  { name: 'DPT Booster',         age: '16-24m',   dose: 4 },
  { name: 'OPV Booster',         age: '16-24m',   dose: 4 },
  { name: 'JE Vaccine',          age: '9-12m',    dose: 1 },
];

export default function AnganwadiImmunizationPage() {
  const [children, setChildren]       = useState<Child[]>([]);
  const [selected, setSelected]       = useState('');
  const [records, setRecords]         = useState<ImmRecord[]>([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState<string | null>(null);
  const [vaccine, setVaccine]         = useState('');
  const [adminDate, setAdminDate]     = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus]           = useState<'administered'|'missed'>('administered');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/anganwadi/children');
      if (r.ok) { const d = await r.json() as { students?: Child[] }; setChildren(d.students ?? []); }
    } catch {/* ignore */}
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const loadRecords = useCallback(async (studentId: string) => {
    try {
      const r = await fetch(`/api/anganwadi/immunization?student_id=${studentId}`);
      if (r.ok) { const d = await r.json() as { records?: ImmRecord[] }; setRecords(d.records ?? []); }
    } catch {/* ignore */}
  }, []);

  const handleSelect = async (id: string) => {
    setSelected(id);
    setRecords([]);
    if (id) await loadRecords(id);
  };

  async function save() {
    if (!selected || !vaccine) { alert('పిల్లవాడు మరియు vaccine ఎంచుకోండి'); return; }
    setSaving(vaccine);
    try {
      const res = await fetch('/api/anganwadi/immunization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: selected,
          vaccine_name: vaccine,
          administered_date: status === 'administered' ? adminDate : null,
          status,
          dose_number: VACCINES.find(v => v.name === vaccine)?.dose ?? 1,
        }),
      });
      if (res.ok) {
        setVaccine('');
        await loadRecords(selected);
      } else {
        const d = await res.json() as { error?: string };
        alert(d.error ?? 'Save failed');
      }
    } catch { alert('Network error'); }
    setSaving(null);
  }

  const administered = records.filter(r => r.status === 'administered');
  const missed       = records.filter(r => r.status === 'missed');

  const inp = { width: '100%', height: 50, fontSize: 16, borderRadius: 10, border: '1px solid #D1D5DB', padding: '0 14px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const, background: '#F9FAFB' };
  const lbl = { fontSize: 13, fontWeight: 700 as const, color: '#374151', display: 'block' as const, marginBottom: 6 };

  return (
    <Layout title="రోగనిరోధక టీకాలు" subtitle="Immunization Records">
      {/* Child selector */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 18, marginBottom: 16 }}>
        <label style={lbl}>పిల్లవాడిని ఎంచుకోండి</label>
        {loading ? (
          <div style={{ color: '#9CA3AF', fontSize: 13 }}>Loading…</div>
        ) : (
          <select value={selected} onChange={e => void handleSelect(e.target.value)} style={inp}>
            <option value="">— ఎంచుకోండి —</option>
            {children.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.class})</option>
            ))}
          </select>
        )}
      </div>

      {/* Add record */}
      {selected && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 14 }}>
            💉 టీకా నమోదు చేయండి
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Vaccine</label>
            <select value={vaccine} onChange={e => setVaccine(e.target.value)} style={inp}>
              <option value="">— Vaccine ఎంచుకోండి —</option>
              {VACCINES.map(v => (
                <option key={v.name} value={v.name}>{v.name} ({v.age})</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={lbl}>తేదీ</label>
              <input type="date" value={adminDate}
                onChange={e => setAdminDate(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>స్థితి</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {(['administered','missed'] as const).map(s => (
                  <button key={s} type="button" onClick={() => setStatus(s)}
                    style={{ flex: 1, padding: '12px 6px', borderRadius: 10, border: `2px solid ${status === s ? (s === 'administered' ? '#15803D' : '#B91C1C') : '#E5E7EB'}`, background: status === s ? (s === 'administered' ? '#F0FDF4' : '#FEF2F2') : '#fff', color: s === 'administered' ? '#15803D' : '#B91C1C', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {s === 'administered' ? '✅ ఇచ్చారు' : '❌ మిస్సు'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button onClick={() => void save()} disabled={!!saving || !vaccine}
            style={{ width: '100%', height: 50, borderRadius: 12, border: 'none', background: saving || !vaccine ? '#9CA3AF' : '#4F46E5', color: '#fff', fontSize: 15, fontWeight: 800, cursor: saving || !vaccine ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'సేవ్ చేస్తోంది…' : '💾 సేవ్ చేయి'}
          </button>
        </div>
      )}

      {/* Records */}
      {records.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
              ✅ ఇచ్చినవి: {administered.length}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#B91C1C' }}>
              ❌ మిస్సు: {missed.length}
            </span>
          </div>
          {records.map((r, i) => (
            <div key={r.id} style={{ padding: '10px 16px', borderBottom: i < records.length-1 ? '1px solid #F9FAFB' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{r.vaccine_name}</div>
                {r.administered_date && (
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                    {new Date(r.administered_date).toLocaleDateString('en-IN')}
                  </div>
                )}
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 8, background: r.status === 'administered' ? '#F0FDF4' : '#FEF2F2', color: r.status === 'administered' ? '#15803D' : '#B91C1C' }}>
                {r.status === 'administered' ? '✅' : '❌'}
              </span>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
