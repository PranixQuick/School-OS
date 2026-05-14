'use client';
// PATH: app/teacher/marks/page.tsx
// Batch 6 — Teacher marks entry UI.
// Select grade_level + section + subject + term → load roster → enter marks → save.
// Uses academic_records via /api/teacher/marks.

import { useState, useEffect, useCallback } from 'react';

const TERMS = [
  { value: 'term_1', label: 'Term 1' },
  { value: 'term_2', label: 'Term 2' },
  { value: 'term_3', label: 'Term 3' },
  { value: 'annual', label: 'Annual' },
];
const GRADE_LEVELS = ['Nursery','LKG','UKG','1','2','3','4','5','6','7','8','9','10','11','12'];
const SECTIONS = ['A','B','C','D','E'];

interface StudentRow {
  student_id: string;
  student_name: string;
  roll_number: string | null;
  marks_obtained: string;
  max_marks: string;
  grade: string;
  saving: boolean;
  saved: boolean;
  error: string | null;
}

function calcGrade(obt: number, max: number): string {
  if (!max) return '';
  const p = (obt / max) * 100;
  if (p >= 90) return 'A+';
  if (p >= 80) return 'A';
  if (p >= 70) return 'B+';
  if (p >= 60) return 'B';
  if (p >= 50) return 'C';
  if (p >= 40) return 'D';
  return 'F';
}

