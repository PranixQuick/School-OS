'use client';
// app/student/marks/page.tsx
// Batch 4D — Marks by term, accordion per term.

import { useState, useEffect } from 'react';

interface MarksRecord { id: string; term: string; subject: string; marks_obtained: number; max_marks: number; grade: string; teacher_remarks: string | null; exam_date: string | null; }
interface TermGroup { term: string; records: MarksRecord[]; total_percentage: number | null; }

export default function MarksPage() {
  const [terms, setTerms] = useState<TermGroup[]>([]);
  const [openTerm, setOpenTerm] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch('/api/student/marks').then(r => r.ok ? r.json() : null)
      .then((d: { terms?: TermGroup[] } | null) => {
        const t = d?.terms ?? [];
        setTerms(t);
        if (t.length) setOpenTerm(t[t.length - 1].term); // open latest term
        setLoading(false);
      });
  }, []);

  const cardStyle = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, marginBottom: 10, overflow: 'hidden' };

  function gradeColor(pct: number): string {
    if (pct >= 75) return '#065F46';
    if (pct >= 50) return '#D97706';
    return '#DC2626';
  }

  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 14 }}>📊 Marks</div>

      {loading ? <div style={{ color: '#9CA3AF', fontSize: 13, padding: 20 }}>Loading…</div>
      : terms.length === 0 ? (
        <div style={{ ...cardStyle, padding: 30, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No marks recorded yet.</div>
      ) : (
        terms.map(t => {
          const isOpen = openTerm === t.term;
          const pct = t.total_percentage;
          return (
            <div key={t.term} style={cardStyle}>
              {/* Accordion header */}
              <button onClick={() => setOpenTerm(isOpen ? null : t.term)}
                style={{ width: '100%', padding: '14px 16px', background: isOpen ? '#F0F4FF' : '#fff', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>{t.term}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {pct != null && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: gradeColor(pct) }}>{pct}% overall</span>
                  )}
                  <span style={{ color: '#9CA3AF', fontSize: 14 }}>{isOpen ? '▲' : '▼'}</span>
                </div>
              </button>

              {isOpen && (
                <div style={{ borderTop: '1px solid #E5E7EB' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#F9FAFB' }}>
                        {['Subject','Marks','Max','%','Grade'].map(h => (
                          <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, fontSize: 10, color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {t.records.map(r => {
                        const pctR = r.max_marks > 0 ? Math.round((r.marks_obtained / r.max_marks) * 100) : 0;
                        return (
                          <tr key={r.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                            <td style={{ padding: '8px 10px', fontWeight: 600 }}>{r.subject}</td>
                            <td style={{ padding: '8px 10px', fontWeight: 700, color: gradeColor(pctR) }}>{r.marks_obtained}</td>
                            <td style={{ padding: '8px 10px', color: '#6B7280' }}>{r.max_marks}</td>
                            <td style={{ padding: '8px 10px', color: gradeColor(pctR), fontWeight: 600 }}>{pctR}%</td>
                            <td style={{ padding: '8px 10px' }}>
                              {r.grade && <span style={{ background: '#EEF2FF', color: '#4F46E5', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>{r.grade}</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
