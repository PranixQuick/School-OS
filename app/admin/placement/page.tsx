'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

interface Company { id: string; name: string; sector: string | null; contact_name: string | null; contact_phone: string | null; contact_email: string | null; is_active: boolean; }
interface Drive { id: string; title: string; drive_date: string | null; package_lpa: number | null; package_max_lpa: number | null; status: string; min_cgpa: number | null; backlogs_allowed: boolean; company?: { name: string; sector: string | null } | null; }

export default function PlacementPage() {
  const [tab, setTab] = useState<'drives' | 'companies'>('drives');
  const [drives, setDrives] = useState<Drive[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [compForm, setCompForm] = useState({ name: '', sector: '', contact_name: '', contact_phone: '', contact_email: '' });
  const [driveForm, setDriveForm] = useState({ company_id: '', title: '', drive_date: '', package_lpa: '', package_max_lpa: '', min_cgpa: '', backlogs_allowed: false });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    setLoading(true);
    const [d, c] = await Promise.all([
      fetch('/api/admin/placement?view=drives').then(r => r.json()),
      fetch('/api/admin/placement?view=companies').then(r => r.json()),
    ]);
    setDrives(d.drives ?? []);
    setCompanies(c.companies ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function addCompany() {
    setSaving(true); setMsg('');
    const res = await fetch('/api/admin/placement', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add_company', ...compForm }) });
    const d = await res.json();
    if (res.ok) { setMsg('Company added'); setCompForm({ name: '', sector: '', contact_name: '', contact_phone: '', contact_email: '' }); void load(); }
    else setMsg(d.error ?? 'Error');
    setSaving(false);
  }

  async function addDrive() {
    setSaving(true); setMsg('');
    const res = await fetch('/api/admin/placement', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      action: 'add_drive',
      company_id: driveForm.company_id,
      title: driveForm.title,
      drive_date: driveForm.drive_date || null,
      package_lpa: driveForm.package_lpa ? Number(driveForm.package_lpa) : null,
      package_max_lpa: driveForm.package_max_lpa ? Number(driveForm.package_max_lpa) : null,
      min_cgpa: driveForm.min_cgpa ? Number(driveForm.min_cgpa) : null,
      backlogs_allowed: driveForm.backlogs_allowed,
    }) });
    const d = await res.json();
    if (res.ok) { setMsg('Drive added'); setDriveForm({ company_id: '', title: '', drive_date: '', package_lpa: '', package_max_lpa: '', min_cgpa: '', backlogs_allowed: false }); void load(); }
    else setMsg(d.error ?? 'Error');
    setSaving(false);
  }

  const STATUS_COLORS: Record<string, [string, string]> = { upcoming: ['#EEF2FF', '#3730A3'], ongoing: ['#D1FAE5', '#065F46'], completed: ['#F3F4F6', '#6B7280'], cancelled: ['#FEE2E2', '#991B1B'] };
  const inputStyle = { padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const };

  return (
    <Layout title="Placement" subtitle="Campus placement drives and company management">
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 0 40px' }}>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #E5E7EB', marginBottom: 20 }}>
          {(['drives', 'companies'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t ? 700 : 500, color: tab === t ? '#4F46E5' : '#6B7280', borderBottom: tab === t ? '2px solid #4F46E5' : '2px solid transparent', marginBottom: -2 }}>
              {t === 'drives' ? 'Placement Drives' : 'Companies'}
            </button>
          ))}
        </div>

        {tab === 'companies' && (
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 18, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Add Company</div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 8 }}>
              <input placeholder="Company name *" value={compForm.name} onChange={e => setCompForm(f => ({ ...f, name: e.target.value }))} style={{ ...inputStyle, width: '100%' }} />
              <input placeholder="Sector (IT, Core, Finance...)" value={compForm.sector} onChange={e => setCompForm(f => ({ ...f, sector: e.target.value }))} style={{ ...inputStyle, width: '100%' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 8, marginBottom: 12 }}>
              <input placeholder="Contact name" value={compForm.contact_name} onChange={e => setCompForm(f => ({ ...f, contact_name: e.target.value }))} style={{ ...inputStyle, width: '100%' }} />
              <input placeholder="Phone" value={compForm.contact_phone} onChange={e => setCompForm(f => ({ ...f, contact_phone: e.target.value }))} style={{ ...inputStyle, width: '100%' }} />
              <input placeholder="Email" value={compForm.contact_email} onChange={e => setCompForm(f => ({ ...f, contact_email: e.target.value }))} style={{ ...inputStyle, width: '100%' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={addCompany} disabled={saving || !compForm.name} style={{ padding: '8px 18px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {saving ? 'Saving...' : 'Add Company'}
              </button>
              {msg && <span style={{ fontSize: 12, color: msg.includes('added') ? '#065F46' : '#991B1B' }}>{msg}</span>}
            </div>
          </div>
        )}

        {tab === 'drives' && (
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 18, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Schedule Drive</div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: 8, marginBottom: 8 }}>
              <select value={driveForm.company_id} onChange={e => setDriveForm(f => ({ ...f, company_id: e.target.value }))} style={{ ...inputStyle, width: '100%', background: '#fff' }}>
                <option value="">Select company *</option>
                {companies.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}{c.sector ? ` (${c.sector})` : ''}</option>)}
              </select>
              <input placeholder="Drive title / role *" value={driveForm.title} onChange={e => setDriveForm(f => ({ ...f, title: e.target.value }))} style={{ ...inputStyle, width: '100%' }} />
              <input type="date" value={driveForm.drive_date} onChange={e => setDriveForm(f => ({ ...f, drive_date: e.target.value }))} style={{ ...inputStyle, width: '100%' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, marginBottom: 12, alignItems: 'end' }}>
              <input type="number" placeholder="Min package (LPA)" value={driveForm.package_lpa} onChange={e => setDriveForm(f => ({ ...f, package_lpa: e.target.value }))} style={{ ...inputStyle, width: '100%' }} />
              <input type="number" placeholder="Max package (LPA)" value={driveForm.package_max_lpa} onChange={e => setDriveForm(f => ({ ...f, package_max_lpa: e.target.value }))} style={{ ...inputStyle, width: '100%' }} />
              <input type="number" step="0.1" placeholder="Min CGPA" value={driveForm.min_cgpa} onChange={e => setDriveForm(f => ({ ...f, min_cgpa: e.target.value }))} style={{ ...inputStyle, width: '100%' }} />
              <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={driveForm.backlogs_allowed} onChange={e => setDriveForm(f => ({ ...f, backlogs_allowed: e.target.checked }))} />
                Backlogs OK
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={addDrive} disabled={saving || !driveForm.company_id || !driveForm.title} style={{ padding: '8px 18px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {saving ? 'Saving...' : 'Add Drive'}
              </button>
              {msg && <span style={{ fontSize: 12, color: msg.includes('added') ? '#065F46' : '#991B1B' }}>{msg}</span>}
            </div>
          </div>
        )}

        {loading ? <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Loading...</div> : tab === 'drives' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {drives.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>No drives yet.</div> : drives.map(d => {
              const [bg, fg] = STATUS_COLORS[d.status] ?? ['#F3F4F6', '#6B7280'];
              return (
                <div key={d.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>{d.company?.name} — {d.title}</div>
                    <span style={{ fontSize: 10, fontWeight: 700, background: bg, color: fg, padding: '2px 8px', borderRadius: 10 }}>{d.status.toUpperCase()}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>
                    {d.drive_date ? new Date(d.drive_date).toLocaleDateString('en-IN') : 'Date TBD'}
                    {d.package_lpa ? ` · ₹${d.package_lpa}${d.package_max_lpa ? `–${d.package_max_lpa}` : ''} LPA` : ''}
                    {d.min_cgpa ? ` · CGPA ≥ ${d.min_cgpa}` : ''}
                    {d.backlogs_allowed ? ' · Backlogs allowed' : ''}
                    {d.company?.sector ? ` · ${d.company.sector}` : ''}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
            {companies.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>No companies yet.</div> : companies.map(c => (
              <div key={c.id} style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 12, opacity: c.is_active ? 1 : 0.5 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}{c.sector ? <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 400 }}> · {c.sector}</span> : null}</div>
                  {(c.contact_name || c.contact_phone) && <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{c.contact_name}{c.contact_phone ? ` · ${c.contact_phone}` : ''}{c.contact_email ? ` · ${c.contact_email}` : ''}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
