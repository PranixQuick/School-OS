'use client';
// MEO Inspection System — "Inspection → Deficiency → Action Item → Resolution → Verification"
// Full chain: MEO visits school → files report → creates action items → tracks closure
// Government schools ONLY. Read-auditable. Mobile-first for field use.

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface ActionItem { id: string; category: string; description: string; severity: string; due_date: string; status: string; school_name?: string; }
interface Inspection  { id: string; school_id: string; visit_date: string; overall_rating: string; compliance_score: number; follow_up_required: boolean; report_status: string; school_name?: string; action_items?: number; }

type Tab = 'active_items' | 'inspections' | 'new_inspection';

const SEVERITY_STYLE: Record<string, { bg: string; color: string }> = {
  critical: { bg: '#FEE2E2', color: '#B91C1C' },
  high:     { bg: '#FEF3C7', color: '#D97706' },
  medium:   { bg: '#EFF6FF', color: '#2563EB' },
  low:      { bg: '#F0FDF4', color: '#15803D' },
};
const RATING_COLOR: Record<string, string> = { excellent: '#15803D', satisfactory: '#0284C7', needs_improvement: '#D97706', critical: '#B91C1C' };

export default function MEOInspectionsPage() {
  const [tab, setTab]         = useState<Tab>('active_items');
  const [items, setItems]     = useState<ActionItem[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm]       = useState({ school_id: '', visit_date: new Date().toISOString().split('T')[0], overall_rating: 'satisfactory', compliance_score: '80', observations: '', follow_up_required: false });
  const [saving, setSaving]   = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closeNote, setCloseNote] = useState('');

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/meo/action-items?status=open');
      if (r.ok) { const d = await r.json() as { items?: ActionItem[] }; setItems(d.items ?? []); }
    } catch {/**/}
    setLoading(false);
  }, []);

  const loadInspections = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/meo/inspections');
      if (r.ok) { const d = await r.json() as { inspections?: Inspection[] }; setInspections(d.inspections ?? []); }
    } catch {/**/}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab === 'active_items') loadItems();
    else if (tab === 'inspections') loadInspections();
    else {
      fetch('/api/meo/dashboard').then(r => r.ok ? r.json() : null).then((d: { schools?: { school_id: string; school_name: string }[] } | null) => {
        if (d?.schools) setSchools(d.schools.map(s => ({ id: s.school_id, name: s.school_name })));
      });
      setLoading(false);
    }
  }, [tab, loadItems, loadInspections]);

  async function submitInspection() {
    if (!form.school_id || !form.visit_date) { alert('School and visit date required'); return; }
    setSaving(true);
    const r = await fetch('/api/meo/inspections', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, compliance_score: Number(form.compliance_score) }),
    });
    setSaving(false);
    if (r.ok) { setTab('inspections'); void loadInspections(); }
    else { const d = await r.json() as { error?: string }; alert(d.error ?? 'Error'); }
  }

  async function closeItem(id: string) {
    const r = await fetch('/api/meo/action-items', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'resolved', closure_notes: closeNote }) });
    if (r.ok) { setClosingId(null); setCloseNote(''); void loadItems(); }
  }

  const critical = items.filter(i => i.severity === 'critical').length;
  const inp = { height: 44, borderRadius: 9, border: '1px solid #D1D5DB', padding: '0 12px', fontSize: 14, fontFamily: 'inherit', background: '#F9FAFB', width: '100%', boxSizing: 'border-box' as const };

  return (
    <Layout title="School Inspections" subtitle="Mandal inspection and action tracking">
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
        {[
          { v: items.length, l: 'Open Items', color: items.length > 0 ? '#B91C1C' : '#15803D', bg: items.length > 0 ? '#FEF2F2' : '#F0FDF4' },
          { v: critical, l: 'Critical', color: critical > 0 ? '#B91C1C' : '#15803D', bg: critical > 0 ? '#FEF2F2' : '#F0FDF4' },
          { v: inspections.length, l: 'Inspections', color: '#4F46E5', bg: '#EEF2FF' },
        ].map(s => (
          <div key={s.l} style={{ background: s.bg, borderRadius: 11, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.v}</div>
            <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {([['active_items','⚡ Open Items'],['inspections','🔍 Reports'],['new_inspection','+ New Inspection']] as [Tab, string][]).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '6px 12px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: tab===t ? '#1E40AF' : '#F3F4F6', color: tab===t ? '#fff' : '#374151', fontFamily: 'inherit' }}>
            {l}{t === 'active_items' && items.length > 0 ? ` (${items.length})` : ''}
          </button>
        ))}
      </div>

      {tab === 'active_items' && (
        loading ? <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div> :
        items.length === 0 ? <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', background: '#F0FDF4', borderRadius: 12 }}>✅ No open action items</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map(item => {
              const ss = SEVERITY_STYLE[item.severity] ?? SEVERITY_STYLE.medium;
              return (
                <div key={item.id} style={{ background: '#fff', border: `1px solid ${ss.color}30`, borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{item.school_name ?? 'School'}</div>
                      <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>{item.description}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>Due: {item.due_date} · Category: {item.category}</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: ss.bg, color: ss.color, flexShrink: 0 }}>
                      {item.severity.toUpperCase()}
                    </span>
                  </div>
                  {closingId === item.id ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input value={closeNote} onChange={e => setCloseNote(e.target.value)} placeholder="Closure notes (optional)" style={{ ...inp, flex: 1 }} />
                      <button onClick={() => void closeItem(item.id)} style={{ padding: '0 14px', height: 44, borderRadius: 9, border: 'none', background: '#15803D', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>
                      <button onClick={() => setClosingId(null)} style={{ padding: '0 12px', height: 44, borderRadius: 9, border: '1px solid #E5E7EB', background: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                    </div>
                  ) : (
                    <button onClick={() => setClosingId(item.id)} style={{ width: '100%', height: 36, borderRadius: 8, border: '1px solid #E5E7EB', background: '#F9FAFB', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      ✅ Mark Resolved
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {tab === 'inspections' && (
        loading ? <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div> :
        inspections.length === 0 ? <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>No inspections filed yet.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {inspections.map(ins => (
              <div key={ins.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{ins.school_name ?? 'School'}</div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>Visit: {ins.visit_date} · Score: {ins.compliance_score}%</div>
                    {ins.follow_up_required && <div style={{ fontSize: 11, color: '#D97706', marginTop: 2 }}>⚠ Follow-up required</div>}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: RATING_COLOR[ins.overall_rating] ?? '#374151', background: '#F9FAFB', padding: '3px 10px', borderRadius: 8 }}>
                    {ins.overall_rating.replace('_',' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'new_inspection' && (
        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>School *</label>
              <select value={form.school_id} onChange={e => setForm(p => ({ ...p, school_id: e.target.value }))} style={inp}>
                <option value="">Select school</option>
                {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Visit Date</label>
              <input type="date" value={form.visit_date} onChange={e => setForm(p => ({ ...p, visit_date: e.target.value }))} style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Compliance Score</label>
              <input type="number" inputMode="numeric" min="0" max="100" value={form.compliance_score} onChange={e => setForm(p => ({ ...p, compliance_score: e.target.value }))} style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Rating</label>
              <select value={form.overall_rating} onChange={e => setForm(p => ({ ...p, overall_rating: e.target.value }))} style={inp}>
                {['excellent','satisfactory','needs_improvement','critical'].map(r => <option key={r} value={r}>{r.replace('_',' ')}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Observations</label>
              <textarea value={form.observations} onChange={e => setForm(p => ({ ...p, observations: e.target.value }))} placeholder="Key observations during the visit…" rows={4} style={{ ...inp, height: 'auto', padding: '10px 12px' }} />
            </div>
            <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" checked={form.follow_up_required} onChange={e => setForm(p => ({ ...p, follow_up_required: e.target.checked }))} style={{ width: 18, height: 18 }} />
              <label style={{ fontSize: 14, color: '#374151', fontWeight: 600 }}>Follow-up visit required</label>
            </div>
          </div>
          <button onClick={() => void submitInspection()} disabled={saving} style={{ width: '100%', height: 48, borderRadius: 12, border: 'none', background: saving ? '#9CA3AF' : '#1E40AF', color: '#fff', fontSize: 15, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Submitting…' : '📋 Submit Inspection Report'}
          </button>
        </div>
      )}
    </Layout>
  );
}
