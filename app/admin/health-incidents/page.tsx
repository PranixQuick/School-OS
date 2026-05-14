'use client';
// app/admin/health-incidents/page.tsx
// Batch 4E — School-wide health incidents log with filters.

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface Incident { id: string; incident_date: string; incident_type: string; description: string; first_aid_given: string | null; referred_to_hospital: boolean; parent_notified: boolean; student_name: string; student_class?: string; student_section?: string; recorded_by_name: string; }

const INCIDENT_TYPES = ['all','injury','illness','allergy_reaction','fever','fainting','other'];
const INCIDENT_COLORS: Record<string, [string,string]> = {
  injury: ['#FEE2E2','#991B1B'], illness: ['#FEF9C3','#92400E'],
  allergy_reaction: ['#FDE8D8','#C2410C'], fever: ['#FEF3C7','#D97706'],
  fainting: ['#E0E7FF','#3730A3'], other: ['#F3F4F6','#374151'],
};

function toISO(d: Date) { return d.toISOString().slice(0,10); }

export default function HealthIncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState(toISO(new Date(Date.now() - 30*24*60*60*1000)));
  const [to, setTo] = useState(toISO(new Date()));
  const [classFilter, setClassFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ from, to });
    if (classFilter) params.set('class', classFilter);
    if (typeFilter !== 'all') params.set('incident_type', typeFilter);
    const res = await fetch('/api/admin/health-incidents?' + params.toString());
    const d = await res.json() as { incidents?: Incident[]; count?: number };
    setIncidents(d.incidents ?? []);
    setCount(d.count ?? 0);
    setLoading(false);
  }, [from, to, classFilter, typeFilter]);

  useEffect(() => { void load(); }, [load]);

  const cardStyle = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, marginBottom: 18 };

  return (
    <Layout title="Health Incidents" subtitle="School-wide incident log">
      {/* Filters */}
      <div style={{ ...cardStyle, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {[
          { label: 'FROM', type: 'date', value: from, onChange: setFrom },
          { label: 'TO', type: 'date', value: to, onChange: setTo },
        ].map(({ label, type, value, onChange }) => (
          <div key={label}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', marginBottom: 3 }}>{label}</div>
            <input type={type} value={value} onChange={e => onChange(e.target.value)}
              style={{ padding: '5px 8px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12 }} />
          </div>
        ))}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', marginBottom: 3 }}>CLASS</div>
          <input value={classFilter} onChange={e => setClassFilter(e.target.value)} placeholder="e.g. 9" style={{ padding: '5px 8px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, width: 70 }} />
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', marginBottom: 3 }}>TYPE</div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ padding: '5px 8px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12 }}>
            {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t === 'all' ? 'All types' : t.replace('_',' ')}</option>)}
          </select>
        </div>
        <button onClick={() => void load()} style={{ padding: '6px 14px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
          Apply
        </button>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: '#6B7280', fontWeight: 600 }}>{count} incidents</div>
      </div>

      <div style={cardStyle}>
        {loading ? (
          <div style={{ color: '#9CA3AF', fontSize: 13, padding: 20, textAlign: 'center' }}>Loading…</div>
        ) : incidents.length === 0 ? (
          <div style={{ color: '#9CA3AF', fontSize: 13, padding: 20, textAlign: 'center' }}>No incidents in this period.</div>
        ) : (
          <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  {['Date','Student','Class','Type','Description','Parent Notified'].map(h => (
                    <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, fontSize: 10, color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {incidents.map(i => {
                  const [bg, fg] = INCIDENT_COLORS[i.incident_type] ?? ['#F3F4F6','#374151'];
                  return (
                    <tr key={i.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '7px 10px', color: '#6B7280' }}>{i.incident_date}</td>
                      <td style={{ padding: '7px 10px', fontWeight: 600 }}>
                        <a href={`/admin/students/${i.id}/medical`} style={{ color: '#4F46E5', textDecoration: 'none' }}>{i.student_name}</a>
                      </td>
                      <td style={{ padding: '7px 10px', color: '#6B7280' }}>{i.student_class}{i.student_section ? `-${i.student_section}` : ''}</td>
                      <td style={{ padding: '7px 10px' }}>
                        <span style={{ background: bg, color: fg, fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>{i.incident_type.replace('_',' ')}</span>
                      </td>
                      <td style={{ padding: '7px 10px', maxWidth: 200 }}>
                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>{i.description}</div>
                        {i.referred_to_hospital && <span style={{ fontSize: 9, color: '#DC2626', fontWeight: 700 }}>🏥 Hospital</span>}
                      </td>
                      <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                        {i.parent_notified ? <span style={{ color: '#065F46', fontSize: 14 }}>✓</span> : <span style={{ color: '#D1D5DB', fontSize: 14 }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
