'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

interface AY { id: string; label: string; start_date: string; end_date: string; is_current: boolean; status: string; promoted_at: string | null; }

export default function AcademicYearsPage() {
  const [years, setYears] = useState<AY[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ label: '', start_date: '', end_date: '', set_as_current: false });
  const [saving, setSaving] = useState(false);
  const [promoting, setPromoting] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  async function load() {
    setLoading(true);
    const d = await fetch('/api/admin/academic-years').then(r => r.json());
    setYears(d.academic_years ?? []);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function save() {
    setSaving(true); setMsg('');
    const res = await fetch('/api/admin/academic-years', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const d = await res.json();
    setSaving(false);
    if (res.ok) { setMsg('Academic year created'); setShowForm(false); setForm({ label: '', start_date: '', end_date: '', set_as_current: false }); void load(); }
    else setMsg(d.error ?? 'Error');
  }

  async function setCurrent(id: string) {
    await fetch('/api/admin/academic-years', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'set_current' }) });
    void load();
  }

  async function closeYear(id: string) {
    if (!confirm('Close this academic year? This marks it as completed.')) return;
    await fetch('/api/admin/academic-years', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'close' }) });
    void load();
  }

  async function promoteStudents(id: string) {
    if (!confirm('Promote all active students to next class? Class 12 students will be marked as graduated. This cannot be undone.')) return;
    setPromoting(id);
    const res = await fetch('/api/admin/academic-years', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'promote' }) });
    const d = await res.json();
    setPromoting(null);
    if (res.ok) setMsg(`Promotion complete: ${d.promoted} promoted, ${d.graduated} graduated`);
    else setMsg(d.error ?? 'Error');
    void load();
  }

  const statusBadge = (status: string, isCurrent: boolean) => {
    if (isCurrent) return { bg: '#D1FAE5', color: '#065F46', label: 'Current' };
    if (status === 'completed') return { bg: '#F3F4F6', color: '#4B5563', label: 'Completed' };
    return { bg: '#FEF3C7', color: '#92400E', label: 'Draft' };
  };

  const S = { card: { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, marginBottom: 10 } as React.CSSProperties };

  return (
    <Layout title="Academic Years" subtitle="Manage academic year lifecycle and student promotions">
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px 40px' }}>
        {msg && <div style={{ background: msg.includes('rror') ? '#FEE2E2' : '#D1FAE5', color: msg.includes('rror') ? '#991B1B' : '#065F46', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>{msg}</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: '#6B7280' }}>{years.length} year{years.length !== 1 ? 's' : ''}</div>
          <button onClick={() => setShowForm(true)} style={{ padding: '8px 16px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            + New Year
          </button>
        </div>

        {showForm && (
          <div style={{ ...S.card, border: '2px solid #4F46E5', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>New Academic Year</div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>LABEL *</label>
              <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. 2025-26" style={{ width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 14, boxSizing: 'border-box' as const }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              {(['start_date', 'end_date'] as const).map(k => (
                <div key={k}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>{k === 'start_date' ? 'START DATE' : 'END DATE'} *</label>
                  <input type="date" value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 14 }} />
                </div>
              ))}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={form.set_as_current} onChange={e => setForm(f => ({ ...f, set_as_current: e.target.checked }))} />
              Set as current academic year
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={save} disabled={saving || !form.label || !form.start_date || !form.end_date}
                style={{ flex: 1, padding: '9px', background: saving ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Creating...' : 'Create Year'}
              </button>
              <button onClick={() => setShowForm(false)} style={{ padding: '9px 16px', background: '#F3F4F6', border: 'none', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}

        {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading...</div> :
          years.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#9CA3AF' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
              <div>No academic years yet. Create your first year to begin.</div>
            </div>
          ) : years.map(y => {
            const badge = statusBadge(y.status, y.is_current);
            return (
              <div key={y.id} style={S.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{y.label}</span>
                      <span style={{ background: badge.bg, color: badge.color, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{badge.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>{y.start_date} → {y.end_date}</div>
                    {y.promoted_at && <div style={{ fontSize: 11, color: '#065F46', marginTop: 4 }}>✓ Students promoted on {y.promoted_at.split('T')[0]}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {!y.is_current && y.status !== 'completed' && (
                      <button onClick={() => void setCurrent(y.id)} style={{ padding: '5px 10px', background: '#EEF2FF', color: '#4F46E5', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Set Current</button>
                    )}
                    {y.is_current && !y.promoted_at && (
                      <button onClick={() => void promoteStudents(y.id)} disabled={promoting === y.id}
                        style={{ padding: '5px 10px', background: '#D1FAE5', color: '#065F46', border: 'none', borderRadius: 6, fontSize: 12, cursor: promoting === y.id ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                        {promoting === y.id ? 'Promoting...' : '↑ Promote Students'}
                      </button>
                    )}
                    {y.status !== 'completed' && (
                      <button onClick={() => void closeYear(y.id)} style={{ padding: '5px 10px', background: '#F3F4F6', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Close Year</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </Layout>
  );
}
