'use client';
// Teacher Vacancy Registry — Track open teaching positions per school
// Primary: govt schools (MEO compliance requirement)
// Also applicable: private schools for HR visibility

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface Vacancy { id: string; subject: string; class_level: string; position_type: string; vacant_since: string; status: string; reported_to_meo: boolean; }

const SUBJECTS = ['Telugu','English','Hindi','Mathematics','Science','Social Studies','Computer Science','Physical Education','Sanskrit','Other'];
const CLASS_LEVELS = ['Pre-Primary','Primary (1-5)','Upper Primary (6-8)','High School (9-10)','Jr. College (11-12)','All'];

export default function VacanciesPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showAdd, setShowAdd]     = useState(false);
  const [form, setForm]           = useState({ subject: 'Mathematics', class_level: 'High School (9-10)', position_type: 'regular', vacant_since: new Date().toISOString().split('T')[0] });
  const [saving, setSaving]       = useState(false);
  const [filter, setFilter]       = useState<'open'|'all'>('open');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/vacancies?status=${filter === 'open' ? 'open' : 'all'}`);
      if (r.ok) { const d = await r.json() as { vacancies?: Vacancy[] }; setVacancies(d.vacancies ?? []); }
    } catch {/**/}
    setLoading(false);
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  async function addVacancy() {
    if (!form.subject) { alert('Subject required'); return; }
    setSaving(true);
    const r = await fetch('/api/admin/vacancies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setSaving(false);
    if (r.ok) { setShowAdd(false); void load(); }
  }

  async function reportToMEO(id: string) {
    await fetch('/api/admin/vacancies', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, reported_to_meo: true }) });
    void load();
  }

  const openCount = vacancies.filter(v => v.status === 'open').length;
  const unreported = vacancies.filter(v => v.status === 'open' && !v.reported_to_meo).length;
  const inp = { height: 44, borderRadius: 9, border: '1px solid #D1D5DB', padding: '0 12px', fontSize: 14, fontFamily: 'inherit', background: '#F9FAFB', width: '100%', boxSizing: 'border-box' as const };

  return (
    <Layout title="Teacher Vacancies" subtitle="Track and report open positions">
      {unreported > 0 && (
        <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 13, fontWeight: 600, color: '#C2410C' }}>
          ⚠️ {unreported} vacancy(ies) not yet reported to MEO
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
        {[
          { v: openCount, l: 'Open', color: openCount > 0 ? '#B91C1C' : '#15803D', bg: openCount > 0 ? '#FEF2F2' : '#F0FDF4' },
          { v: unreported, l: 'Unreported', color: unreported > 0 ? '#D97706' : '#15803D', bg: unreported > 0 ? '#FFF7ED' : '#F0FDF4' },
          { v: vacancies.filter(v => v.status === 'filled').length, l: 'Filled', color: '#15803D', bg: '#F0FDF4' },
        ].map(s => (
          <div key={s.l} style={{ background: s.bg, borderRadius: 11, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.v}</div>
            <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>{s.l}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {(['open','all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: filter===f ? '#4F46E5' : '#F3F4F6', color: filter===f ? '#fff' : '#374151', fontFamily: 'inherit' }}>
            {f === 'open' ? `Open (${openCount})` : 'All'}
          </button>
        ))}
        <button onClick={() => setShowAdd(v => !v)} style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 20, border: 'none', background: '#4F46E5', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          {showAdd ? '✕' : '+ Report Vacancy'}
        </button>
      </div>

      {showAdd && (
        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Subject *</label>
              <select value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} style={inp}>
                {SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Class Level</label>
              <select value={form.class_level} onChange={e => setForm(p => ({ ...p, class_level: e.target.value }))} style={inp}>
                {CLASS_LEVELS.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Position Type</label>
              <select value={form.position_type} onChange={e => setForm(p => ({ ...p, position_type: e.target.value }))} style={inp}>
                {['regular','contract','guest'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Vacant Since</label>
              <input type="date" value={form.vacant_since} onChange={e => setForm(p => ({ ...p, vacant_since: e.target.value }))} style={inp} />
            </div>
          </div>
          <button onClick={() => void addVacancy()} disabled={saving} style={{ width: '100%', height: 44, borderRadius: 10, border: 'none', background: saving ? '#9CA3AF' : '#4F46E5', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Saving…' : '📋 Add Vacancy'}
          </button>
        </div>
      )}

      {loading ? <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div> : vacancies.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>No vacancies recorded.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {vacancies.map(v => (
            <div key={v.id} style={{ background: '#fff', border: `1px solid ${v.status === 'open' ? '#FECACA' : '#E5E7EB'}`, borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{v.subject}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>{v.class_level} · {v.position_type} · Since {v.vacant_since}</div>
                  {v.reported_to_meo && <div style={{ fontSize: 11, color: '#15803D', marginTop: 2 }}>✅ Reported to MEO</div>}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: v.status === 'open' ? '#FEF2F2' : '#F0FDF4', color: v.status === 'open' ? '#B91C1C' : '#15803D' }}>
                    {v.status}
                  </span>
                  {v.status === 'open' && !v.reported_to_meo && (
                    <button onClick={() => void reportToMEO(v.id)} style={{ display: 'block', marginTop: 6, padding: '4px 10px', borderRadius: 7, border: 'none', background: '#FFF7ED', color: '#D97706', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Report to MEO
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
