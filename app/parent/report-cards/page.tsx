'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface SubjectRow {
  subject: string;
  marks_obtained: number;
  max_marks: number;
  grade: string;
}

interface TermReport {
  term: string;
  subjects: SubjectRow[];
  total_obtained: number;
  total_max: number;
  percentage: number;
  overall_grade: string;
}

interface StudentInfo {
  name: string;
  class: string;
  section: string;
  roll_number: string | null;
}

type PageState = 'loading' | 'error' | 'empty' | 'ready';

function gradeColor(g: string): string {
  if (g === 'A+' || g === 'A') return '#16A34A';
  if (g === 'B+' || g === 'B') return '#2563EB';
  if (g === 'C') return '#D97706';
  if (g === 'D') return '#EA580C';
  return '#B91C1C';
}

function formatTerm(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function ReportCardsPage() {
  const [state, setState] = useState<PageState>('loading');
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [terms, setTerms] = useState<TermReport[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/parent/report-cards')
      .then(r => {
        if (r.status === 401) { window.location.href = '/parent/login'; throw new Error('unauth'); }
        if (!r.ok) throw new Error('fetch_failed');
        return r.json();
      })
      .then(d => {
        setStudent(d.student ?? null);
        const t: TermReport[] = d.terms ?? [];
        setTerms(t);
        if (t.length === 0) { setState('empty'); return; }
        setSelectedTerm(t[0].term);
        setState('ready');
      })
      .catch(e => { if (e.message !== 'unauth') setState('error'); });
  }, []);

  const current = terms.find(t => t.term === selectedTerm) ?? null;

  async function handleDownload() {
    if (!selectedTerm) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await fetch(`/api/parent/report-cards/download?term=${encodeURIComponent(selectedTerm)}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setDownloadError((d as { error?: string }).error ?? 'Download failed');
        return;
      }
      const { pdf_base64, student_name, term } = await res.json() as { pdf_base64: string; student_name: string; term: string };
      const bytes = Uint8Array.from(atob(pdf_base64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ReportCard_${student_name.replace(/\s+/g, '_')}_${term}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError('Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#4F46E5', padding: '16px 16px 20px' }}>
        <Link href="/parent" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, textDecoration: 'none', display: 'block', marginBottom: 8 }}>← Back</Link>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>Report Cards</div>
        {student && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>
            {student.name} &middot; Class {student.class}{student.section ? `-${student.section}` : ''}
            {student.roll_number ? ` &middot; Roll ${student.roll_number}` : ''}
          </div>
        )}
      </div>

      <div style={{ padding: 16 }}>

        {/* LOADING */}
        {state === 'loading' && (
          <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF', fontSize: 14 }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>📋</div>
            Loading report cards&hellip;
          </div>
        )}

        {/* ERROR */}
        {state === 'error' && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>⚠️</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#B91C1C' }}>Failed to load report cards</div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 6 }}>Please check your connection and try again.</div>
            <button
              onClick={() => { setState('loading'); window.location.reload(); }}
              style={{ marginTop: 14, padding: '8px 18px', background: '#4F46E5', color: '#fff', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >Retry</button>
          </div>
        )}

        {/* EMPTY */}
        {state === 'empty' && (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>📂</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#374151' }}>No report cards yet</div>
            <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 6, maxWidth: 260, margin: '6px auto 0' }}>
              Marks will appear here once your school publishes results.
            </div>
          </div>
        )}

        {/* READY */}
        {state === 'ready' && current && (
          <>
            {/* Term selector */}
            {terms.length > 1 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                {terms.map(t => (
                  <button
                    key={t.term}
                    onClick={() => setSelectedTerm(t.term)}
                    style={{
                      padding: '6px 14px', borderRadius: 99, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
                      background: selectedTerm === t.term ? '#4F46E5' : '#E5E7EB',
                      color: selectedTerm === t.term ? '#fff' : '#374151',
                    }}
                  >{formatTerm(t.term)}</button>
                ))}
              </div>
            )}

            {/* Summary card */}
            <div style={{ background: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div style={{ textAlign: 'center', background: '#F5F3FF', borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#4F46E5' }}>{current.percentage}%</div>
                  <div style={{ fontSize: 10, color: '#6B7280' }}>Percentage</div>
                </div>
                <div style={{ textAlign: 'center', background: '#F0FDF4', borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: gradeColor(current.overall_grade) }}>{current.overall_grade}</div>
                  <div style={{ fontSize: 10, color: '#6B7280' }}>Grade</div>
                </div>
                <div style={{ textAlign: 'center', background: current.percentage >= 40 ? '#F0FDF4' : '#FEF2F2', borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: current.percentage >= 40 ? '#16A34A' : '#B91C1C' }}>
                    {current.percentage >= 40 ? 'Promoted' : 'Detained'}
                  </div>
                  <div style={{ fontSize: 10, color: '#6B7280' }}>Status</div>
                </div>
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: '#6B7280', textAlign: 'center' }}>
                {current.total_obtained} / {current.total_max} marks &middot; {current.subjects.length} subjects
              </div>
            </div>

            {/* Marks table */}
            <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 56px 70px 48px', background: '#F3F4F6', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <div>Subject</div><div style={{ textAlign: 'right' }}>Max</div><div style={{ textAlign: 'right' }}>Obtained</div><div style={{ textAlign: 'right' }}>Grade</div>
              </div>
              {current.subjects.map((s, i) => (
                <div key={s.subject} style={{ display: 'grid', gridTemplateColumns: '1fr 56px 70px 48px', padding: '11px 14px', fontSize: 13, borderTop: i > 0 ? '1px solid #F3F4F6' : 'none', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600, color: '#111827' }}>{s.subject}</div>
                  <div style={{ textAlign: 'right', color: '#6B7280' }}>{s.max_marks}</div>
                  <div style={{ textAlign: 'right', fontWeight: 700, color: '#111827' }}>{s.marks_obtained}</div>
                  <div style={{ textAlign: 'right', fontWeight: 800, color: gradeColor(s.grade) }}>{s.grade || '—'}</div>
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 56px 70px 48px', padding: '11px 14px', fontSize: 13, borderTop: '2px solid #E5E7EB', background: '#F9FAFB', fontWeight: 800 }}>
                <div style={{ color: '#374151' }}>Total</div>
                <div style={{ textAlign: 'right', color: '#374151' }}>{current.total_max}</div>
                <div style={{ textAlign: 'right', color: '#111827' }}>{current.total_obtained}</div>
                <div style={{ textAlign: 'right', color: gradeColor(current.overall_grade) }}>{current.overall_grade}</div>
              </div>
            </div>

            {/* Download */}
            {downloadError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#B91C1C', marginBottom: 10 }}>
                {downloadError}
              </div>
            )}
            <button
              onClick={handleDownload}
              disabled={downloading}
              style={{
                width: '100%', padding: '13px', background: downloading ? '#A5B4FC' : '#4F46E5',
                color: '#fff', borderRadius: 12, border: 'none', fontSize: 15, fontWeight: 800,
                cursor: downloading ? 'not-allowed' : 'pointer', letterSpacing: '0.01em',
              }}
            >
              {downloading ? 'Generating PDF…' : '⬇ Download PDF Report Card'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
