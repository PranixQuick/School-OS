'use client';
// PATH: app/admin/report-cards/page.tsx
// Batch 6 — Admin report cards UI.
// Select class + term → view marks summary → generate PDF per student.

import { useState, useCallback } from 'react';
import Layout from '@/components/Layout';

const TERMS = [
  { value: 'term_1', label: 'Term 1' },
  { value: 'term_2', label: 'Term 2' },
  { value: 'term_3', label: 'Term 3' },
  { value: 'annual', label: 'Annual' },
];
const GRADE_LEVELS = ['1','2','3','4','5','6','7','8','9','10','11','12'];
const SECTIONS = ['A','B','C','D','E'];

interface StudentSummary {
  student_id: string;
  student_name: string;
  class_label: string;
  total_obtained: number;
  total_max: number;
  percentage: number;
  grade: string;
  generating: boolean;
  generated: boolean;
  error: string | null;
}

function calcGrade(pct: number): string {
  if (pct >= 90) return 'A+'; if (pct >= 80) return 'A'; if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B'; if (pct >= 50) return 'C'; if (pct >= 40) return 'D';
  return 'F';
}

function downloadPdf(base64: string, filename: string) {
  const a = document.createElement('a');
  a.href = `data:application/pdf;base64,${base64}`;
  a.download = filename;
  a.click();
}

export default function ReportCardsPage() {
  const [gradeLevel, setGradeLevel] = useState('5');
  const [section, setSection] = useState('A');
  const [term, setTerm] = useState('term_1');
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);

  const loadStudents = useCallback(async () => {
    setLoading(true); setStudents([]);
    try {
      // Get students in the class
      const classRes = await fetch(`/api/admin/students?grade_level=${gradeLevel}&section=${section}`);
      if (!classRes.ok) { setLoading(false); return; }
      const classData = await classRes.json() as { students: { id: string; name: string }[] };
      const studentList = classData.students ?? [];
      if (!studentList.length) { setLoading(false); return; }

      // Fetch marks summary per student in parallel (batch of 5)
      const summaries: StudentSummary[] = [];
      for (let i = 0; i < studentList.length; i += 5) {
        const batch = studentList.slice(i, i + 5);
        const results = await Promise.all(batch.map(async s => {
          const r = await fetch(`/api/admin/report-cards/${s.id}?term=${term}`);
          const d = await r.json() as { total_obtained: number; total_max: number; percentage: number };
          return {
            student_id: s.id,
            student_name: s.name,
            class_label: `${gradeLevel}-${section}`,
            total_obtained: d.total_obtained ?? 0,
            total_max: d.total_max ?? 0,
            percentage: d.percentage ?? 0,
            grade: calcGrade(d.percentage ?? 0),
            generating: false, generated: false, error: null,
          } satisfies StudentSummary;
        }));
        summaries.push(...results);
      }
      setStudents(summaries);
    } catch { /* ignore */ }
    setLoading(false);
  }, [gradeLevel, section, term]);

  async function generatePdf(idx: number) {
    const s = students[idx];
    setStudents(prev => prev.map((r, i) => i === idx ? { ...r, generating: true, error: null } : r));
    try {
      const res = await fetch('/api/admin/report-cards/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: s.student_id, term }),
      });
      const data = await res.json() as { pdf_base64: string; student_name: string; error?: string };
      if (res.ok && data.pdf_base64) {
        downloadPdf(data.pdf_base64, `Report-${data.student_name.replace(/\s+/g, '_')}-${term}.pdf`);
        setStudents(prev => prev.map((r, i) => i === idx ? { ...r, generating: false, generated: true } : r));
      } else {
        setStudents(prev => prev.map((r, i) => i === idx ? { ...r, generating: false, error: data.error ?? 'Failed' } : r));
      }
    } catch {
      setStudents(prev => prev.map((r, i) => i === idx ? { ...r, generating: false, error: 'Network error' } : r));
    }
  }

  async function generateAll() {
    setGeneratingAll(true);
    for (let i = 0; i < students.length; i++) {
      await generatePdf(i);
    }
    setGeneratingAll(false);
  }

  const gradeColor: Record<string, string> = { 'A+':'#065F46','A':'#065F46','B+':'#1D4ED8','B':'#1D4ED8','C':'#92400E','D':'#B45309','F':'#991B1B' };
  const termLabel = TERMS.find(t => t.value === term)?.label ?? term;

  return (
    <Layout title="Report Cards" subtitle="Generate and download student report cards">

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'flex-end' }}>
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
        <button onClick={() => void loadStudents()} disabled={loading}
          style={{ padding: '7px 16px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Loading...' : '🔍 Load Students'}
        </button>
        {students.length > 0 && (
          <button onClick={() => void generateAll()} disabled={generatingAll}
            style={{ padding: '7px 16px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: generatingAll ? 0.7 : 1 }}>
            {generatingAll ? 'Generating...' : `📄 Generate All (${students.length})`}
          </button>
        )}
      </div>

      {/* Student table */}
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>Loading students...</div>
      ) : students.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>
          Select a class and term, then click "Load Students".
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>
            {students.length} students — Grade {gradeLevel}-{section} · {termLabel}
          </div>
          <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  {['#','Student Name','Class','Total Marks','Percentage','Grade',''].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, fontSize: 10, color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => (
                  <tr key={s.student_id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '8px 10px', color: '#9CA3AF' }}>{i + 1}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{s.student_name}</td>
                    <td style={{ padding: '8px 10px', color: '#6B7280' }}>{s.class_label}</td>
                    <td style={{ padding: '8px 10px' }}>{s.total_obtained} / {s.total_max}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{s.percentage.toFixed(1)}%</td>
                    <td style={{ padding: '8px 10px', fontWeight: 800, color: gradeColor[s.grade] ?? '#111827' }}>{s.grade}</td>
                    <td style={{ padding: '8px 10px' }}>
                      {s.error ? (
                        <span style={{ fontSize: 10, color: '#B91C1C' }}>{s.error}</span>
                      ) : s.generated ? (
                        <span style={{ fontSize: 10, color: '#065F46' }}>✓ Downloaded</span>
                      ) : (
                        <button onClick={() => void generatePdf(i)} disabled={s.generating}
                          style={{ padding: '4px 10px', background: '#F3F4F6', border: '1px solid #D1D5DB', borderRadius: 5, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                          {s.generating ? '⏳' : '📄 PDF'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Layout>
  );
}
