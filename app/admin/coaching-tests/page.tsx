'use client';
// K3: Coaching centre weekly test + rank module
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

interface Test { id: string; title: string; test_date: string; max_marks: number; subject: string | null; }
interface Score { student_id: string; marks_obtained: number; rank: number | null; students: { name: string; class: string; section: string } | null; }

const inputStyle = { width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const };
const labelStyle = { fontSize: 11, fontWeight: 700 as const, color: '#6B7280', letterSpacing: '0.05em', marginBottom: 3, display: 'block' as const };

export default function CoachingTestsPage() {
  const [tests, setTests] = useState<Test[]>([]);
  const [selected, setSelected] = useState<Test | null>(null);
  const [scores, setScores] = useState<Score[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', test_date: '', max_marks: '100', subject: '' });
  const [saving, setSaving] = useState(false);
  const [scoreInputs, setScoreInputs] = useState<Record<string, string>>({});

  useEffect(() => { loadTests(); }, []);

  async function loadTests() {
    const r = await fetch('/api/admin/tests');
    if (r.ok) { const d = await r.json() as { tests: Test[] }; setTests(d.tests ?? []); }
  }

  async function loadScores(testId: string) {
    const r = await fetch(`/api/admin/tests/${testId}/scores`);
    if (r.ok) { const d = await r.json() as { scores: Score[] }; setScores(d.scores ?? []); }
  }

  async function createTest() {
    setSaving(true);
    const r = await fetch('/api/admin/tests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, max_marks: parseFloat(form.max_marks) || 100 }) });
    setSaving(false);
    if (r.ok) { setShowCreate(false); setForm({ title: '', test_date: '', max_marks: '100', subject: '' }); loadTests(); }
  }

  async function saveScores() {
    if (!selected) return;
    setSaving(true);
    const scoreArr = Object.entries(scoreInputs).filter(([,v]) => v.trim()).map(([student_id, marks]) => ({ student_id, marks_obtained: parseFloat(marks) }));
    await fetch(`/api/admin/tests/${selected.id}/scores`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scores: scoreArr }) });
    setSaving(false);
    loadScores(selected.id);
  }

  return (
    <Layout title='Tests & Ranks' subtitle='Weekly tests and student rankings'>
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Left: test list */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>Tests</span>
            <button onClick={() => setShowCreate(v => !v)} style={{ padding: '5px 12px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+ New</button>
          </div>
          {showCreate && (
            <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div style={{ marginBottom: 8 }}><label style={labelStyle}>TITLE *</label><input style={inputStyle} value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} placeholder='e.g. JEE Mock 1' /></div>
              <div style={{ marginBottom: 8 }}><label style={labelStyle}>DATE *</label><input type='date' style={inputStyle} value={form.test_date} onChange={e => setForm(p => ({...p, test_date: e.target.value}))} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <div><label style={labelStyle}>MAX MARKS</label><input type='number' style={inputStyle} value={form.max_marks} onChange={e => setForm(p => ({...p, max_marks: e.target.value}))} /></div>
                <div><label style={labelStyle}>SUBJECT</label><input style={inputStyle} value={form.subject} onChange={e => setForm(p => ({...p, subject: e.target.value}))} placeholder='Maths' /></div>
              </div>
              <button onClick={createTest} disabled={saving} style={{ width: '100%', padding: '8px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{saving ? 'Saving...' : 'Create Test'}</button>
            </div>
          )}
          {tests.map(t => (
            <div key={t.id} onClick={() => { setSelected(t); loadScores(t.id); }}
              style={{ padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 6, background: selected?.id === t.id ? '#EEF2FF' : '#F9FAFB', border: `1px solid ${selected?.id === t.id ? '#A5B4FC' : '#E5E7EB'}` }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{t.title}</div>
              <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{t.test_date} · {t.subject ?? 'General'} · {t.max_marks} marks</div>
            </div>
          ))}
          {tests.length === 0 && <div style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', padding: 20 }}>No tests yet. Create one.</div>}
        </div>

        {/* Right: scores */}
        {selected && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{selected.title}</div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>{selected.test_date} · Max: {selected.max_marks}</div>
              </div>
              <button onClick={saveScores} disabled={saving} style={{ padding: '8px 18px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{saving ? 'Saving...' : 'Save & Rank'}</button>
            </div>
            {scores.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: '#F9FAFB' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '1px solid #E5E7EB' }}>Rank</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '1px solid #E5E7EB' }}>Student</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#374151', borderBottom: '1px solid #E5E7EB' }}>Marks</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#374151', borderBottom: '1px solid #E5E7EB' }}>Enter Score</th>
                </tr></thead>
                <tbody>{scores.map(s => (
                  <tr key={s.student_id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 700, color: s.rank === 1 ? '#B45309' : '#374151' }}>{s.rank ?? '—'}</td>
                    <td style={{ padding: '8px 12px' }}>{s.students?.name ?? s.student_id}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{s.marks_obtained}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <input type='number' style={{ ...inputStyle, width: 80, textAlign: 'right' }}
                        value={scoreInputs[s.student_id] ?? ''}
                        onChange={e => setScoreInputs(p => ({...p, [s.student_id]: e.target.value}))}
                        placeholder={String(s.marks_obtained)} />
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            ) : (
              <div style={{ color: '#6B7280', fontSize: 13, padding: 24, textAlign: 'center', background: '#F9FAFB', borderRadius: 8 }}>No scores yet. Enter student IDs and marks above, then click Save & Rank.</div>
            )}
          </div>
        )}
        {!selected && tests.length > 0 && (
          <div style={{ color: '#9CA3AF', fontSize: 14, padding: 40, textAlign: 'center' }}>Select a test to view and enter scores.</div>
        )}
      </div>
    </Layout>
  );
}
