'use client';
// Safety Compliance Log
// Tracks: fire drills, water quality tests, health camps, electrical safety, earthquake drills
// Institution-aware: mandatory for govt schools (DISE), residential schools, medical/engineering colleges
// Mobile-first: one-tap log, upcoming due dates prominently displayed

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface SafetyRecord {
  id: string; compliance_type: string; event_date: string; outcome: string;
  participants_count: number | null; next_due_date: string | null; notes: string | null;
}

const COMPLIANCE_TYPES = [
  { value: 'fire_drill',          label: '🔥 Fire Drill',               frequency: 'Bi-annual' },
  { value: 'water_quality_test',  label: '💧 Water Quality Test',        frequency: 'Monthly' },
  { value: 'health_camp',         label: '🏥 Health Camp',               frequency: 'Annual' },
  { value: 'electrical_safety',   label: '⚡ Electrical Safety Audit',   frequency: 'Annual' },
  { value: 'earthquake_drill',    label: '🌍 Earthquake / Disaster Drill',frequency: 'Annual' },
  { value: 'hygiene_inspection',  label: '🧼 Hygiene Inspection',        frequency: 'Monthly' },
  { value: 'first_aid_audit',     label: '🩹 First Aid Kit Audit',       frequency: 'Quarterly' },
  { value: 'cctv_check',          label: '📹 CCTV / Security Audit',     frequency: 'Annual' },
];

const OUTCOME_STYLE: Record<string, { bg: string; color: string }> = {
  pass:    { bg: '#F0FDF4', color: '#15803D' },
  partial: { bg: '#FFFBEB', color: '#D97706' },
  fail:    { bg: '#FEF2F2', color: '#B91C1C' },
};

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

