'use client';
// app/admin/rte/page.tsx
// Batch 4B — RTE Section 12(1)(c) workflow: setup → applications → lottery → admit → certificate.
// Three tabs: Setup | Applications | Admitted Students

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

type Tab = 'setup' | 'applications' | 'admitted';
type AppStatus = 'applied' | 'lottery_selected' | 'admitted' | 'waitlisted' | 'rejected' | 'all';

interface RteConfig { id?: string; entry_class: string; total_seats: number; rte_seats: number; rte_seats_filled: number; academic_year_id: string; }
interface AppStats { applied: number; lottery_selected: number; admitted: number; waitlisted: number; rejected: number; total: number; }
interface RteApp { id: string; applicant_name: string; parent_name: string; parent_phone: string; date_of_birth: string; category: string; status: string; lottery_number: number | null; applied_at: string; student_id: string | null; }
interface AcadYear { id: string; label: string; }

const STATUS_COLORS: Record<string, [string,string]> = {
  applied: ['#F3F4F6','#374151'], lottery_selected: ['#DBEAFE','#1E40AF'],
  admitted: ['#D1FAE5','#065F46'], waitlisted: ['#FEF9C3','#92400E'],
  rejected: ['#FEE2E2','#991B1B'],
};
function Badge({ status }: { status: string }) {
  const [bg, fg] = STATUS_COLORS[status] ?? ['#F3F4F6','#374151'];
  return <span style={{ background: bg, color: fg, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5 }}>{status.replace('_',' ')}</span>;
}

const CERT_CATEGORIES = ['ews','dg','sc','st','obc','differently_abled','orphan'];