export default function TeacherMarksPage() {
  const [gradeLevel, setGradeLevel] = useState('5');
  const [section, setSection] = useState('A');
  const [subject, setSubject] = useState('');
  const [term, setTerm] = useState('term_1');
  const [subjects, setSubjects] = useState<{ name: string }[]>([]);
  const [roster, setRoster] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  // Batch 13: narrative generation state
  const [narrativeStates, setNarrativeStates] = useState<Record<string,{loading:boolean;text:string;error:string}>>({});
  const [narrativeNotes, setNarrativeNotes] = useState<Record<string,string>>({});

  // Fetch subjects on mount
  useEffect(() => {
    void fetch('/api/admin/subjects').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.subjects) setSubjects(d.subjects);
    }).catch(() => {});
  }, []);

  const loadRoster = useCallback(async () => {
    if (!subject || !term) return;
    setLoading(true); setRoster([]);
    try {
      const r = await fetch(`/api/teacher/marks?grade_level=${encodeURIComponent(gradeLevel)}&section=${encodeURIComponent(section)}&subject=${encodeURIComponent(subject)}&term=${term}`);
      if (!r.ok) { setLoading(false); return; }
      const d = await r.json();
      const rows: StudentRow[] = (d.roster ?? []).map((s: {
        student_id: string; student_name: string; roll_number: string | null;
        marks: { marks_obtained: number; max_marks: number; grade: string } | null
      }) => ({
        student_id: s.student_id,
        student_name: s.student_name,
        roll_number: s.roll_number,
        marks_obtained: s.marks?.marks_obtained != null ? String(s.marks.marks_obtained) : '',
        max_marks: s.marks?.max_marks != null ? String(s.marks.max_marks) : '100',
        grade: s.marks?.grade ?? '',
        saving: false, saved: !!s.marks, error: null,
      }));
      setRoster(rows);
    } catch { /* ignore */ }
    setLoading(false);
  }, [gradeLevel, section, subject, term]);

  useEffect(() => { if (subject) void loadRoster(); }, [gradeLevel, section, subject, term, loadRoster]);

  function updateRow(idx: number, field: 'marks_obtained' | 'max_marks', val: string) {
    setRoster(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const updated = { ...r, [field]: val, saved: false };
      const obt = parseFloat(field === 'marks_obtained' ? val : r.marks_obtained);
      const max = parseFloat(field === 'max_marks' ? val : r.max_marks);
      updated.grade = !isNaN(obt) && !isNaN(max) && max > 0 ? calcGrade(obt, max) : '';
      return updated;
    }));
  }

  // Batch 13: generate narrative for a student
  async function generateNarrative(studentId: string, studentName: string) {
    const key = studentId;
    setNarrativeStates(prev => ({ ...prev, [key]: { loading: true, text: '', error: '' } }));
    try {
      const res = await fetch('/api/teacher/report-narratives/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, term: selectedTerm, teacher_notes: narrativeNotes[studentId] ?? '' }),
      });
      const d = await res.json() as { narrative_text?: string; error?: string; message?: string };
      if (res.ok && d.narrative_text) {
        setNarrativeStates(prev => ({ ...prev, [key]: { loading: false, text: d.narrative_text!, error: '' } }));
      } else if (res.status === 409) {
        setNarrativeStates(prev => ({ ...prev, [key]: { loading: false, text: '', error: 'Already approved — contact principal to reset' } }));
      } else {
        setNarrativeStates(prev => ({ ...prev, [key]: { loading: false, text: '', error: d.error ?? 'Generation failed' } }));
      }
    } catch {
      setNarrativeStates(prev => ({ ...prev, [key]: { loading: false, text: '', error: 'Network error' } }));
    }
  }

  async function saveAll() {
    setSaving(true); setSaveStatus(null);
    let saved = 0, failed = 0;
    for (let i = 0; i < roster.length; i++) {
      const row = roster[i];
      const obt = parseFloat(row.marks_obtained);
      const max = parseFloat(row.max_marks);
      if (isNaN(obt) || isNaN(max)) continue;
      setRoster(prev => prev.map((r, idx) => idx === i ? { ...r, saving: true, error: null } : r));
      try {
        const res = await fetch('/api/teacher/marks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ student_id: row.student_id, subject, term, marks_obtained: obt, max_marks: max }),
        });
        const data = await res.json();
        if (res.ok) {
          saved++;
          setRoster(prev => prev.map((r, idx) => idx === i ? { ...r, saving: false, saved: true, error: null } : r));
        } else {
          failed++;
          setRoster(prev => prev.map((r, idx) => idx === i ? { ...r, saving: false, error: data.error ?? 'Failed' } : r));
        }
      } catch {
        failed++;
        setRoster(prev => prev.map((r, idx) => idx === i ? { ...r, saving: false, error: 'Network error' } : r));
      }
    }
    setSaveStatus(`Saved ${saved}${failed > 0 ? `, ${failed} failed` : ''} records.`);
    setSaving(false);
  }

  const gradeColor: Record<string, string> = { 'A+': '#065F46', 'A': '#065F46', 'B+': '#1D4ED8', 'B': '#1D4ED8', 'C': '#92400E', 'D': '#B45309', 'F': '#991B1B' };

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Marks Entry</h1>
        <p style={{ fontSize: 12, color: '#6B7280' }}>Enter marks for a class. Grades are calculated automatically.</p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        {[
          { label: 'Grade', value: gradeLevel, setter: setGradeLevel, options: GRADE_LEVELS.map(g => ({ value: g, label: `Grade ${g}` })) },
          { label: 'Section', value: section, setter: setSection, options: SECTIONS.map(s => ({ value: s, label: s })) },
          { label: 'Term', value: term, setter: setTerm, options: TERMS },
        ].map(({ label, value, setter, options }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#6B7280' }}>{label.toUpperCase()}</label>
            <select value={value} onChange={e => setter(e.target.value)}
              style={{ padding: '6px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12 }}>
              {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        ))}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: '#6B7280' }}>SUBJECT</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {subjects.length > 0 ? (
              <select value={subject} onChange={e => setSubject(e.target.value)}
                style={{ padding: '6px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, minWidth: 140 }}>
                <option value=''>Select subject...</option>
                {subjects.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
            ) : (
              <input value={subject} onChange={e => setSubject(e.target.value)}
                placeholder='e.g. Mathematics'
                style={{ padding: '6px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, width: 160 }} />
            )}
          </div>
        </div>
      </div>

      {/* Roster table */}
      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>Loading students...</div>
      ) : roster.length === 0 && subject ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>No students found for this class.</div>
      ) : roster.length > 0 ? (
        <>
          <div style={{ overflowX: 'auto', border: '1px solid #E5E7EB', borderRadius: 8, marginBottom: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  {['#','Student Name','Roll No','Max Marks','Marks Obtained','Grade','Status'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, fontSize: 10, color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roster.map((row, i) => (
                  <tr key={row.student_id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '6px 10px', color: '#9CA3AF' }}>{i + 1}</td>
                    <td style={{ padding: '6px 10px', fontWeight: 600 }}>{row.student_name}</td>
                    <td style={{ padding: '6px 10px', color: '#6B7280' }}>{row.roll_number ?? '—'}</td>
                    <td style={{ padding: '6px 10px' }}>
                      <input type='number' value={row.max_marks} min={1} max={1000}
                        onChange={e => updateRow(i, 'max_marks', e.target.value)}
                        style={{ width: 60, padding: '3px 6px', border: '1px solid #D1D5DB', borderRadius: 4, fontSize: 12 }} />
                    </td>
                    <td style={{ padding: '6px 10px' }}>
                      <input type='number' value={row.marks_obtained} min={0}
                        max={parseFloat(row.max_marks) || 100}
                        onChange={e => updateRow(i, 'marks_obtained', e.target.value)}
                        style={{ width: 70, padding: '3px 6px', border: `1px solid ${row.error ? '#FCA5A5' : '#D1D5DB'}`, borderRadius: 4, fontSize: 12 }} />
                    </td>
                    <td style={{ padding: '6px 10px', fontWeight: 700, color: gradeColor[row.grade] ?? '#111827' }}>
                      {row.grade || '—'}
                    </td>
                    <td style={{ padding: '6px 10px', fontSize: 10 }}>
                      {row.saving ? '⏳' : row.saved ? <span style={{ color: '#065F46' }}>✓ Saved</span> : row.error ? <span style={{ color: '#B91C1C' }}>{row.error}</span> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => void saveAll()} disabled={saving}
              style={{ padding: '8px 20px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving...' : '💾 Save All Marks'}
            </button>
            {saveStatus && <span style={{ fontSize: 11, color: '#374151' }}>{saveStatus}</span>}
          </div>

          {/* Batch 13: Report Narratives */}
          {students.length > 0 && selectedTerm && (
            <div style={{ marginTop: 24, border: '1px solid #E0E7FF', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ background: '#EEF2FF', padding: '10px 14px', borderBottom: '1px solid #E0E7FF' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#3730A3' }}>✍ Report Card Narratives</div>
                <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>AI-generated comments for each student. Saved as draft for principal review.</div>
              </div>
              {students.map(s => {
                const ns = narrativeStates[s.student_id];
                return (
                  <div key={s.student_id} style={{ padding: '10px 14px', borderBottom: '1px solid #F0F0FF' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{s.student_name}</div>
                        {ns?.text && (
                          <div style={{ fontSize: 11, color: '#374151', background: '#F5F3FF', padding: '6px 9px', borderRadius: 6, marginBottom: 5, lineHeight: 1.5 }}>{ns.text}</div>
                        )}
                        {ns?.error && (
                          <div style={{ fontSize: 10, color: '#B91C1C', marginBottom: 4 }}>{ns.error}</div>
                        )}
                        {!ns?.text && (
                          <input value={narrativeNotes[s.student_id] ?? ''} onChange={e => setNarrativeNotes(prev => ({ ...prev, [s.student_id]: e.target.value }))}
                            placeholder="Optional teacher notes..." style={{ width: '100%', fontSize: 11, padding: '4px 8px', border: '1px solid #D1D5DB', borderRadius: 5, boxSizing: 'border-box' as const }} />
                        )}
                      </div>
                      <button onClick={() => void generateNarrative(s.student_id, s.student_name)}
                        disabled={ns?.loading}
                        style={{ padding: '5px 10px', background: ns?.text ? '#065F46' : '#4338CA', color: '#fff', border: 'none', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: ns?.loading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' as const, flexShrink: 0 }}>
                        {ns?.loading ? 'Generating...' : ns?.text ? '✓ Regenerate' : '✍ Generate'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>
          Select a subject to load the student roster.
        </div>
      )}
    </div>
  );
}
