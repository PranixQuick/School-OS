'use client';
// app/placement/page.tsx
// Portal for placement_officer role
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Drive { id: string; title: string; drive_date: string | null; status: string; package_lpa: number | null; package_max_lpa: number | null; min_cgpa: number | null; backlogs_allowed: boolean; company: { name: string; sector: string | null } | null; }
interface Outcome { id: string; outcome: string; package_lpa: number | null; offer_date: string | null; student: { name: string } | null; drive: { title: string; company: { name: string } | null } | null; }

export default function PlacementOfficerPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'drives' | 'outcomes'>('drives');
  const [drives, setDrives] = useState<Drive[]>([]);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [outcomeForm, setOutcomeForm] = useState({ drive_id: '', student_id: '', outcome: 'applied', package_lpa: '', offer_date: '' });
  const [outcomeError, setOutcomeError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/admin/placement?view=${tab}`);
    const d = await r.json();
    if (tab === 'drives') setDrives(d.drives ?? []);
    else setOutcomes(d.outcomes ?? []);
    setLoading(false);
  }, [tab]);

  useEffect(() => { load(); }, [tab]);

  async function recordOutcome() {
    if (!outcomeForm.drive_id || !outcomeForm.student_id) { setOutcomeError('Drive ID and Student ID required'); return; }
    setSubmitting(true); setOutcomeError('');
    const r = await fetch('/api/admin/placement', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'record_outcome', ...outcomeForm, package_lpa: outcomeForm.package_lpa ? Number(outcomeForm.package_lpa) : null }) });
    const d = await r.json(); setSubmitting(false);
    if (!r.ok) { setOutcomeError(d.error ?? 'Failed'); return; }
    setToast('Outcome recorded'); setTimeout(() => setToast(''), 3000);
    setOutcomeForm({ drive_id: '', student_id: '', outcome: 'applied', package_lpa: '', offer_date: '' }); load();
  }

  const placed = outcomes.filter(o => o.outcome === 'placed' || o.outcome === 'offer_accepted').length;
  const statusColor: Record<string, string> = { upcoming: '#DBEAFE', ongoing: '#FEF9C3', completed: '#D1FAE5', cancelled: '#FEE2E2' };
  const outcomeColor: Record<string, [string, string]> = { applied: ['#F3F4F6', '#374151'], shortlisted: ['#DBEAFE', '#1E40AF'], selected: ['#D1FAE5', '#065F46'], rejected: ['#FEE2E2', '#991B1B'], placed: ['#DCFCE7', '#14532D'], offer_accepted: ['#BBF7D0', '#14532D'] };

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: '#111827', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>{toast}</div>}
      <div style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><div style={{ fontSize: 18, fontWeight: 800 }}>🎯 Placement</div><div style={{ fontSize: 12, color: '#6B7280' }}>Placement Officer Portal</div></div>
        <button onClick={() => { fetch('/api/auth/logout', { method: 'POST' }); router.push('/login'); }} style={{ padding: '6px 12px', border: '1px solid #E5E7EB', borderRadius: 7, background: '#fff', fontSize: 12, cursor: 'pointer' }}>Sign out</button>
      </div>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
          {[['Active Drives', drives.filter(d => d.status !== 'cancelled').length, '#4F46E5'], ['Outcomes Logged', outcomes.length, '#0891B2'], ['Students Placed', placed, '#065F46']].map(([label, val, color]) => (
            <div key={label as string} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: color as string }}>{val as number}</div>
              <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>{label as string}</div>
            </div>
          ))}
        </div>

        {tab === 'outcomes' && (
          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#065F46', marginBottom: 10 }}>Record Outcome</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
              {[['Drive ID *', 'drive_id', 'text'], ['Student ID *', 'student_id', 'text'], ['Package (LPA)', 'package_lpa', 'number'], ['Offer Date', 'offer_date', 'date']].map(([label, key, type]) => (
                <div key={key}><label style={{ fontSize: 11, fontWeight: 600, color: '#065F46', display: 'block', marginBottom: 3 }}>{label}</label>
                  <input type={type} value={(outcomeForm as Record<string,string>)[key]} onChange={e => setOutcomeForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{ width: '100%', height: 36, border: '1px solid #BBF7D0', borderRadius: 7, padding: '0 10px', fontSize: 13, boxSizing: 'border-box' }} /></div>
              ))}
              <div><label style={{ fontSize: 11, fontWeight: 600, color: '#065F46', display: 'block', marginBottom: 3 }}>Outcome</label>
                <select value={outcomeForm.outcome} onChange={e => setOutcomeForm(f => ({ ...f, outcome: e.target.value }))} style={{ width: '100%', height: 36, border: '1px solid #BBF7D0', borderRadius: 7, padding: '0 8px', fontSize: 13 }}>
                  {['applied', 'shortlisted', 'selected', 'rejected', 'offer_accepted', 'placed'].map(o => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
                </select></div>
            </div>
            {outcomeError && <div style={{ color: '#991B1B', fontSize: 12, marginTop: 6 }}>{outcomeError}</div>}
            <button onClick={recordOutcome} disabled={submitting} style={{ marginTop: 10, padding: '8px 18px', background: '#065F46', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {submitting ? 'Recording...' : 'Record Outcome'}
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 4, marginBottom: 14, background: '#F3F4F6', borderRadius: 8, padding: 4 }}>
          {[['drives', '📅 Drives'], ['outcomes', '🎯 Outcomes']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key as 'drives' | 'outcomes')}
              style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: tab === key ? '#fff' : 'transparent', color: tab === key ? '#111827' : '#6B7280', boxShadow: tab === key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
              {label}
            </button>
          ))}
        </div>
        {loading ? <div style={{ textAlign: 'center', padding: 32, color: '#6B7280' }}>Loading...</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tab === 'drives' && drives.map(drive => (
              <div key={drive.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{drive.title}</div>
                  <span style={{ padding: '3px 9px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: statusColor[drive.status] ?? '#F3F4F6', color: '#374151' }}>{drive.status}</span>
                </div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>{drive.company?.name}{drive.company?.sector ? ` · ${drive.company.sector}` : ''}</div>
                {drive.drive_date && <div style={{ fontSize: 11, color: '#9CA3AF' }}>{drive.drive_date}</div>}
                {drive.package_lpa && <div style={{ fontSize: 12, color: '#065F46', fontWeight: 600 }}>₹{drive.package_lpa}{drive.package_max_lpa ? `–${drive.package_max_lpa}` : ''} LPA{drive.min_cgpa ? ` · Min CGPA ${drive.min_cgpa}` : ''}</div>}
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>ID: {drive.id}</div>
              </div>
            ))}
            {tab === 'outcomes' && outcomes.map(o => {
              const [bg, fg] = outcomeColor[o.outcome] ?? ['#F3F4F6', '#374151'];
              return (
                <div key={o.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{o.student?.name ?? '—'}</div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>{o.drive?.title}{o.drive?.company?.name ? ` · ${o.drive.company.name}` : ''}</div>
                    {o.package_lpa && <div style={{ fontSize: 12, color: '#065F46', fontWeight: 600 }}>₹{o.package_lpa} LPA</div>}
                  </div>
                  <span style={{ padding: '3px 9px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: bg, color: fg }}>{o.outcome.replace(/_/g, ' ')}</span>
                </div>
              );
            })}
            {(tab === 'drives' ? drives : outcomes).length === 0 && <div style={{ textAlign: 'center', padding: 32, color: '#9CA3AF' }}>No {tab} data yet.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
