'use client';
import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface AcademicYear { id: string; label: string; start_date: string; end_date: string; is_current: boolean; status: string; promoted_at: string | null; }

export default function AcademicYearsPage() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ label: '', start_date: '', end_date: '', set_as_current: true });
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/admin/academic-years');
    const d = await r.json();
    setYears(d.academic_years ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addYear() {
    if (!form.label || !form.start_date || !form.end_date) { setFormError('Label, start date, and end date required'); return; }
    const r = await fetch('/api/admin/academic-years', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const d = await r.json();
    if (!r.ok) { setFormError(d.error ?? 'Failed'); return; }
    setToast('Academic year created'); setTimeout(() => setToast(''), 3000);
    setShowAdd(false); setForm({ label: '', start_date: '', end_date: '', set_as_current: true }); load();
  }

  async function doAction(id: string, action: string, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setActionLoading(`${id}-${action}`);
    const r = await fetch('/api/admin/academic-years', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }) });
    const d = await r.json(); setActionLoading(null);
    if (!r.ok) { setToast(d.error ?? 'Action failed'); setTimeout(() => setToast(''), 4000); return; }
    if (action === 'promote') {
      setToast(`Promoted ${d.promoted} students. ${d.graduated} graduated.`);
    } else { setToast('Done'); }
    setTimeout(() => setToast(''), 4000);
    load();
  }

  const statusBadge: Record<string, [string, string]> = {
    active: ['#D1FAE5', '#065F46'],
    completed: ['#F3F4F6', '#6B7280'],
    draft: ['#FEF9C3', '#92400E'],
  };

  return (
    <Layout title="Academic Years" subtitle="Manage academic calendar and student promotion">
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: '#111827', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>{toast}</div>}

      <div style={{ background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#92400E' }}>
        ⚠️ <strong>Promote Students</strong> moves all active students up one class. Class 12 students are marked as graduated. Verify student records before running promotion.
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => setShowAdd(v => !v)} style={{ padding: '8px 16px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {showAdd ? 'Cancel' : '+ New Year'}
        </button>
      </div>

      {showAdd && (
        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>New Academic Year</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
            <div><label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>Label * (e.g. 2025-26)</label>
              <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} style={{ width: '100%', height: 36, border: '1px solid #D1D5DB', borderRadius: 7, padding: '0 10px', fontSize: 13, boxSizing: 'border-box' }} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>Start Date *</label>
              <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} style={{ width: '100%', height: 36, border: '1px solid #D1D5DB', borderRadius: 7, padding: '0 10px', fontSize: 13, boxSizing: 'border-box' }} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>End Date *</label>
              <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} style={{ width: '100%', height: 36, border: '1px solid #D1D5DB', borderRadius: 7, padding: '0 10px', fontSize: 13, boxSizing: 'border-box' }} /></div>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.set_as_current} onChange={e => setForm(f => ({ ...f, set_as_current: e.target.checked }))} />
                Set as current year
              </label>
            </div>
          </div>
          {formError && <div style={{ color: '#991B1B', fontSize: 12, marginTop: 8 }}>{formError}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={addYear} style={{ padding: '8px 14px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Create Year</button>
            <button onClick={() => setShowAdd(false)} style={{ padding: '8px 14px', background: '#fff', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>Loading...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {years.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>No academic years set up yet.</div>}
          {years.map(y => {
            const [bgColor, textColor] = statusBadge[y.status] ?? ['#F3F4F6', '#6B7280'];
            const isBusy = (k: string) => actionLoading === `${y.id}-${k}`;
            return (
              <div key={y.id} style={{ background: '#fff', border: `2px solid ${y.is_current ? '#4F46E5' : '#E5E7EB'}`, borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>{y.label}</span>
                    {y.is_current && <span style={{ fontSize: 11, fontWeight: 700, background: '#4F46E5', color: '#fff', padding: '2px 8px', borderRadius: 10 }}>CURRENT</span>}
                    <span style={{ fontSize: 11, fontWeight: 700, background: bgColor, color: textColor, padding: '2px 8px', borderRadius: 10 }}>{y.status.toUpperCase()}</span>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>{y.start_date} → {y.end_date}{y.promoted_at ? ` · Promoted: ${y.promoted_at.split('T')[0]}` : ''}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {!y.is_current && y.status !== 'completed' && (
                    <button onClick={() => doAction(y.id, 'set_current')} disabled={!!actionLoading} style={{ padding: '6px 12px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      Set Current
                    </button>
                  )}
                  {y.status === 'active' && !y.promoted_at && (
                    <button onClick={() => doAction(y.id, 'promote', 'Run student promotion? This will move all students up one class. Class 12 → graduated. Cannot be undone.')}
                      disabled={isBusy('promote')} style={{ padding: '6px 12px', background: '#065F46', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {isBusy('promote') ? 'Promoting...' : 'Promote Students'}
                    </button>
                  )}
                  {y.status === 'active' && (
                    <button onClick={() => doAction(y.id, 'close', 'Close this academic year?')}
                      disabled={isBusy('close')} style={{ padding: '6px 12px', background: '#fff', border: '1px solid #D1D5DB', color: '#374151', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>
                      {isBusy('close') ? 'Closing...' : 'Close Year'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