export default function RtePage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('applications');
  const [years, setYears] = useState<AcadYear[]>([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [config, setConfig] = useState<RteConfig | null>(null);
  const [stats, setStats] = useState<AppStats>({ applied: 0, lottery_selected: 0, admitted: 0, waitlisted: 0, rejected: 0, total: 0 });
  const [apps, setApps] = useState<RteApp[]>([]);
  const [statusFilter, setStatusFilter] = useState<AppStatus>('all');
  const [loading, setLoading] = useState(false);
  const [lotteryResult, setLotteryResult] = useState<{ selected: number; waitlisted: number } | null>(null);
  const [lotteryRunning, setLotteryRunning] = useState(false);
  const [showLotteryConfirm, setShowLotteryConfirm] = useState(false);
  const [actionStates, setActionStates] = useState<Record<string, string>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ applicant_name: '', parent_name: '', parent_phone: '', date_of_birth: '', category: 'ews', address: '', aadhaar_number: '', supporting_docs: '' });
  const [saving, setSaving] = useState(false);
  const [setupForm, setSetupForm] = useState({ entry_class: 'Class 1', total_seats: 40 });
  const [setupSaving, setSetupSaving] = useState(false);
  const [setupMsg, setSetupMsg] = useState<string | null>(null);

  const lotteryAlreadyRun = apps.some(a => a.lottery_number !== null);
  const admittedApps = apps.filter(a => a.status === 'admitted');

  useEffect(() => {
    void fetch('/api/admin/institution-config').then(r => r.json())
      .then((d: { feature_flags?: Record<string, unknown> }) => setEnabled(!!(d.feature_flags?.rte_mode_enabled)))
      .catch(() => setEnabled(false));
    void fetch('/api/admin/academic-years').then(r => r.ok ? r.json() : null)
      .then((d: { years?: AcadYear[] } | null) => { if (d?.years?.length) { setYears(d.years); setSelectedYear(d.years.find(y => y.label === '2026-27')?.id ?? d.years[0]?.id ?? ''); }});
  }, []);

  const loadRteData = useCallback(async () => {
    if (!enabled || !selectedYear) return;
    setLoading(true);
    const [cfgRes, appRes] = await Promise.allSettled([
      fetch(`/api/admin/rte/config?year=${selectedYear}`).then(r => r.json()),
      fetch(`/api/admin/rte/applications?year=${selectedYear}&status=${statusFilter}`).then(r => r.json()),
    ]);
    if (cfgRes.status === 'fulfilled') {
      const d = cfgRes.value as { config?: RteConfig; applications?: AppStats };
      setConfig(d.config ?? null);
      setStats(d.applications ?? { applied:0,lottery_selected:0,admitted:0,waitlisted:0,rejected:0,total:0 });
      if (d.config) setSetupForm({ entry_class: d.config.entry_class, total_seats: d.config.total_seats });
    }
    if (appRes.status === 'fulfilled') {
      const d = appRes.value as { applications?: RteApp[] };
      setApps(d.applications ?? []);
    }
    setLoading(false);
  }, [enabled, selectedYear, statusFilter]);

  useEffect(() => { if (enabled && selectedYear) void loadRteData(); }, [enabled, selectedYear, statusFilter, loadRteData]);

  async function saveSetup() {
    setSetupSaving(true); setSetupMsg(null);
    const res = await fetch('/api/admin/rte/config', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry_class: setupForm.entry_class, total_seats: setupForm.total_seats, academic_year_id: selectedYear }),
    });
    const d = await res.json() as { config?: RteConfig; error?: string };
    setSetupMsg(res.ok ? `✓ Saved — ${d.config?.rte_seats} RTE seats (25% of ${setupForm.total_seats})` : (d.error ?? 'Error'));
    if (res.ok) void loadRteData();
    setSetupSaving(false);
  }

  async function runLottery() {
    setLotteryRunning(true); setShowLotteryConfirm(false);
    const res = await fetch('/api/admin/rte/lottery', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ academic_year_id: selectedYear, confirmed: true }),
    });
    const d = await res.json() as { selected?: number; waitlisted?: number; error?: string };
    if (res.ok) { setLotteryResult({ selected: d.selected ?? 0, waitlisted: d.waitlisted ?? 0 }); void loadRteData(); }
    setLotteryRunning(false);
  }

  async function admitStudent(appId: string) {
    setActionStates(prev => ({ ...prev, [appId]: 'loading' }));
    const res = await fetch(`/api/admin/rte/applications/${appId}/admit`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmed: true }),
    });
    setActionStates(prev => ({ ...prev, [appId]: res.ok ? 'admitted' : 'error' }));
    if (res.ok) void loadRteData();
  }

  async function downloadCert(appId: string) {
    setActionStates(prev => ({ ...prev, [`cert_${appId}`]: 'loading' }));
    const res = await fetch(`/api/admin/rte/certificates/${appId}`, { method: 'POST' });
    const d = await res.json() as { pdf_data?: string; certificate_number?: string; error?: string };
    if (res.ok && d.pdf_data) {
      // Parse cert JSON and create a printable HTML page
      const cert = JSON.parse(d.pdf_data) as Record<string, string>;
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(`<html><head><title>RTE Certificate ${d.certificate_number}</title>
<style>body{font-family:serif;max-width:700px;margin:40px auto;border:3px double #1e3a5f;padding:40px}
h1{color:#1e3a5f;font-size:18px;text-align:center}h2{font-size:13px;text-align:center;color:#555}
.field{margin:12px 0;font-size:14px}.label{font-weight:bold;color:#333}
.footer{margin-top:30px;font-size:12px;color:#555;border-top:1px solid #ccc;padding-top:10px;text-align:center}
.cert-no{font-size:11px;color:#888;text-align:right;margin-bottom:20px}
@media print{button{display:none}}</style></head><body>
<h1>${cert.title}</h1><h2>${cert.subtitle}</h2>
<div class="cert-no">Certificate No: ${cert.certificate_number}</div>
<div class="field"><span class="label">School:</span> ${cert.school_name}</div>
<div class="field"><span class="label">Address:</span> ${cert.school_address}</div>
<div class="field"><span class="label">Student Name:</span> ${cert.student_name}</div>
<div class="field"><span class="label">Date of Birth:</span> ${cert.date_of_birth}</div>
<div class="field"><span class="label">Category:</span> ${cert.category}</div>
<div class="field"><span class="label">Admitted to:</span> ${cert.admitted_to}, Academic Year ${cert.academic_year}</div>
<div class="field"><span class="label">Date of Issue:</span> ${cert.issued_date}</div>
<div class="footer">${cert.footer}</div>
<br><button onclick="window.print()">🖨 Print / Save as PDF</button>
</body></html>`);
        w.document.close();
      }
    }
    setActionStates(prev => ({ ...prev, [`cert_${appId}`]: res.ok ? 'done' : 'error' }));
    setTimeout(() => setActionStates(prev => { const n={...prev}; delete n[`cert_${appId}`]; return n; }), 3000);
  }

  async function addApplication() {
    setSaving(true);
    const res = await fetch('/api/admin/rte/applications', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, academic_year_id: selectedYear }),
    });
    if (res.ok) { setShowAddModal(false); setForm({ applicant_name:'',parent_name:'',parent_phone:'',date_of_birth:'',category:'ews',address:'',aadhaar_number:'',supporting_docs:'' }); void loadRteData(); }
    setSaving(false);
  }

  const cardStyle = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, marginBottom: 20 };
  const inputStyle = { width: '100%', padding: '6px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 12, boxSizing: 'border-box' as const, marginTop: 3 };

  if (enabled === null) return <Layout title="RTE Admissions"><div style={{ padding: 40, color: '#9CA3AF' }}>Loading...</div></Layout>;
  if (!enabled) return (
    <Layout title="RTE Admissions">
      <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🏫</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#374151' }}>RTE mode not enabled</div>
        <div style={{ fontSize: 12, marginTop: 6 }}>Enable "RTE Mode" in Settings → Institution.</div>
      </div>
    </Layout>
  );

  const rteSeatsComputed = Math.ceil(setupForm.total_seats * 0.25);
  const filteredApps = apps.filter(a => statusFilter === 'all' || a.status === statusFilter);

  return (
    <Layout title="RTE Admissions" subtitle="Section 12(1)(c) — Free seats for EWS/DG students"
      actions={
        <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}
          style={{ padding: '5px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 12 }}>
          {years.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}
        </select>
      }>

      {/* Stats bar */}
      {config && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px,1fr))', gap: 8, marginBottom: 20 }}>
          {[
            ['Total Seats', config.total_seats, '#374151'],
            ['RTE Seats (25%)', config.rte_seats, '#4F46E5'],
            ['Applications', stats.total, '#374151'],
            ['Selected', stats.lottery_selected, '#1E40AF'],
            ['Admitted', stats.admitted, '#065F46'],
            ['Remaining', Math.max(0, config.rte_seats - config.rte_seats_filled), config.rte_seats_filled < config.rte_seats ? '#D97706' : '#6B7280'],
          ].map(([label, val, color]) => (
            <div key={label as string} style={{ textAlign: 'center', padding: '10px 8px', background: '#fff', border: `1px solid #E5E7EB`, borderRadius: 10 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: color as string }}>{val as number}</div>
              <div style={{ fontSize: 9, color: '#6B7280', fontWeight: 600, marginTop: 2 }}>{label as string}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['applications','setup','admitted'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '6px 16px', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: tab===t ? '#4F46E5' : '#fff', color: tab===t ? '#fff' : '#374151', textTransform: 'capitalize' }}>
            {t === 'applications' ? '📋 Applications' : t === 'setup' ? '⚙️ Setup' : '✅ Admitted'}
          </button>
        ))}
      </div>

      {/* === TAB: SETUP === */}
      {tab === 'setup' && (
        <div style={cardStyle}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Seat Configuration</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ flex: 1, minWidth: 150 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280' }}>ENTRY CLASS</div>
              <select value={setupForm.entry_class} onChange={e => setSetupForm(f => ({...f, entry_class: e.target.value}))}
                style={{ ...inputStyle, maxWidth: 180 }}>
                {['Class 1','Class Nursery','Class LKG','Class UKG'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 150 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280' }}>TOTAL SEATS IN CLASS</div>
              <input type="number" value={setupForm.total_seats} onChange={e => setSetupForm(f => ({...f, total_seats: parseInt(e.target.value)||0}))}
                style={{ ...inputStyle, maxWidth: 120 }} />
            </div>
          </div>
          <div style={{ background: '#EEF2FF', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#3730A3' }}>
            RTE seats = 25% of {setupForm.total_seats} = <strong>{rteSeatsComputed} seats</strong> reserved for EWS/DG students
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={() => void saveSetup()} disabled={setupSaving}
              style={{ padding: '7px 18px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              {setupSaving ? 'Saving...' : 'Save Configuration'}
            </button>
            {setupMsg && <span style={{ fontSize: 11, color: setupMsg.startsWith('✓') ? '#065F46' : '#B91C1C' }}>{setupMsg}</span>}
          </div>
        </div>
      )}

      {/* === TAB: APPLICATIONS === */}
      {tab === 'applications' && (
        <>
          {/* Lottery result banner */}
          {lotteryResult && (
            <div style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: '#065F46' }}>
              🎲 Lottery complete: <strong>{lotteryResult.selected} selected</strong>, {lotteryResult.waitlisted} waitlisted.
              Click "Admit Student" on selected applicants to create their student records.
            </div>
          )}

          {/* Actions row */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['all','applied','lottery_selected','admitted','waitlisted'] as AppStatus[]).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  style={{ padding: '4px 10px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', background: statusFilter===s ? '#4F46E5' : '#fff', color: statusFilter===s ? '#fff' : '#374151' }}>
                  {s === 'all' ? 'All' : s.replace('_',' ')}
                  {s !== 'all' && ` (${stats[s as keyof AppStats]})`}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {!lotteryAlreadyRun && stats.applied > 0 && !showLotteryConfirm && (
                <button onClick={() => setShowLotteryConfirm(true)}
                  style={{ padding: '6px 14px', background: '#7C3AED', color: '#fff', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  🎲 Run Lottery
                </button>
              )}
              <button onClick={() => setShowAddModal(true)}
                style={{ padding: '6px 14px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                + Add Application
              </button>
            </div>
          </div>

          {/* Lottery confirmation */}
          {showLotteryConfirm && (
            <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E', marginBottom: 8 }}>⚠️ Confirm Lottery Draw</div>
              <div style={{ fontSize: 12, color: '#92400E', marginBottom: 12 }}>
                This will randomly assign lottery numbers to <strong>{stats.applied} applications</strong>.
                Top <strong>{config?.rte_seats ?? '?'} applicants</strong> will be selected. <strong>This cannot be undone.</strong>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => void runLottery()} disabled={lotteryRunning}
                  style={{ padding: '6px 16px', background: '#7C3AED', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {lotteryRunning ? 'Running...' : '✓ Yes, Run Lottery'}
                </button>
                <button onClick={() => setShowLotteryConfirm(false)}
                  style={{ padding: '6px 16px', background: '#F3F4F6', border: 'none', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div style={cardStyle}>
            {loading ? <div style={{ color: '#9CA3AF', fontSize: 12, padding: 16 }}>Loading...</div>
            : filteredApps.length === 0 ? <div style={{ color: '#9CA3AF', fontSize: 12, padding: 16, textAlign: 'center' }}>No applications.</div>
            : (
              <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB' }}>
                      {['#','Name','Category','Parent','DOB','Status','Actions'].map(h => (
                        <th key={h} style={{ padding: '7px 8px', textAlign: 'left', fontWeight: 700, fontSize: 10, color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApps.map(a => (
                      <tr key={a.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td style={{ padding: '7px 8px', color: '#9CA3AF', fontWeight: 700 }}>{a.lottery_number ?? '—'}</td>
                        <td style={{ padding: '7px 8px', fontWeight: 600 }}>{a.applicant_name}</td>
                        <td style={{ padding: '7px 8px', textTransform: 'uppercase', fontSize: 10, color: '#6B7280' }}>{a.category}</td>
                        <td style={{ padding: '7px 8px', color: '#6B7280' }}>{a.parent_name}</td>
                        <td style={{ padding: '7px 8px', color: '#6B7280' }}>{a.date_of_birth}</td>
                        <td style={{ padding: '7px 8px' }}><Badge status={a.status} /></td>
                        <td style={{ padding: '7px 8px' }}>
                          {a.status === 'lottery_selected' && (
                            <button onClick={() => void admitStudent(a.id)} disabled={actionStates[a.id]==='loading'}
                              style={{ padding: '3px 8px', background: '#065F46', color: '#fff', border: 'none', borderRadius: 5, fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>
                              {actionStates[a.id]==='loading' ? '...' : actionStates[a.id]==='admitted' ? '✓' : 'Admit'}
                            </button>
                          )}
                          {a.status === 'admitted' && (
                            <button onClick={() => void downloadCert(a.id)} disabled={actionStates[`cert_${a.id}`]==='loading'}
                              style={{ padding: '3px 8px', background: '#1E40AF', color: '#fff', border: 'none', borderRadius: 5, fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>
                              {actionStates[`cert_${a.id}`]==='loading' ? '...' : '📄 Cert'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* === TAB: ADMITTED === */}
      {tab === 'admitted' && (
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>RTE-Admitted Students ({admittedApps.length})</div>
          {admittedApps.length === 0 ? (
            <div style={{ color: '#9CA3AF', fontSize: 12 }}>No students admitted yet.</div>
          ) : (
            <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#F9FAFB' }}>
                    {['Lottery #','Name','Category','Parent','Phone','Actions'].map(h => (
                      <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, fontSize: 10, color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {admittedApps.map(a => (
                    <tr key={a.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '7px 10px', fontWeight: 700, color: '#4F46E5' }}>{a.lottery_number}</td>
                      <td style={{ padding: '7px 10px', fontWeight: 600 }}>{a.applicant_name}</td>
                      <td style={{ padding: '7px 10px', textTransform: 'uppercase', fontSize: 10, color: '#6B7280' }}>{a.category}</td>
                      <td style={{ padding: '7px 10px', color: '#6B7280' }}>{a.parent_name}</td>
                      <td style={{ padding: '7px 10px', color: '#6B7280' }}>{a.parent_phone}</td>
                      <td style={{ padding: '7px 10px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => void downloadCert(a.id)} disabled={actionStates[`cert_${a.id}`]==='loading'}
                            style={{ padding: '3px 10px', background: '#1E40AF', color: '#fff', border: 'none', borderRadius: 5, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                            {actionStates[`cert_${a.id}`]==='loading' ? '...' : '📄 Certificate'}
                          </button>
                          {a.student_id && (
                            <a href={`/admin/students?id=${a.student_id}`} style={{ padding: '3px 10px', background: '#F3F4F6', color: '#374151', borderRadius: 5, fontSize: 10, fontWeight: 600, textDecoration: 'none' }}>
                              View Student →
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* === Add Application Modal === */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000080', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 440, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 18 }}>Add RTE Application</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {([
                ['Applicant Name *', 'applicant_name', 'text'],
                ['Parent/Guardian Name *', 'parent_name', 'text'],
                ['Parent Phone *', 'parent_phone', 'tel'],
                ['Date of Birth *', 'date_of_birth', 'date'],
                ['Address', 'address', 'text'],
                ['Aadhaar Number', 'aadhaar_number', 'text'],
                ['Supporting Documents', 'supporting_docs', 'text'],
              ] as [string, string, string][]).map(([label, key, type]) => (
                <div key={key}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280' }}>{label}</div>
                  <input type={type} value={(form as Record<string,string>)[key]} onChange={e => setForm(f => ({...f, [key]: e.target.value}))} style={inputStyle} />
                </div>
              ))}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280' }}>Category *</div>
                <select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))} style={inputStyle}>
                  {CERT_CATEGORIES.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowAddModal(false)} style={{ flex: 1, padding: '8px', background: '#F3F4F6', border: 'none', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => void addApplication()} disabled={saving || !form.applicant_name || !form.parent_name || !form.date_of_birth}
                style={{ flex: 2, padding: '8px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {saving ? 'Saving...' : 'Submit Application'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
