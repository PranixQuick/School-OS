'use client';
// Accreditation Management — NAAC, NBA, AICTE, NMC, PCI, BCI, INC, ICAR
// Institution-aware: shown for degree+ institutions only (feature-flag gated in future)
// Tracks current grade, validity, next visit, criteria compliance, action items
// Roles: admin, owner, hod, registrar

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface AccredRecord {
  id: string; body: string; accreditation_type: string; current_grade: string | null;
  valid_from: string | null; valid_until: string | null; last_visit_date: string | null;
  next_visit_date: string | null; status: string; coordinator_id: string | null;
}

const ACCRED_BODIES = [
  { value: 'NAAC',  label: '🏛️ NAAC',  desc: 'National Assessment and Accreditation Council',     type: 'institutional' },
  { value: 'NBA',   label: '🎓 NBA',   desc: 'National Board of Accreditation',                    type: 'department' },
  { value: 'AICTE', label: '⚙️ AICTE', desc: 'All India Council for Technical Education',           type: 'institutional' },
  { value: 'NMC',   label: '🏥 NMC',   desc: 'National Medical Commission',                        type: 'institutional' },
  { value: 'PCI',   label: '💊 PCI',   desc: 'Pharmacy Council of India',                          type: 'institutional' },
  { value: 'INC',   label: '🩺 INC',   desc: 'Indian Nursing Council',                             type: 'institutional' },
  { value: 'BCI',   label: '⚖️ BCI',   desc: 'Bar Council of India',                               type: 'institutional' },
  { value: 'ICAR',  label: '🌾 ICAR',  desc: 'Indian Council of Agricultural Research',            type: 'institutional' },
  { value: 'UGC',   label: '📚 UGC',   desc: 'University Grants Commission',                       type: 'institutional' },
  { value: 'NCTE',  label: '🖊️ NCTE',  desc: 'National Council for Teacher Education',             type: 'institutional' },
];

const GRADE_STYLE: Record<string, { bg: string; color: string }> = {
  'A++': { bg: '#DCFCE7', color: '#15803D' }, 'A+': { bg: '#D1FAE5', color: '#065F46' },
  'A':   { bg: '#D1FAE5', color: '#065F46' }, 'B++': { bg: '#FEF9C3', color: '#854D0E' },
  'B+':  { bg: '#FEF9C3', color: '#A16207' }, 'B':   { bg: '#FFFBEB', color: '#D97706' },
  'C':   { bg: '#FEF2F2', color: '#B91C1C' },
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  active:          { bg: '#F0FDF4', color: '#15803D' },
  expired:         { bg: '#FEF2F2', color: '#B91C1C' },
  pending_renewal: { bg: '#FFF7ED', color: '#D97706' },
  under_review:    { bg: '#EFF6FF', color: '#2563EB' },
};

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

