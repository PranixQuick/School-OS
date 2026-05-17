'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

interface AcadYear { id: string; label: string; start_date: string; end_date: string; is_current: boolean; status: string; promoted_at: string | null; }

export default function AcademicYearsPage() {
  const [years, setYears] = useState<AcadYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ label: '', start_date: '', end_date: '', set_as_current: false });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [promoteId, setPromoteId] = useState<string | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [promoteResult, setPromoteResult] = useState<{ promoted: number; graduated: number } | null>(null);

  async function load() {
    setLoading(true);
    const d = await fetch('/api/admin/academic-years').then(r => r.json());
    setYears(d.academic_years ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function create() {
    setSaving(true); setMsg('');
    const res = await fetch('/api/admin/academic-years', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const d = await res.json();
    if (res.ok) { setMsg('Created'); setForm({ label: '', start_date: '', end_date: '', set_as_current: false }); void load(); }
    else setMsg(d.error ?? 'Error');
    setSaving(false);
  }

  async function doAction(id: string, action: string) {
    await fetch('/api/admin/academic-years', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }) });
    void load();
  }

  async function promote(id: string) {
    setPromoting(true); setPromoteResult(null);
    const res = await fetch('/api/admin/academic-years', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'promote' }) });
    const d = await res.json();
    if (res.ok) setPromoteResult({ promoted: d.promoted, graduated: d.graduated });
    setPromoting(false);
    setPromoteId(null);
    void load();
  }

  const inputStyle = { padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 14, fontFamily: 'inherit' };

  return (
    <Layout title="Academic Years" subtitle="Manage academic year lifecycle and student promotion">
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 0 40px' }}>

        {/* Promote result banner */}
        {promoteResult && (
          <div style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 10, padding: '12px 18px', marginBottom: 20, display: 'flex', gap: 16 }}>
            <div style={{ fontSize: 13, color: '#065F46', fontWeight: 600 }}>Promotion complete:</div>
            <div style={{ fontSize: 13, color: '#065F46' }}>{promoteResult.promoted} students promoted · {promoteResult.graduated} graduated (Class 12)</div>
            <button onClick={() => setPromoteResult(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#065F46', fontSize: 16 }}>×</button>
          </div>
        )}

        {/* Create form */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Create Academic Year</div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <input placeholder="Label (e.g. 2026-27)" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' as const }} />
            <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' as const }} />
            <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' as const }} />
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
            <label style={{ fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.set_as_current} onChange={e => setForm(f => ({ ...f, set_as_current: e.target.checked }))} />
              Set as current year
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={create} disabled={saving || !form.label || !form.start_date || !form.end_date} style={{ padding: '8px 20px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {saving ? 'Creating...' : 'Create Year'}
            </button>
            {msg && <span style={{ fontSize: 13, color: msg === 'Created' ? '#065F46' : '#991B1B' }}>{msg}</span>}
          </div>
        </div>

        {/* Year list */}
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Loading...</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {years.map(y => (
              <div key={y.id} style={{ background: '#fff', border: `1px solid ${y.is_current ? '#818CF8' : '#E5E7EB'}`, borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{y.label}</div>
                  {y.is_current && <span style={{ fontSize: 10, fontWeight: 700, background: '#EEF2FF', color: '#4F46E5', padding: '2px 8px', borderRadius: 10 }}>CURRENT</span>}
                  <span style={{ fontSize: 10, fontWeight: 600, background: y.status === 'completed' ? '#F3F4F6' : '#D1FAE5', color: y.status === 'completed' ? '#6B7280' : '#065F46', padding: '2px 8px', borderRadius: 10 }}>
                    {y.status?.toUpperCase()}
                  </span>
                  {y.promoted_at && <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 'auto' }}>Promoted {new Date(y.promoted_at).toLocaleDateString('en-IN')}</span>}
                </div>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
                  {new Date(y.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} — {new Date(y.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {!y.is_current && y.status !== 'completed' && (
                    <button onClick={() => doAction(y.id, 'set_current')} style={{ padding: '5px 12px', background: '#EEF2FF', color: '#4F46E5', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Set Current</button>
                  )}
                  {y.status !== 'completed' && (
                    <button onClick={() => setPromoteId(y.id)} style={{ padding: '5px 12px', background: '#FEF3C7', color: '#92400E', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Promote Students</button>
                  )}
                  {y.status !== 'completed' && (
                    <button onClick={() => { if (confirm('Close this year? This marks it as completed.')) doAction(y.id, 'close'); }} style={{ padding: '5px 12px', background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Close Year</button>
                  )}
                </div>

                {/* Promotion confirm panel */}
                {promoteId === y.id && (
                  <div style={{ marginTop: 12, background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#92400E', marginBottom: 6 }}>Confirm student promotion</div>
                    <div style={{ fontSize: 12, color: '#78350F', marginBottom: 10 }}>
                      This will move all active students up one class. Class 12 students will be graduated. This action cannot be undone.
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => promote(y.id)} disabled={promoting} style={{ padding: '6px 16px', background: '#D97706', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        {promoting ? 'Promoting...' : 'Confirm Promote'}
                      </button>
                      <button onClick={() => setPromoteId(null)} style={{ padding: '6px 12px', background: '#fff', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
