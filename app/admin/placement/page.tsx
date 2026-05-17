'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

interface Company { id: string; name: string; sector: string | null; contact_name: string | null; contact_phone: string | null; is_active: boolean; }
interface Drive { id: string; title: string; drive_date: string | null; package_lpa: number | null; package_max_lpa: number | null; min_cgpa: number | null; backlogs_allowed: boolean; status: string; company?: { name: string; sector: string | null } | null; }

export default function PlacementPage() {
  const [tab, setTab] = useState<'drives' | 'companies'>('drives');
  const [drives, setDrives] = useState<Drive[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [showDriveForm, setShowDriveForm] = useState(false);
  const [editDriveId, setEditDriveId] = useState<string | null>(null);
  const [compForm, setCompForm] = useState({ name: '', sector: '', contact_name: '', contact_phone: '', contact_email: '', website: '' });
  const [driveForm, setDriveForm] = useState({ company_id: '', title: '', drive_date: '', package_lpa: '', package_max_lpa: '', min_cgpa: '', backlogs_allowed: false, notes: '' });
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
    setSaving(true);
    const res = await fetch('/api/admin/placement', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add_company', ...compForm }) });
    const d = await res.json();
    setSaving(false);
    if (res.ok) { setMsg('Company added'); setShowCompanyForm(false); setCompForm({ name: '', sector: '', contact_name: '', contact_phone: '', contact_email: '', website: '' }); void load(); }
    else setMsg(d.error ?? 'Error');
  }

  async function addDrive() {
    setSaving(true);
    const body = { action: 'add_drive', ...driveForm, package_lpa: driveForm.package_lpa ? Number(driveForm.package_lpa) : null, package_max_lpa: driveForm.package_max_lpa ? Number(driveForm.package_max_lpa) : null, min_cgpa: driveForm.min_cgpa ? Number(driveForm.min_cgpa) : null };
    const res = await fetch('/api/admin/placement', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await res.json();
    setSaving(false);
    if (res.ok) { setMsg('Drive scheduled'); setShowDriveForm(false); setDriveForm({ company_id: '', title: '', drive_date: '', package_lpa: '', package_max_lpa: '', min_cgpa: '', backlogs_allowed: false, notes: '' }); void load(); }
    else setMsg(d.error ?? 'Error');
  }

  async function updateStatus(id: string, status: string) {
    await fetch('/api/admin/placement', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, type: 'drive', status }) });
    void load();
  }

  const statusBadge: Record<string, { bg: string; color: string }> = {
    upcoming: { bg: '#EEF2FF', color: '#4F46E5' }, active: { bg: '#D1FAE5', color: '#065F46' }, completed: { bg: '#F3F4F6', color: '#4B5563' }, cancelled: { bg: '#FEE2E2', color: '#991B1B' },
  };
  const S = { card: { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 14, marginBottom: 8 } as React.CSSProperties };

  return (
    <Layout title="Placement" subtitle="Campus drives, companies and student outcomes">
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 16px 40px' }}>
        {msg && <div style={{ background: msg.includes('rror') ? '#FEE2E2' : '#D1FAE5', color: msg.includes('rror') ? '#991B1B' : '#065F46', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>{msg}</div>}

        <div style={{ display: 'flex', gap: 0, marginBottom: 16, background: '#F3F4F6', borderRadius: 10, padding: 4 }}>
          {(['drives', 'companies'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex: 1, padding: '8px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: tab === t ? '#fff' : 'transparent', color: tab === t ? '#111827' : '#6B7280' }}>
              {t === 'drives' ? `Drives (${drives.length})` : `Companies (${companies.length})`}
            </button>
          ))}
        </div>

        {tab === 'companies' && (
          <>
            <div style={{ marginBottom: 12 }}>
              <button onClick={() => setShowCompanyForm(true)} style={{ padding: '8px 16px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Add Company</button>
            </div>
            {showCompanyForm && (
              <div style={{ ...S.card, border: '2px solid #4F46E5', marginBottom: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 10 }}>New Company</div>
                {(['name', 'sector', 'contact_name', 'contact_phone', 'contact_email', 'website'] as const).map(k => (
                  <div key={k} style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>{k.replace('_', ' ').toUpperCase()}{k === 'name' ? ' *' : ''}</label>
                    <input value={compForm[k]} onChange={e => setCompForm(f => ({ ...f, [k]: e.target.value }))} style={{ width: '100%', padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' as const }} />
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={addCompany} disabled={saving || !compForm.name} style={{ flex: 1, padding: '8px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{saving ? 'Saving...' : 'Add Company'}</button>
                  <button onClick={() => setShowCompanyForm(false)} style={{ padding: '8px 14px', background: '#F3F4F6', border: 'none', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}
            {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading...</div> :
              companies.length === 0 ? <div style={{ textAlign: 'center', padding: 48, color: '#9CA3AF' }}><div style={{ fontSize: 32, marginBottom: 8 }}>🤝</div><div>No companies yet. Add companies to schedule placement drives.</div></div> :
              companies.map(c => (
                <div key={c.id} style={S.card}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                    {c.sector ?? 'No sector'}{c.contact_name ? ` · ${c.contact_name}` : ''}{c.contact_phone ? ` · ${c.contact_phone}` : ''}
                  </div>
                </div>
              ))}
          </>
        )}

        {tab === 'drives' && (
          <>
            <div style={{ marginBottom: 12 }}>
              <button onClick={() => setShowDriveForm(true)} style={{ padding: '8px 16px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Schedule Drive</button>
            </div>
            {showDriveForm && (
              <div style={{ ...S.card, border: '2px solid #4F46E5', marginBottom: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 10 }}>Schedule Placement Drive</div>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>COMPANY *</label>
                  <select value={driveForm.company_id} onChange={e => setDriveForm(f => ({ ...f, company_id: e.target.value }))} style={{ width: '100%', padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13 }}>
                    <option value="">— Select company —</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                {(['title', 'drive_date'] as const).map(k => (
                  <div key={k} style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>{k === 'title' ? 'DRIVE TITLE *' : 'DRIVE DATE'}</label>
                    <input type={k === 'drive_date' ? 'date' : 'text'} value={driveForm[k]} onChange={e => setDriveForm(f => ({ ...f, [k]: e.target.value }))} placeholder={k === 'title' ? 'e.g. Software Engineer 2025' : ''} style={{ width: '100%', padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' as const }} />
                  </div>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                  {(['package_lpa', 'package_max_lpa', 'min_cgpa'] as const).map(k => (
                    <div key={k}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>{k.replace(/_/g, ' ').toUpperCase()}</label>
                      <input type="number" step="0.1" value={driveForm[k]} onChange={e => setDriveForm(f => ({ ...f, [k]: e.target.value }))} style={{ width: '100%', padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13 }} />
                    </div>
                  ))}
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', marginBottom: 12 }}>
                  <input type="checkbox" checked={driveForm.backlogs_allowed} onChange={e => setDriveForm(f => ({ ...f, backlogs_allowed: e.target.checked }))} />
                  Backlogs allowed
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={addDrive} disabled={saving || !driveForm.company_id || !driveForm.title} style={{ flex: 1, padding: '8px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{saving ? 'Saving...' : 'Schedule Drive'}</button>
                  <button onClick={() => setShowDriveForm(false)} style={{ padding: '8px 14px', background: '#F3F4F6', border: 'none', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}
            {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading...</div> :
              drives.length === 0 ? <div style={{ textAlign: 'center', padding: 48, color: '#9CA3AF' }}><div style={{ fontSize: 32, marginBottom: 8 }}>💼</div><div>No drives yet. Add companies first, then schedule drives.</div></div> :
              drives.map(d => {
                const badge = statusBadge[d.status] ?? statusBadge.upcoming;
                return (
                  <div key={d.id} style={S.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{d.title}</span>
                          <span style={{ background: badge.bg, color: badge.color, borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>{d.status.toUpperCase()}</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#6B7280' }}>
                          {d.company?.name ?? '—'}{d.drive_date ? ` · ${d.drive_date}` : ''}{d.package_lpa ? ` · ₹${d.package_lpa}${d.package_max_lpa ? `–${d.package_max_lpa}` : ''} LPA` : ''}{d.min_cgpa ? ` · CGPA ≥${d.min_cgpa}` : ''}
                        </div>
                      </div>
                      <select value={d.status} onChange={e => void updateStatus(d.id, e.target.value)}
                        style={{ padding: '5px 8px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: '#fff' }}>
                        {['upcoming', 'active', 'completed', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                );
              })}
          </>
        )}
      </div>
    </Layout>
  );
}
