'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';

const CLASSES = [
  { label: 'Class 5 - A', classNum: '5', section: 'A' },
  { label: 'Class 5 - B', classNum: '5', section: 'B' },
  { label: 'Class 6 - A', classNum: '6', section: 'A' },
];
const TERMS = ['Term 1 2024-25', 'Term 2 2024-25', 'Term 3 2024-25'];

interface Report { name: string; fileName: string; html: string; }
type Status = 'idle' | 'loading' | 'success' | 'error';

export default function ReportCardsPage() {
  const [selClass, setSelClass] = useState(CLASSES[0]);
  const [selTerm, setSelTerm] = useState(TERMS[0]);
  const [status, setStatus] = useState<Status>('idle');
  const [reports, setReports] = useState<Report[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleGenerate() {
    setStatus('loading'); setReports([]); setErrorMsg('');
    try {
      const res = await fetch('/api/report-cards/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classNum: selClass.classNum, section: selClass.section, term: selTerm }),
      });
      const data = await res.json() as { error?: string; reports?: Report[] };
      if (!res.ok) throw new Error(data.error ?? 'Generation failed');
      setReports(data.reports ?? []);
      setStatus('success');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  }

  function downloadHTML(report: Report) {
    const blob = new Blob([report.html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = report.fileName; a.click();
    URL.revokeObjectURL(url);
  }

  function downloadAllZip() {
    import('jszip').then(({ default: JSZip }) => {
      const zip = new JSZip();
      reports.forEach(r => zip.file(r.fileName, r.html));
      zip.generateAsync({ type: 'blob' }).then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ReportCards_${selClass.classNum}${selClass.section}.zip`;
        a.click(); URL.revokeObjectURL(url);
      });
    });
  }

  return (
    <Layout
      title="Report Cards"
      subtitle="AI-generated student progress narratives"
      actions={
        <Link href="/dashboard" className="btn btn-ghost btn-sm">← Dashboard</Link>
      }
    >
      <div style={{ maxWidth: 700, margin: '0 auto' }}>

        {/* How it works strip */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
          {[
            { step: '01', title: 'Select class', desc: 'Choose class and term' },
            { step: '02', title: 'AI writes', desc: 'Claude generates 80-120 word comments' },
            { step: '03', title: 'Download', desc: 'HTML → open in Chrome → print PDF' },
          ].map(s => (
            <div key={s.step} className="card-sm" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#4F46E5', flexShrink: 0 }}>{s.step}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 2 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Main control card */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 20 }}>
            <div>
              <label className="label">SELECT CLASS</label>
              <select
                className="input"
                style={{ height: 42 } as CSSProperties}
                value={`${selClass.classNum}-${selClass.section}`}
                onChange={e => { const f = CLASSES.find(c => `${c.classNum}-${c.section}` === e.target.value); if (f) setSelClass(f); }}
              >
                {CLASSES.map(c => <option key={`${c.classNum}-${c.section}`} value={`${c.classNum}-${c.section}`}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">SELECT TERM</label>
              <select className="input" style={{ height: 42 } as CSSProperties} value={selTerm} onChange={e => setSelTerm(e.target.value)}>
                {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 28, marginBottom: 20, border: '1px solid #F3F4F6' }}>
            {[{ l: 'Class', v: selClass.label }, { l: 'Term', v: selTerm }, { l: 'Model', v: 'Claude Sonnet' }].map(x => (
              <div key={x.l}>
                <div style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 2, fontWeight: 600, letterSpacing: '0.04em' }}>{x.l.toUpperCase()}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{x.v}</div>
              </div>
            ))}
          </div>

          <button onClick={handleGenerate} disabled={status === 'loading'} className={`btn btn-primary btn-lg`} style={{ width: '100%' }}>
            {status === 'loading' ? <><span className="spinner" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff' }} />Generating reports — please wait...</> : '✦ Generate Report Cards with AI'}
          </button>
        </div>

        {status === 'error' && (
          <div className="alert alert-error" style={{ marginBottom: 16 }}>
            <strong>Error:</strong> {errorMsg}
          </div>
        )}

        {status === 'success' && reports.length > 0 && (
          <div className="card" style={{ border: '1.5px solid #22C55E' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#15803D', fontWeight: 700, fontSize: 18 }}>✓</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#15803D' }}>{reports.length} reports generated</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>{selClass.label} · {selTerm} · Saved to database</div>
                </div>
              </div>
              <button onClick={downloadAllZip} className="btn btn-success btn-sm">↓ Download All ZIP</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {reports.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#F9FAFB', borderRadius: 10, border: '1px solid #F3F4F6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#15803D' }}>{i + 1}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{r.name}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>{r.fileName}</div>
                    </div>
                  </div>
                  <button onClick={() => downloadHTML(r)} className="btn btn-ghost btn-sm">↓ Download</button>
                </div>
              ))}
            </div>
            <div className="alert alert-info" style={{ marginTop: 14 }}>
              Tip: Open HTML file in Chrome → Ctrl+P → Save as PDF for print-ready cards.
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