export default function SafetyCompliancePage() {
  const [records, setRecords] = useState<SafetyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [tab, setTab]         = useState<'upcoming' | 'history'>('upcoming');
  const [form, setForm]       = useState({
    compliance_type: 'fire_drill', event_date: new Date().toISOString().split('T')[0],
    outcome: 'pass', participants_count: '', notes: '',
    next_due_date: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/safety-compliance');
      if (r.ok) { const d = await r.json() as { records?: SafetyRecord[] }; setRecords(d.records ?? []); }
    } catch {/**/}
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function addRecord() {
    setSaving(true);
    const r = await fetch('/api/admin/safety-compliance', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, participants_count: form.participants_count ? Number(form.participants_count) : null }),
    });
    setSaving(false);
    if (r.ok) { setShowAdd(false); void load(); }
    else { const d = await r.json() as { error?: string }; alert(d.error ?? 'Error'); }
  }

  // Upcoming = records with next_due_date in future, sorted soonest first
  const upcoming = records
    .filter(r => r.next_due_date && daysUntil(r.next_due_date) !== null)
    .sort((a, b) => new Date(a.next_due_date!).getTime() - new Date(b.next_due_date!).getTime());
  const overdue = upcoming.filter(r => (daysUntil(r.next_due_date) ?? 0) < 0);
  const history = records.sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());
  const inp = { height: 44, borderRadius: 9, border: '1px solid #D1D5DB', padding: '0 12px', fontSize: 14, fontFamily: 'inherit', background: '#F9FAFB', width: '100%', boxSizing: 'border-box' as const };

  return (
    <Layout title="Safety Compliance" subtitle="Drills, audits, and safety records">
      {overdue.length > 0 && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 13, fontWeight: 700, color: '#B91C1C' }}>
          ❌ {overdue.length} safety compliance item(s) overdue
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center' }}>
        {(['upcoming','history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: tab===t ? '#4F46E5' : '#F3F4F6', color: tab===t ? '#fff' : '#374151', fontFamily: 'inherit' }}>
            {t === 'upcoming' ? `📅 Due Dates (${upcoming.length})` : `📋 History (${records.length})`}
          </button>
        ))}
        <button onClick={() => setShowAdd(v => !v)} style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 20, border: 'none', background: '#4F46E5', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          {showAdd ? '✕' : '+ Log Event'}
        </button>
      </div>

      {showAdd && (
        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Type *</label>
              <select value={form.compliance_type} onChange={e => setForm(p => ({ ...p, compliance_type: e.target.value }))} style={inp}>
                {COMPLIANCE_TYPES.map(c => <option key={c.value} value={c.value}>{c.label} ({c.frequency})</option>)}
              </select>
            </div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Date</label>
              <input type="date" value={form.event_date} onChange={e => setForm(p => ({ ...p, event_date: e.target.value }))} style={inp} />
            </div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Outcome</label>
              <select value={form.outcome} onChange={e => setForm(p => ({ ...p, outcome: e.target.value }))} style={inp}>
                <option value="pass">✅ Pass</option>
                <option value="partial">⚠️ Partial</option>
                <option value="fail">❌ Fail</option>
              </select>
            </div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Participants</label>
              <input type="number" inputMode="numeric" value={form.participants_count} onChange={e => setForm(p => ({ ...p, participants_count: e.target.value }))} placeholder="Count" style={inp} />
            </div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Next Due Date</label>
              <input type="date" value={form.next_due_date} onChange={e => setForm(p => ({ ...p, next_due_date: e.target.value }))} style={inp} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Notes</label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Observations, issues found…" rows={2} style={{ ...inp, height: 'auto', padding: '10px 12px' }} />
            </div>
          </div>
          <button onClick={() => void addRecord()} disabled={saving} style={{ width: '100%', height: 44, borderRadius: 10, border: 'none', background: saving ? '#9CA3AF' : '#4F46E5', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Saving…' : '🔒 Log Safety Event'}
          </button>
        </div>
      )}

      {loading ? <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div> : (
        tab === 'upcoming' ? (
          upcoming.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', background: '#F0FDF4', borderRadius: 12 }}>
              ✅ No upcoming safety due dates logged yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {upcoming.map(rec => {
                const days = daysUntil(rec.next_due_date);
                const isOD = (days ?? 0) < 0;
                const isSoon = !isOD && (days ?? 999) <= 30;
                const ct = COMPLIANCE_TYPES.find(c => c.value === rec.compliance_type);
                return (
                  <div key={rec.id} style={{ background: isOD ? '#FEF2F2' : isSoon ? '#FFF7ED' : '#fff', border: `1px solid ${isOD ? '#FECACA' : isSoon ? '#FDE68A' : '#E5E7EB'}`, borderRadius: 12, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{ct?.label ?? rec.compliance_type}</div>
                        <div style={{ fontSize: 11, color: '#9CA3AF' }}>Last: {rec.event_date}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: isOD ? '#B91C1C' : isSoon ? '#D97706' : '#374151' }}>
                          {isOD ? `${Math.abs(days ?? 0)}d overdue` : days === 0 ? 'Due today' : `Due in ${days}d`}
                        </div>
                        <div style={{ fontSize: 10, color: '#9CA3AF' }}>{rec.next_due_date}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          history.length === 0 ? <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>No records yet.</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {history.slice(0, 20).map(rec => {
                const os = OUTCOME_STYLE[rec.outcome] ?? OUTCOME_STYLE.pass;
                const ct = COMPLIANCE_TYPES.find(c => c.value === rec.compliance_type);
                return (
                  <div key={rec.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{ct?.label ?? rec.compliance_type}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>{rec.event_date}{rec.participants_count ? ` · ${rec.participants_count} participants` : ''}</div>
                      {rec.notes && <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{rec.notes.slice(0, 60)}</div>}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 8, background: os.bg, color: os.color, flexShrink: 0 }}>
                      {rec.outcome}
                    </span>
                  </div>
                );
              })}
            </div>
          )
        )
      )}
    </Layout>
  );
}