export default function AccreditationPage() {
  const [records, setRecords] = useState<AccredRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [form, setForm]       = useState({
    body: 'NAAC', current_grade: 'A', valid_from: '', valid_until: '',
    last_visit_date: '', next_visit_date: '', status: 'active',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/accreditation');
      if (r.ok) { const d = await r.json() as { records?: AccredRecord[] }; setRecords(d.records ?? []); }
    } catch {/**/}
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function addRecord() {
    if (!form.body) { alert('Accreditation body required'); return; }
    setSaving(true);
    const r = await fetch('/api/admin/accreditation', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (r.ok) { setShowAdd(false); void load(); }
    else { const d = await r.json() as { error?: string }; alert(d.error ?? 'Error'); }
  }

  const expiringSoon = records.filter(r => {
    const days = daysUntil(r.valid_until);
    return days !== null && days > 0 && days <= 180;
  });
  const expired = records.filter(r => r.status === 'expired' || (r.valid_until && new Date(r.valid_until) < new Date()));
  const inp = { height: 44, borderRadius: 9, border: '1px solid #D1D5DB', padding: '0 12px', fontSize: 14, fontFamily: 'inherit', background: '#F9FAFB', width: '100%', boxSizing: 'border-box' as const };

  return (
    <Layout title="Accreditation" subtitle="NAAC / NBA / AICTE / NMC and statutory compliance">
      {expired.length > 0 && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 13, fontWeight: 700, color: '#B91C1C' }}>
          ❌ {expired.length} accreditation(s) expired — immediate renewal required
        </div>
      )}
      {expiringSoon.length > 0 && (
        <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 13, fontWeight: 700, color: '#D97706' }}>
          ⚠️ {expiringSoon.length} accreditation(s) expiring within 180 days
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={() => setShowAdd(v => !v)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#4F46E5', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          {showAdd ? '✕ Cancel' : '+ Add Accreditation'}
        </button>
      </div>

      {showAdd && (
        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Body *</label>
              <select value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} style={inp}>
                {ACCRED_BODIES.map(b => <option key={b.value} value={b.value}>{b.label} — {b.desc}</option>)}
              </select>
            </div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Current Grade</label>
              <select value={form.current_grade} onChange={e => setForm(p => ({ ...p, current_grade: e.target.value }))} style={inp}>
                {['A++','A+','A','B++','B+','B','C','N/A'].map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Valid From</label>
              <input type="date" value={form.valid_from} onChange={e => setForm(p => ({ ...p, valid_from: e.target.value }))} style={inp} />
            </div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Valid Until</label>
              <input type="date" value={form.valid_until} onChange={e => setForm(p => ({ ...p, valid_until: e.target.value }))} style={inp} />
            </div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Last Visit</label>
              <input type="date" value={form.last_visit_date} onChange={e => setForm(p => ({ ...p, last_visit_date: e.target.value }))} style={inp} />
            </div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Next Visit</label>
              <input type="date" value={form.next_visit_date} onChange={e => setForm(p => ({ ...p, next_visit_date: e.target.value }))} style={inp} />
            </div>
          </div>
          <button onClick={() => void addRecord()} disabled={saving} style={{ width: '100%', height: 44, borderRadius: 10, border: 'none', background: saving ? '#9CA3AF' : '#4F46E5', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Saving…' : '🏛️ Add Accreditation Record'}
          </button>
        </div>
      )}

      {loading ? <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div> : records.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', background: '#F9FAFB', borderRadius: 12 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🏛️</div>
          <div style={{ fontWeight: 700, color: '#374151', marginBottom: 4 }}>No accreditation records yet</div>
          <div style={{ fontSize: 12 }}>Add your NAAC, NBA, AICTE, NMC or other accreditation status here.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {records.map(rec => {
            const days    = daysUntil(rec.valid_until);
            const gs      = GRADE_STYLE[rec.current_grade ?? ''] ?? { bg: '#F9FAFB', color: '#374151' };
            const ss      = STATUS_STYLE[rec.status] ?? STATUS_STYLE.active;
            const bd      = ACCRED_BODIES.find(b => b.value === rec.body);
            const isExpiring = days !== null && days > 0 && days <= 180;
            const isExpired  = days !== null && days <= 0;
            return (
              <div key={rec.id} style={{ background: '#fff', border: `1px solid ${isExpired ? '#FECACA' : isExpiring ? '#FDE68A' : '#E5E7EB'}`, borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>{bd?.label ?? rec.body}</div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{bd?.desc ?? ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {rec.current_grade && (
                      <span style={{ fontSize: 16, fontWeight: 900, padding: '3px 12px', borderRadius: 10, background: gs.bg, color: gs.color, display: 'inline-block', marginBottom: 4 }}>
                        {rec.current_grade}
                      </span>
                    )}
                    <div><span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: ss.bg, color: ss.color }}>{rec.status.replace('_',' ')}</span></div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>VALID UNTIL</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: isExpired ? '#B91C1C' : '#111827', marginTop: 2 }}>{rec.valid_until ?? '—'}</div>
                    {days !== null && <div style={{ fontSize: 10, color: isExpired ? '#B91C1C' : isExpiring ? '#D97706' : '#9CA3AF' }}>{isExpired ? `${Math.abs(days)}d expired` : `${days}d remaining`}</div>}
                  </div>
                  <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>LAST VISIT</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginTop: 2 }}>{rec.last_visit_date ?? '—'}</div>
                  </div>
                  <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>NEXT VISIT</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginTop: 2 }}>{rec.next_visit_date ?? '—'}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
