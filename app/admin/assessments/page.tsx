'use client';
// Assessments — schedule formal tests, unit tests, terminal exams
// Institution-aware: shows SSC (Govt) vs CBSE format (Private)
// Links to test_scores table via tests table

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface Assessment {
  id: string; type: string; scheduled_date: string;
  max_marks: number; status: string;
  class_id?: string; subject_id?: string;
  subject?: { name: string }; class?: { grade_level: string; section: string };
}

const ASSESSMENT_TYPES = [
  'unit_test','monthly_test','midterm','quarterly','half_yearly','annual',
  'fa1','fa2','fa3','fa4','sa1','sa2','slip_test','class_test'
];

export default function AssessmentsPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ type: 'unit_test', scheduled_date: '', max_marks: '100', weightage: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/assessments');
      if (r.ok) { const d = await r.json() as { assessments?: Assessment[] }; setAssessments(d.assessments ?? []); }
    } catch {/**/}
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function add() {
    if (!form.scheduled_date || !form.type) { alert('Date and type required'); return; }
    setAdding(true);
    const r = await fetch('/api/admin/assessments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, max_marks: Number(form.max_marks), weightage: form.weightage ? Number(form.weightage) : null }),
    });
    setAdding(false);
    if (r.ok) { setShowAdd(false); setForm({ type: 'unit_test', scheduled_date: '', max_marks: '100', weightage: '' }); void load(); }
  }

  const STATUS_COLOR: Record<string,string> = { scheduled: '#D97706', ongoing: '#4F46E5', completed: '#15803D', cancelled: '#9CA3AF' };
  const inp = { height: 44, borderRadius: 9, border: '1px solid #D1D5DB', padding: '0 12px', fontSize: 14, fontFamily: 'inherit', background: '#F9FAFB', width: '100%', boxSizing: 'border-box' as const };

  return (
    <Layout title="Assessments" subtitle={`${assessments.length} assessments`}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button onClick={() => setShowAdd(v => !v)}
          style={{ padding: '8px 16px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          {showAdd ? 'Cancel' : '+ Schedule Assessment'}
        </button>
      </div>

      {showAdd && (
        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Assessment Type</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} style={inp}>
                {ASSESSMENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ').toUpperCase()}</option>)}
              </select>
            </div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Date</label>
              <input type="date" value={form.scheduled_date} onChange={e => setForm(p => ({ ...p, scheduled_date: e.target.value }))} style={inp} />
            </div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Max Marks</label>
              <input type="number" inputMode="numeric" value={form.max_marks} onChange={e => setForm(p => ({ ...p, max_marks: e.target.value }))} style={inp} />
            </div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Weightage %</label>
              <input type="number" inputMode="numeric" value={form.weightage} onChange={e => setForm(p => ({ ...p, weightage: e.target.value }))} placeholder="Optional" style={inp} />
            </div>
          </div>
          <button onClick={() => void add()} disabled={adding}
            style={{ width: '100%', height: 46, marginTop: 12, borderRadius: 10, border: 'none', background: adding ? '#9CA3AF' : '#4F46E5', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {adding ? 'Saving…' : '📅 Schedule Assessment'}
          </button>
        </div>
      )}

      {loading ? <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div> : assessments.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', background: '#F9FAFB', borderRadius: 12, color: '#9CA3AF' }}>
          No assessments scheduled yet. Click "+ Schedule Assessment" to begin.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {assessments.map(a => (
            <div key={a.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{a.type.replace(/_/g,' ').toUpperCase()}</div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                    {a.scheduled_date} · Max marks: {a.max_marks}
                  </div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 8, background: '#F9FAFB', color: STATUS_COLOR[a.status] ?? '#374151' }}>
                  {a.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
