'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

interface Structure {
  id: string; staff_id: string; gross_salary: number;
  basic_salary: number; hra: number; da: number;
  pf_employee_pct: number; tds_placeholder: number;
  staff: { id: string; name: string; designation: string; department: string };
}
interface Run {
  id: string; pay_period_month: number; pay_period_year: number;
  status: string; total_staff: number; total_gross: number;
  total_deductions: number; total_net: number; created_at: string;
}

const MONTH_NAMES = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  draft: { bg: '#FEF9C3', color: '#92400E' },
  approved: { bg: '#D1FAE5', color: '#065F46' },
  paid: { bg: '#DBEAFE', color: '#1D4ED8' },
  cancelled: { bg: '#F3F4F6', color: '#374151' },
};

export default function PayrollPage() {
  const [tab, setTab] = useState<'runs' | 'structures'>('runs');
  const [structures, setStructures] = useState<Structure[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState('');

  const now = new Date();
  const [newMonth, setNewMonth] = useState(now.getMonth() + 1);
  const [newYear, setNewYear] = useState(now.getFullYear());

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/payroll/runs').then(r => r.ok ? r.json() : { runs: [] }),
      fetch('/api/admin/payroll/structures').then(r => r.ok ? r.json() : { structures: [] }),
    ]).then(([runsData, structData]) => {
      setRuns(runsData.runs ?? []);
      setStructures(structData.structures ?? []);
      setLoading(false);
    });
  }, []);

  async function createRun() {
    setCreating(true);
    const res = await fetch('/api/admin/payroll/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pay_period_month: newMonth, pay_period_year: newYear }),
    });
    const d = await res.json();
    if (res.ok) {
      setRuns(prev => [d.run, ...prev]);
      showToast(`Payroll run created for ${MONTH_NAMES[newMonth]} ${newYear}`);
    } else {
      showToast(d.error ?? 'Failed to create payroll run');
    }
    setCreating(false);
  }

  const totalMonthlyPayroll = structures.reduce((s, st) => s + Number(st.gross_salary || 0), 0);

  return (
    <Layout title="Payroll" subtitle="Staff salary management">
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: '#15803D', color: '#fff', padding: '12px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          ✓ {toast}
        </div>
      )}

      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        .skel{background:#F3F4F6;border-radius:8px;animation:pulse 1.5s ease-in-out infinite}
        .tab{padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;border:none;cursor:pointer}
      `}</style>

      {/* Summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Staff on Payroll', value: structures.length, color: '#4F46E5' },
          { label: 'Monthly Payroll', value: `₹${(totalMonthlyPayroll / 1000).toFixed(1)}K`, color: '#065F46' },
          { label: 'Total Runs', value: runs.length, color: '#0284C7' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: k.color }}>{loading ? '—' : k.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button className="tab" onClick={() => setTab('runs')}
          style={{ background: tab === 'runs' ? '#4F46E5' : '#F3F4F6', color: tab === 'runs' ? '#fff' : '#374151' }}>
          Payroll Runs
        </button>
        <button className="tab" onClick={() => setTab('structures')}
          style={{ background: tab === 'structures' ? '#4F46E5' : '#F3F4F6', color: tab === 'structures' ? '#fff' : '#374151' }}>
          Salary Structures
        </button>
      </div>

      {tab === 'runs' && (
        <>
          {/* New run */}
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: '16px 18px', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 12 }}>Run New Payroll</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 4 }}>MONTH</label>
                <select value={newMonth} onChange={e => setNewMonth(Number(e.target.value))}
                  style={{ height: 38, borderRadius: 8, border: '1px solid #D1D5DB', padding: '0 10px', fontSize: 13, background: '#F9FAFB', outline: 'none' }}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>{MONTH_NAMES[m]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 4 }}>YEAR</label>
                <select value={newYear} onChange={e => setNewYear(Number(e.target.value))}
                  style={{ height: 38, borderRadius: 8, border: '1px solid #D1D5DB', padding: '0 10px', fontSize: 13, background: '#F9FAFB', outline: 'none' }}>
                  {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <button onClick={createRun} disabled={creating || structures.length === 0}
                style={{ height: 38, padding: '0 18px', borderRadius: 8, border: 'none', background: creating || structures.length === 0 ? '#C7D2FE' : '#4F46E5', color: '#fff', fontSize: 13, fontWeight: 700, cursor: creating || structures.length === 0 ? 'not-allowed' : 'pointer' }}>
                {creating ? 'Creating…' : `Run Payroll for ${MONTH_NAMES[newMonth]} ${newYear}`}
              </button>
              {structures.length === 0 && (
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>Add salary structures first</div>
              )}
            </div>
          </div>

          {/* Runs list */}
          {loading ? (
            <div className="skel" style={{ height: 120 }} />
          ) : runs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', background: '#F9FAFB', borderRadius: 14 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
              <div style={{ fontWeight: 700, color: '#374151', marginBottom: 4 }}>No payroll runs yet</div>
              <div style={{ fontSize: 13, color: '#9CA3AF' }}>Run your first payroll above.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {runs.map(r => {
                const s = STATUS_STYLE[r.status] ?? STATUS_STYLE.draft;
                return (
                  <div key={r.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{MONTH_NAMES[r.pay_period_month]} {r.pay_period_year}</div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{r.total_staff} staff · ₹{(r.total_gross / 1000).toFixed(1)}K gross · ₹{(r.total_net / 1000).toFixed(1)}K net</div>
                    </div>
                    <div style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color }}>
                      {r.status.toUpperCase()}
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
              💡 Salary structures define monthly pay for each staff member. Set these before running payroll.
            </div>
          </div>
          {loading ? (
            <div className="skel" style={{ height: 120 }} />
          ) : structures.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', background: '#F9FAFB', borderRadius: 14 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>💰</div>
              <div style={{ fontWeight: 700, color: '#374151', marginBottom: 4 }}>No salary structures yet</div>
              <div style={{ fontSize: 13, color: '#9CA3AF' }}>Salary structure management coming soon. Use the API to add structures.</div>
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
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>Basic: ₹{Number(s.basic_salary).toLocaleString('en-IN')}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
