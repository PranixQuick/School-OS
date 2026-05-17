'use client';
import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface Drive { id: string; title: string; drive_date: string | null; status: string; package_lpa: number | null; package_max_lpa: number | null; notes: string | null; company: { name: string; sector: string | null } | null; }
interface Company { id: string; name: string; sector: string | null; contact_name: string | null; contact_phone: string | null; contact_email: string | null; }

export default function PlacementOfficerPage() {
  const [tab, setTab] = useState<'drives' | 'companies' | 'record'>('drives');
  const [drives, setDrives] = useState<Drive[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  const [outcomeForm, setOutcomeForm] = useState({ drive_id: '', student_id: '', outcome: 'applied', package_lpa: '', offer_date: '' });
  const [outcomeError, setOutcomeError] = useState('');
  const [outcomeSubmitting, setOutcomeSubmitting] = useState(false);

  function msg(m: string) { setToast(m); setTimeout(() => setToast(''), 3000); }

  const load = useCallback(async () => {
    setLoading(true);
    const [dr, cr] = await Promise.all([fetch('/api/admin/placement?view=drives'), fetch('/api/admin/placement?view=companies')]);
    const [dd, cd] = await Promise.all([dr.json(), cr.json()]);
    setDrives(dd.drives ?? []);
    setCompanies(cd.companies ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function submitOutcome() {
    if (!outcomeForm.drive_id || !outcomeForm.student_id) { setOutcomeError('Drive ID and Student ID required'); return; }
    setOutcomeSubmitting(true); setOutcomeError('');
    const r = await fetch('/api/admin/placement', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'record_outcome', ...outcomeForm, package_lpa: outcomeForm.package_lpa ? Number(outcomeForm.package_lpa) : null }) });
    const d = await r.json(); setOutcomeSubmitting(false);
    if (!r.ok) { setOutcomeError(d.error ?? 'Failed'); return; }
    msg('Outcome recorded');
    setOutcomeForm({ drive_id: '', student_id: '', outcome: 'applied', package_lpa: '', offer_date: '' });
  }

  const STATUS_COLOR: Record<string, [string,string]> = { upcoming: ['#DBEAFE','#1E40AF'], ongoing: ['#FEF9C3','#92400E'], completed: ['#D1FAE5','#065F46'], cancelled: ['#FEE2E2','#991B1B'] };
  const inp = (w?: string): React.CSSProperties => ({ width: w ?? '100%', height: 38, border: '1px solid #D1D5DB', borderRadius: 8, padding: '0 12px', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' });

  return (
    <Layout title="Placement" subtitle="Manage drives, companies and student outcomes">
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: '#15803D', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>{toast}</div>}

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#F3F4F6', borderRadius: 10, padding: 4 }}>
        {[['drives','📅 Drives'],['companies','🏢 Companies'],['record','✍️ Record Outcome']].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k as 'drives'|'companies'|'record')}
            style={{ flex: 1, padding: '8px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: tab === k ? '#fff' : 'transparent', color: tab === k ? '#111827' : '#6B7280', boxShadow: tab === k ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>{l}</button>
        ))}
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>Loading...</div> : (
        <>
          {tab === 'drives' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {drives.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>No drives scheduled yet.</div>}
              {drives.map(d => {
                const [bg, fg] = STATUS_COLOR[d.status] ?? ['#F3F4F6','#6B7280'];
                return (
                  <div key={d.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{d.title}</div>
                      <span style={{ padding: '3px 9px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: bg, color: fg }}>{d.status}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>{d.company?.name ?? 'Unknown'}{d.company?.sector ? ` · ${d.company.sector}` : ''}</div>
                    {d.drive_date && <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>📅 {d.drive_date}</div>}
                    {d.package_lpa && <div style={{ fontSize: 13, color: '#065F46', fontWeight: 600 }}>₹{d.package_lpa}{d.package_max_lpa ? `–${d.package_max_lpa}` : ''} LPA</div>}
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4, fontFamily: 'monospace' }}>ID: {d.id}</div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'companies' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {companies.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>No companies yet.</div>}
              {companies.map(c => (
                <div key={c.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{c.name}</div>
                  {c.sector && <div style={{ fontSize: 12, color: '#6B7280' }}>{c.sector}</div>}
                  {c.contact_name && <div style={{ fontSize: 12, color: '#374151' }}>👤 {c.contact_name}</div>}
                  {c.contact_phone && <div style={{ fontSize: 12, color: '#374151' }}>📞 {c.contact_phone}</div>}
                  {c.contact_email && <div style={{ fontSize: 12, color: '#374151' }}>✉️ {c.contact_email}</div>}
                </div>
              ))}
            </div>
          )}

          {tab === 'record' && (
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#065F46', marginBottom: 16 }}>✍️ Record Student Outcome</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
                {[['Drive ID *','drive_id','text'],['Student ID *','student_id','text'],['Package (LPA)','package_lpa','number'],['Offer Date','offer_date','date']].map(([l,k,t]) => (
                  <div key={k}><label style={{ fontSize: 11, fontWeight: 600, color: '#065F46', display: 'block', marginBottom: 4 }}>{l}</label>
                    <input type={t} value={(outcomeForm as Record<string,string>)[k]} onChange={e => setOutcomeForm(f => ({ ...f, [k]: e.target.value }))} style={inp()} /></div>
                ))}
                <div><label style={{ fontSize: 11, fontWeight: 600, color: '#065F46', display: 'block', marginBottom: 4 }}>Outcome</label>
                  <select value={outcomeForm.outcome} onChange={e => setOutcomeForm(f => ({ ...f, outcome: e.target.value }))} style={{ ...inp(), height: 38 }}>
                    {['applied','shortlisted','selected','rejected','offer_accepted','placed'].map(o => <option key={o} value={o}>{o.replace(/_/g,' ')}</option>)}
                  </select></div>
              </div>
              {outcomeError && <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '8px 12px', borderRadius: 7, fontSize: 13, marginTop: 10 }}>{outcomeError}</div>}
              <button onClick={submitOutcome} disabled={outcomeSubmitting} style={{ marginTop: 14, padding: '10px 24px', background: '#065F46', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {outcomeSubmitting ? 'Saving...' : 'Record Outcome'}
              </button>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
