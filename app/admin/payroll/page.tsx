'use client';
import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import { T } from '@/lib/i18n';
import { useLang } from '@/lib/useLang';

interface Structure {
  id: string; staff_id: string; gross_salary: number; basic_salary: number;
  hra: number; da: number; pf_employee_pct: number; tds_placeholder: number;
  staff: { id: string; name: string; designation: string; department: string };
}
interface Run {
  id: string; pay_period_month: number; pay_period_year: number;
  status: string; total_staff: number; total_gross: number;
  total_deductions: number; total_net: number; created_at: string;
}
interface Staff { id: string; name: string; designation: string; department: string; }
interface Payslip {
  id: string; staff_id: string; gross_salary: number; basic_salary: number;
  hra: number; da: number; pf_employee: number; tds: number;
  total_deductions: number; net_salary: number; payment_status: string;
}

const MONTHS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  draft: { bg: '#FEF9C3', color: '#92400E' },
  approved: { bg: '#D1FAE5', color: '#065F46' },
  paid: { bg: '#DBEAFE', color: '#1D4ED8' },
  cancelled: { bg: '#F3F4F6', color: '#374151' },
};

export default function PayrollPage() {
  const { lang } = useLang();
  const [tab, setTab] = useState<'runs' | 'structures' | 'new_structure'>('runs');
  const [structures, setStructures] = useState<Structure[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [runPayslips, setRunPayslips] = useState<Payslip[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  const now = new Date();
  const [newMonth, setNewMonth] = useState(now.getMonth() + 1);
  const [newYear, setNewYear] = useState(now.getFullYear());

  const [structForm, setStructForm] = useState({
    staff_id: '', basic_salary: '', hra: '', da: '',
    conveyance: '', medical_allowance: '', other_allowance: '',
    pf_employee_pct: '12', pf_employer_pct: '12',
    esi_applicable: false, tds_placeholder: '', other_deduction: '',
  });

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000); }
  function setF(k: keyof typeof structForm, v: string | boolean) { setStructForm(p => ({ ...p, [k]: v })); }

  const loadData = useCallback(async () => {
    const [runsR, structR, staffR] = await Promise.all([
      fetch('/api/admin/payroll/runs').then(r => r.ok ? r.json() : { runs: [] }),
      fetch('/api/admin/payroll/structures').then(r => r.ok ? r.json() : { structures: [] }),
      fetch('/api/admin/staff').then(r => r.ok ? r.json() : { staff: [] }),
    ]);
    setRuns(runsR.runs ?? []);
    setStructures(structR.structures ?? []);
    setStaffList(staffR.staff ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function createRun() {
    setCreating(true);
    const res = await fetch('/api/admin/payroll/runs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pay_period_month: newMonth, pay_period_year: newYear }),
    });
    const d = await res.json();
    if (res.ok) { setRuns(p => [d.run, ...p]); showToast(T('payroll_run_created', lang as never) + ' — ' + MONTHS[newMonth] + ' ' + newYear); }
    else showToast(d.error ?? 'Failed');
    setCreating(false);
  }

  async function saveStructure() {
    if (!structForm.staff_id || !structForm.basic_salary) { showToast(T('staff_salary_required', lang as never)); return; }
    setSaving(true);
    const res = await fetch('/api/admin/payroll/structures', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        staff_id: structForm.staff_id,
        basic_salary: Number(structForm.basic_salary),
        hra: Number(structForm.hra) || 0, da: Number(structForm.da) || 0,
        conveyance: Number(structForm.conveyance) || 0,
        medical_allowance: Number(structForm.medical_allowance) || 0,
        other_allowance: Number(structForm.other_allowance) || 0,
        pf_employee_pct: Number(structForm.pf_employee_pct) || 12,
        pf_employer_pct: Number(structForm.pf_employer_pct) || 12,
        esi_applicable: structForm.esi_applicable,
        tds_placeholder: Number(structForm.tds_placeholder) || 0,
        other_deduction: Number(structForm.other_deduction) || 0,
      }),
    });
    const d = await res.json();
    if (res.ok) { showToast(T('structure_saved', lang as never)); setTab('structures'); loadData(); }
    else showToast(d.error ?? 'Failed to save');
    setSaving(false);
  }

  async function approveRun(runId: string, action: 'approve' | 'mark_paid' | 'cancel') {
    setActionLoading(true);
    const res = await fetch(`/api/admin/payroll/runs/${runId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const d = await res.json();
    if (res.ok) {
      showToast(action === 'mark_paid' ? T('payroll_marked_paid', lang as never) : action === 'approve' ? T('payroll_approved', lang as never) : T('payroll_cancelled', lang as never));
      setSelectedRun(d.run);
      setRuns(p => p.map(r => r.id === runId ? d.run : r));
    } else showToast(d.error ?? 'Action failed');
    setActionLoading(false);
  }

  async function openRun(run: Run) {
    setSelectedRun(run);
    const res = await fetch(`/api/admin/payroll/runs/${run.id}`);
    if (res.ok) { const d = await res.json(); setRunPayslips(d.payslips ?? []); }
  }

  function downloadCSV(runId: string) {
    window.open(`/api/admin/payroll/export?run_id=${runId}`, '_blank');
  }

  const gross = Number(structForm.basic_salary || 0) + Number(structForm.hra || 0) + Number(structForm.da || 0) + Number(structForm.conveyance || 0) + Number(structForm.medical_allowance || 0) + Number(structForm.other_allowance || 0);
  const totalMonthly = structures.reduce((s, st) => s + Number(st.gross_salary || 0), 0);

  const inp = { width: '100%', height: 38, borderRadius: 8, border: '1px solid #D1D5DB', background: '#F9FAFB', fontSize: 13, padding: '0 10px', outline: 'none', fontFamily: 'inherit', color: '#111827', boxSizing: 'border-box' as const };
  const lbl = { display: 'block', fontSize: 11, fontWeight: 600 as const, color: '#9CA3AF', marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: '0.05em' };

  return (
    <Layout title={T('payroll', lang)} subtitle={T('payroll_management', lang)}>
      {toast && <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: '#15803D', color: '#fff', padding: '12px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>✓ {toast}</div>}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}.skel{background:#F3F4F6;border-radius:8px;animation:pulse 1.5s ease-in-out infinite}`}</style>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: T('staff_on_payroll', lang as never), value: structures.length, color: '#4F46E5' },
          { label: T('monthly_payroll', lang as never), value: `₹${(totalMonthly / 1000).toFixed(1)}K`, color: '#065F46' },
          { label: T('total_runs', lang as never), value: runs.length, color: '#0284C7' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: loading ? '#D1D5DB' : k.color }}>{loading ? '—' : k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['runs', 'structures', 'new_structure'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: tab === t ? '#4F46E5' : '#F3F4F6', color: tab === t ? '#fff' : '#374151' }}>
            {t === 'runs' ? T('payroll_management', lang) : t === 'structures' ? T('staff_management', lang) : '+ ' + T('add', lang)}
          </button>
        ))}
      </div>

      {/* RUN DETAIL MODAL */}
      {selectedRun && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: '#111827' }}>{MONTHS[selectedRun.pay_period_month]} {selectedRun.pay_period_year} {T('payroll', lang as never)}</div>
              <button onClick={() => setSelectedRun(null)} style={{ background: '#F3F4F6', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
              {[
                { label: T('basic', lang as never), value: `₹${(selectedRun.total_gross / 1000).toFixed(1)}K`, color: '#4F46E5' },
                { label: T('deductions_section', lang as never), value: `₹${(selectedRun.total_deductions / 1000).toFixed(1)}K`, color: '#B91C1C' },
                { label: T('net_payable', lang as never), value: `₹${(selectedRun.total_net / 1000).toFixed(1)}K`, color: '#065F46' },
              ].map(k => (
                <div key={k.label} style={{ background: '#F9FAFB', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>{k.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {selectedRun.status === 'draft' && (
                <>
                  <button onClick={() => approveRun(selectedRun.id, 'approve')} disabled={actionLoading}
                    style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#D1FAE5', color: '#065F46', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    ✓ Approve
                  </button>
                  <button onClick={() => approveRun(selectedRun.id, 'cancel')} disabled={actionLoading}
                    style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', color: '#6B7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Cancel
                  </button>
                </>
              )}
              {selectedRun.status === 'approved' && (
                <button onClick={() => approveRun(selectedRun.id, 'mark_paid')} disabled={actionLoading}
                  style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#4F46E5', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  💰 Mark as Paid
                </button>
              )}
              <button onClick={() => downloadCSV(selectedRun.id)}
                style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                ⬇ Export CSV
              </button>
              <div style={{ padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, alignSelf: 'center', ...STATUS_STYLE[selectedRun.status] }}>
                {selectedRun.status.toUpperCase()}
              </div>
            </div>
            {runPayslips.length > 0 && (
              <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid #F3F4F6', fontSize: 13, fontWeight: 700, color: '#111827' }}>
                  Payslips ({runPayslips.length} staff)
                </div>
                {runPayslips.map((slip, i) => (
                  <div key={slip.id} style={{ padding: '10px 14px', borderBottom: i < runPayslips.length - 1 ? '1px solid #F9FAFB' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                        ₹{Number(slip.gross_salary).toLocaleString('en-IN')} gross
                      </div>
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                        Basic ₹{Number(slip.basic_salary).toLocaleString('en-IN')} · PF ₹{Number(slip.pf_employee).toLocaleString('en-IN')} · TDS ₹{Number(slip.tds).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#4F46E5' }}>₹{Number(slip.net_salary).toLocaleString('en-IN')} net</div>
                      <a href={`/api/admin/payroll/payslip/${slip.id}`} target="_blank" rel="noreferrer"
                        style={{ fontSize: 11, padding: '3px 8px', background: '#EEF2FF', color: '#4F46E5', borderRadius: 5, textDecoration: 'none', fontWeight: 700 }}>
                        Print
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'runs' && (
        <>
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: '16px 18px', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 12 }}>{T('run_new_payroll', lang as never)}</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div>
                <label style={lbl}>{T('month', lang as never)}</label>
                <select value={newMonth} onChange={e => setNewMonth(Number(e.target.value))} style={{ ...inp, width: 120 }}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{MONTHS[m]}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>{T('year', lang as never)}</label>
                <select value={newYear} onChange={e => setNewYear(Number(e.target.value))} style={{ ...inp, width: 90 }}>
                  {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <button onClick={createRun} disabled={creating || structures.length === 0}
                style={{ height: 38, padding: '0 18px', borderRadius: 8, border: 'none', background: creating || structures.length === 0 ? '#C7D2FE' : '#4F46E5', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {creating ? 'Creating…' : `Run ${MONTHS[newMonth]} ${newYear}`}
              </button>
              {structures.length === 0 && <div style={{ fontSize: 11, color: '#9CA3AF', alignSelf: 'center' }}>{T('add_structures_first', lang as never)}</div>}
            </div>
          </div>

          {loading ? <div className="skel" style={{ height: 100 }} /> :
            runs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', background: '#F9FAFB', borderRadius: 14 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                <div style={{ fontWeight: 700, color: '#374151', marginBottom: 4 }}>{T('no_payroll_runs', lang as never)}</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {runs.map(r => {
                  const s = STATUS_STYLE[r.status] ?? STATUS_STYLE.draft;
                  return (
                    <div key={r.id} onClick={() => openRun(r)}
                      style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, cursor: 'pointer' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{MONTHS[r.pay_period_month]} {r.pay_period_year}</div>
                        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                          {r.total_staff} {T('staff', lang as never)} · ₹{(r.total_gross / 1000).toFixed(1)}K {T('basic', lang as never)} · ₹{(r.total_net / 1000).toFixed(1)}K {T('net_payable', lang as never)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, ...s }}>{T(r.status === 'draft' ? 'status_draft' : r.status === 'approved' ? 'approved' : r.status === 'paid' ? 'paid' : 'payroll_cancelled', lang as never)}</div>
                        <div style={{ fontSize: 12, color: '#6B7280' }}>{T('view_arrow', lang as never)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </>
      )}

      {tab === 'structures' && (
        <>
          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1E40AF' }}>
              💡 Click <strong>+ Add Structure</strong> to set staff pay. One structure per staff member (overwrites previous).
            </div>
          </div>
          {loading ? <div className="skel" style={{ height: 80 }} /> :
            structures.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', background: '#F9FAFB', borderRadius: 14 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>💰</div>
                <div style={{ fontWeight: 700, color: '#374151', marginBottom: 4 }}>{T('no_salary_structures', lang as never)}</div>
              </div>
            ) : (
              <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden' }}>
                {structures.map((s, i) => (
                  <div key={s.id} style={{ padding: '12px 16px', borderBottom: i < structures.length - 1 ? '1px solid #F3F4F6' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{s.staff.name}</div>
                      <div style={{ fontSize: 12, color: '#6B7280' }}>{s.staff.designation} · {s.staff.department}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: '#4F46E5' }}>₹{Number(s.gross_salary).toLocaleString('en-IN')}/mo</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>{T('basic_salary', lang as never)}: ₹{Number(s.basic_salary).toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </>
      )}

      {tab === 'new_structure' && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: '20px 18px' }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#111827', marginBottom: 16 }}>{T('set_salary_structure', lang as never)}</div>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>{T('staff', lang as never)} *</label>
            <select value={structForm.staff_id} onChange={e => setF('staff_id', e.target.value)} style={inp}>
              <option value="">{T('select_staff_member', lang as never)}</option>
              {staffList.map(s => <option key={s.id} value={s.id}>{s.name} — {s.designation}</option>)}
            </select>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10, marginTop: 18 }}>{T('earnings', lang as never)}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 14 }}>
            {[
              { key: 'basic_salary', label: T('basic_salary', lang as never) + ' *' },
              { key: 'hra', label: 'HRA' },
              { key: 'da', label: 'DA' },
              { key: 'conveyance', label: T('conveyance', lang as never) },
              { key: 'medical_allowance', label: T('medical_allowance', lang as never) },
              { key: 'other_allowance', label: T('other_allowance', lang as never) },
            ].map(f => (
              <div key={f.key}>
                <label style={lbl}>{f.label}</label>
                <input type="number" min="0" placeholder="₹0" style={inp}
                  value={structForm[f.key as keyof typeof structForm] as string}
                  onChange={e => setF(f.key as keyof typeof structForm, e.target.value)} />
              </div>
            ))}
          </div>
          {gross > 0 && (
            <div style={{ background: '#EEF2FF', borderRadius: 8, padding: '10px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#4F46E5' }}>{T('gross_monthly', lang as never)}</span>
              <span style={{ fontSize: 15, fontWeight: 900, color: '#4F46E5' }}>₹{gross.toLocaleString('en-IN')}</span>
            </div>
          )}
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10, marginTop: 18 }}>{T('deductions_section', lang as never)}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 14 }}>
            {[
              { key: 'pf_employee_pct', label: T('pf_employee_pct', lang as never) },
              { key: 'pf_employer_pct', label: T('pf_employer_pct', lang as never) },
              { key: 'tds_placeholder', label: T('tds_monthly', lang as never) },
              { key: 'other_deduction', label: T('other_deduction', lang as never) },
            ].map(f => (
              <div key={f.key}>
                <label style={lbl}>{f.label}</label>
                <input type="number" min="0" style={inp}
                  value={structForm[f.key as keyof typeof structForm] as string}
                  onChange={e => setF(f.key as keyof typeof structForm, e.target.value)} />
              </div>
            ))}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, cursor: 'pointer' }}>
            <input type="checkbox" checked={structForm.esi_applicable}
              onChange={e => setF('esi_applicable', e.target.checked)} style={{ width: 16, height: 16 }} />
            <span style={{ fontSize: 13, color: '#374151' }}>{T('esi_applicable', lang as never)} (≤ ₹21,000)</span>
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setTab('structures')}
              style={{ flex: 1, padding: '11px', borderRadius: 9, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={saveStructure} disabled={saving || !structForm.staff_id || !structForm.basic_salary}
              style={{ flex: 2, padding: '11px', borderRadius: 9, border: 'none', background: saving ? '#818CF8' : '#4F46E5', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              {saving ? T('saving_', lang as never) : T('set_salary_structure', lang as never)}
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
