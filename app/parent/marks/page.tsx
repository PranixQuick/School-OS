''use client'';

import { useState, useEffect } from ''react'';
import Link from ''next/link'';

interface MarkRow { id: string; subject: string; exam_name: string; marks_obtained: number; max_marks: number; exam_date: string; grade?: string; }

export default function ParentMarksPage() {
  const [marks, setMarks] = useState<MarkRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(''/api/parent/marks'').then(r => r.ok ? r.json() : { marks: [] }).then(d => setMarks(d.marks ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const pct = (ob: number, mx: number) => mx > 0 ? Math.round((ob / mx) * 100) : 0;
  const grade = (p: number) => p >= 90 ? ''A+'' : p >= 80 ? ''A'' : p >= 70 ? ''B'' : p >= 60 ? ''C'' : p >= 50 ? ''D'' : ''F'';
  const gradeColor = (p: number) => p >= 80 ? ''#16A34A'' : p >= 60 ? ''#D97706'' : ''#B91C1C'';

  return (
    <div style={{ minHeight: ''100vh'', background: ''#F9FAFB'', fontFamily: ''-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'' }}>
      <div style={{ background: ''#4F46E5'', padding: ''16px 16px 20px'' }}>
        <Link href=''/parent'' style={{ color: ''rgba(255,255,255,0.8)'', fontSize: 13, textDecoration: ''none'', display: ''block'', marginBottom: 8 }}>← Back</Link>
        <div style={{ fontSize: 18, fontWeight: 800, color: ''#fff'' }}>Marks &amp; Results</div>
      </div>
      <div style={{ padding: 16 }}>
        {loading ? <div style={{ textAlign: ''center'', padding: 40, color: ''#9CA3AF'' }}>Loading…</div>
        : marks.length === 0 ? (
          <div style={{ textAlign: ''center'', padding: 48, color: ''#9CA3AF'' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
            <div style={{ fontWeight: 700, color: ''#374151'' }}>No marks recorded yet.</div>
          </div>
        ) : marks.map(m => {
          const p = pct(m.marks_obtained, m.max_marks);
          return (
            <div key={m.id} style={{ background: ''#fff'', borderRadius: 14, padding: 14, marginBottom: 10, boxShadow: ''0 1px 3px rgba(0,0,0,0.06)'' }}>
              <div style={{ display: ''flex'', justifyContent: ''space-between'', alignItems: ''flex-start'' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: ''#111827'' }}>{m.subject}</div>
                  <div style={{ fontSize: 12, color: ''#6B7280'', marginTop: 2 }}>{m.exam_name} · {m.exam_date ? new Date(m.exam_date).toLocaleDateString(''en-IN'', { day: ''numeric'', month: ''short'' }) : ''''}</div>
                </div>
                <div style={{ textAlign: ''right'' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: gradeColor(p) }}>{m.marks_obtained}/{m.max_marks}</div>
                  <div style={{ fontSize: 12, color: gradeColor(p), fontWeight: 700 }}>{grade(p)} · {p}%</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
