'use client';
import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface Company { id: string; name: string; sector: string | null; contact_name: string | null; contact_phone: string | null; is_active: boolean; }
interface Drive { id: string; title: string; drive_date: string | null; status: string; package_lpa: number | null; package_max_lpa: number | null; min_cgpa: number | null; backlogs_allowed: boolean; eligible_departments: string[]; notes: string | null; company: { name: string; sector: string | null } | null; }
interface Outcome { id: string; outcome: string; package_lpa: number | null; offer_date: string | null; student: { name: string; class: string | null } | null; drive: { title: string; company: { name: string } | null } | null; }

export default function PlacementPage() {
  const [tab, setTab] = useState<'drives' | 'companies' | 'outcomes'>('drives');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [drives, setDrives] = useState<Drive[]>([]);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  const [showAddCompany, setShowAddCompany] = useState(false);
  const [companyForm, setCompanyForm] = useState({ name: '', sector: '', contact_name: '', contact_phone: '', contact_email: '', website: '' });
  const [companyError, setCompanyError] = useState('');

  const [showAddDrive, setShowAddDrive] = useState(false);
  const [driveForm, setDriveForm] = useState({ company_id: '', title: '', drive_date: '', package_lpa: '', package_max_lpa: '', min_cgpa: '', notes: '' });
  const [driveError, setDriveError] = useState('');

  const [showOutcomeForm, setShowOutcomeForm] = useState(false);
  const [outcomeForm, setOutcomeForm] = useState({ drive_id: '', student_id: '', outcome: 'applied', package_lpa: '', offer_date: '' });
  const [outcomeError, setOutcomeError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/placement?view=${tab}`);
      const d = await r.json();
      if (tab === 'companies') setCompanies(d.companies ?? []);
      else if (tab === 'drives') setDrives(d.drives ?? []);
      else setOutcomes(d.outcomes ?? []);
    } finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  async function addCompany() {
    if (!companyForm.name) { setCompanyError('Company name required'); return; }
    const r = await fetch('/api/admin/placement', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_company', ...companyForm }) });
    const d = await r.json();
    if (!r.ok) { setCompanyError(d.error ?? 'Failed'); return; }
    setToast('Company added'); setTimeout(() => setToast(''), 3000);
    setShowAddCompany(false); setCompanyForm({ name: '', sector: '', contact_name: '', contact_phone: '', contact_email: '', website: '' });
    load();
  }

  async function addDrive() {
    if (!driveForm.company_id || !driveForm.title) { setDriveError('Company and drive title required'); return; }
    const r = await fetch('/api/admin/placement', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_drive', ...driveForm, package_lpa: driveForm.package_lpa ? Number(driveForm.package_lpa) : null, package_max_lpa: driveForm.package_max_lpa ? Number(driveForm.package_max_lpa) : null, min_cgpa: driveForm.min_cgpa ? Number(driveForm.min_cgpa) : null }) });
    const d = await r.json();
    if (!r.ok) { setDriveError(d.error ?? 'Failed'); return; }
    setToast('Drive scheduled'); setTimeout(() => setToast(''), 3000);
    setShowAddDrive(false); setDriveForm({ company_id: '', title: '', drive_date: '', package_lpa: '', package_max_lpa: '', min_cgpa: '', notes: '' });
    load();
  }

  async function recordOutcome() {
    if (!outcomeForm.drive_id || !outcomeForm.student_id) { setOutcomeError('Drive ID and Student ID required'); return; }
    const r = await fetch('/api/admin/placement', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'record_outcome', ...outcomeForm, package_lpa: outcomeForm.package_lpa ? Number(outcomeForm.package_lpa) : null }) });
    const d = await r.json();
    if (!r.ok) { setOutcomeError(d.error ?? 'Failed'); return; }
    setToast('Outcome recorded'); setTimeout(() => setToast(''), 3000);
    setShowOutcomeForm(false); setOutcomeForm({ drive_id: '', student_id: '', outcome: 'applied', package_lpa: '', offer_date: '' }); load();
  }

  const statusColor: Record<string, string> = { upcoming: '#DBEAFE', ongoing: '#FEF9C3', completed: '#D1FAE5', cancelled: '#FEE2E2' };
  const outcomeColor: Record<string, string> = { applied: '#F3F4F6', shortlisted: '#DBEAFE', selected: '#D1FAE5', rejected: '#FEE2E2', placed: '#DCFCE7', offer_accepted: '#BBF7D0' };

  return (
    <Layout title="Placement" subtitle="Companies, drives, and student outcomes">
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: '#111827', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>{toast}</div>}

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#F3F4F6', borderRadius: 10, padding: 4 }}>
        {[['drives', '📅 Drives'], ['companies', '🏢 Companies'], ['outcomes', '🎯 Outcomes']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key as 'drives' | 'companies' | 'outcomes')}
            style={{ flex: 1, padding: '8px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: tab === key ? '#fff' : 'transparent', color: tab === key ? '#111827' : '#6B7280',
              boxShadow: tab === key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {tab === 'companies' && <button onClick={() => setShowAddCompany(v => !v)} style={{ padding: '8px 14px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Add Company</button>}
        {tab === 'drives' && <button onClick={() => setShowAddDrive(v => !v)} style={{ padding: '8px 14px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Schedule Drive</button>}
        {tab === 'outcomes' && <button onClick={() => setShowOutcomeForm(v => !v)} style={{ padding: '8px 14px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Record Outcome</button>}
      </div>

      {showAddCompany && (
        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Add Company</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
            {[['Name *', 'name'], ['Sector', 'sector'], ['Contact Person', 'contact_name'], ['Phone', 'contact_phone'], ['Email', 'contact_email'], ['Website', 'website']].map(([label, key]) => (
              <div key={key}><label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>{label}</label>
                <input value={(companyForm as Record<string, string>)[key]} onChange={e => setCompanyForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ width: '100%', height: 36, border: '1px solid #D1D5DB', borderRadius: 7, padding: '0 10px', fontSize: 13, boxSizing: 'border-box' }} /></div>
            ))}
          </div>
          {companyError && <div style={{ color: '#991B1B', fontSize: 12, marginTop: 8 }}>{companyError}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={addCompany} style={{ padding: '8px 14px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Add</button>
            <button onClick={() => setShowAddCompany(false)} style={{ padding: '8px 14px', background: '#fff', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {showAddDrive && (
        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Schedule Placement Drive</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
            {[['Company ID *', 'company_id', 'text'], ['Drive Title *', 'title', 'text'], ['Date', 'drive_date', 'date'], ['Min Package (LPA)', 'package_lpa', 'number'], ['Max Package (LPA)', 'package_max_lpa', 'number'], ['Min CGPA', 'min_cgpa', 'number']].map(([label, key, type]) => (
              <div key={key}><label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>{label}</label>
                <input type={type} value={(driveForm as Record<string, string>)[key]} onChange={e => setDriveForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ width: '100%', height: 36, border: '1px solid #D1D5DB', borderRadius: 7, padding: '0 10px', fontSize: 13, boxSizing: 'border-box' }} /></div>
            ))}
          </div>
          {driveError && <div style={{ color: '#991B1B', fontSize: 12, marginTop: 8 }}>{driveError}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={addDrive} style={{ padding: '8px 14px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Schedule</button>
            <button onClick={() => setShowAddDrive(false)} style={{ padding: '8px 14px', background: '#fff', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {showOutcomeForm && (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Record Outcome</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
            {[['Drive ID *', 'drive_id', 'text'], ['Student ID *', 'student_id', 'text'], ['Package (LPA)', 'package_lpa', 'number'], ['Offer Date', 'offer_date', 'date']].map(([label, key, type]) => (
              <div key={key}><label style={{ fontSize: 11, fontWeight: 600, color: '#065F46', display: 'block', marginBottom: 3 }}>{label}</label>
                <input type={type} value={(outcomeForm as Record<string, string>)[key]} onChange={e => setOutcomeForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ width: '100%', height: 36, border: '1px solid #BBF7D0', borderRadius: 7, padding: '0 10px', fontSize: 13, boxSizing: 'border-box' }} /></div>
            ))}
            <div><label style={{ fontSize: 11, fontWeight: 600, color: '#065F46', display: 'block', marginBottom: 3 }}>Outcome</label>
              <select value={outcomeForm.outcome} onChange={e => setOutcomeForm(f => ({ ...f, outcome: e.target.value }))}
                style={{ width: '100%', height: 36, border: '1px solid #BBF7D0', borderRadius: 7, padding: '0 8px', fontSize: 13 }}>
                {['applied', 'shortlisted', 'selected', 'rejected', 'offer_accepted', 'placed'].map(o => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
              </select></div>
          </div>
          {outcomeError && <div style={{ color: '#991B1B', fontSize: 12, marginTop: 8 }}>{outcomeError}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={recordOutcome} style={{ padding: '8px 14px', background: '#065F46', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Record</button>
            <button onClick={() => setShowOutcomeForm(false)} style={{ padding: '8px 14px', background: '#fff', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>Loading...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tab === 'drives' && drives.map(drive => (
            <div key={drive.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{drive.title}</div>
                <span style={{ padding: '3px 9px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: statusColor[drive.status] ?? '#F3F4F6', color: '#374151' }}>{drive.status}</span>
              </div>
              <div style={{ fontSize: 12, color: '#6B7280' }}>{drive.company?.name ?? 'Unknown'}{drive.company?.sector ? ` · ${drive.company.sector}` : ''}</div>
              {drive.drive_date && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{drive.drive_date}</div>}
              {drive.package_lpa && <div style={{ fontSize: 12, color: '#065F46', fontWeight: 600 }}>₹{drive.package_lpa}{drive.package_max_lpa ? `–${drive.package_max_lpa}` : ''} LPA</div>}
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>ID: {drive.id}</div>
            </div>
          ))}
          {tab === 'companies' && companies.map(co => (
            <div key={co.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{co.name}</div>
                {co.sector && <div style={{ fontSize: 12, color: '#6B7280' }}>{co.sector}</div>}
                {co.contact_name && <div style={{ fontSize: 11, color: '#9CA3AF' }}>{co.contact_name} · {co.contact_phone}</div>}
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>ID: {co.id}</div>
              </div>
              <span style={{ padding: '3px 9px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: co.is_active ? '#D1FAE5' : '#F3F4F6', color: co.is_active ? '#065F46' : '#6B7280' }}>{co.is_active ? 'Active' : 'Inactive'}</span>
            </div>
          ))}
          {tab === 'outcomes' && outcomes.map(o => (
            <div key={o.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{o.student?.name ?? 'Unknown'}</div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>{o.drive?.title ?? ''}{o.drive?.company?.name ? ` · ${o.drive.company.name}` : ''}</div>
                {o.package_lpa && <div style={{ fontSize: 12, color: '#065F46', fontWeight: 600 }}>₹{o.package_lpa} LPA</div>}
                {o.offer_date && <div style={{ fontSize: 11, color: '#9CA3AF' }}>Offer: {o.offer_date}</div>}
              </div>
              <span style={{ padding: '3px 9px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: outcomeColor[o.outcome] ?? '#F3F4F6', color: '#374151' }}>{o.outcome.replace(/_/g, ' ')}</span>
            </div>
          ))}
          {(tab === 'drives' ? drives : tab === 'companies' ? companies : outcomes).length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>No {tab} yet. Add above.</div>
          )}
        </div>
      )}
    </Layout>
  );
}
