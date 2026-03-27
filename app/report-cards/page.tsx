'use client';

import { useState } from 'react';

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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Generation failed');
      setReports(data.reports ?? []); setStatus('success');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error'); setStatus('error');
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
      reports.forEach((r: Report) => zip.file(r.fileName, r.html));
      zip.generateAsync({ type: 'blob' }).then((blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ReportCards_${selClass.classNum}${selClass.section}.zip`;
        a.click(); URL.revokeObjectURL(url);
      });
    });
  }

  const btn: React.CSSProperties = {
    border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F8F7F4', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <nav style={{ background: '#fff', borderBottom: '1px solid #E8E6DF', height: 56, display: 'flex', alignItems: 'center', padding: '0 32px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: '#0F6E56', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>S</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#1A1A18' }}>School OS</span>
          </a>
          <span style={{ color: '#D3D1C7', margin: '0 4px' }}>|</span>
          <span style={{ fontSize: 14, color: '#5F5E5A' }}>Report Cards</span>
        </div>
        <span style={{ fontSize: 12, color: '#888780' }}>Suchitra Academy</span>
      </nav>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#E1F5EE', borderRadius: 20, padding: '4px 12px', marginBottom: 14 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#0F6E56' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#0F6E56', letterSpacing: '0.05em' }}>AI REPORT CARDS</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1A1A18', margin: '0 0 8px', letterSpacing: '-0.5px' }}>Report Card Generator</h1>
          <p style={{ fontSize: 15, color: '#5F5E5A', margin: 0, lineHeight: 1.6 }}>
            Claude generates personalised narratives for every student and packages them for download.
          </p>
        </div>

        <div style={{ background: '#fff', border: '1px solid #E8E6DF', borderRadius: 16, padding: 28, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 24 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#5F5E5A', letterSpacing: '0.05em', marginBottom: 7 }}>SELECT CLASS</label>
              <select
                value={`${selClass.classNum}-${selClass.section}`}
                onChange={e => { const f = CLASSES.find(c => `${c.classNum}-${c.section}` === e.target.value); if (f) setSelClass(f); }}
                style={{ width: '100%', height: 42, borderRadius: 8, border: '1px solid #D3D1C7', background: '#FAFAF8', fontSize: 14, padding: '0 12px', outline: 'none' }}
              >
                {CLASSES.map(c => <option key={`${c.classNum}-${c.section}`} value={`${c.classNum}-${c.section}`}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#5F5E5A', letterSpacing: '0.05em', marginBottom: 7 }}>SELECT TERM</label>
              <select value={selTerm} onChange={e => setSelTerm(e.target.value)}
                style={{ width: '100%', height: 42, borderRadius: 8, border: '1px solid #D3D1C7', background: '#FAFAF8', fontSize: 14, padding: '0 12px', outline: 'none' }}>
                {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div style={{ background: '#F1EFE8', borderRadius: 8, padding: '12px 16px', display: 'flex', gap: 32, marginBottom: 24 }}>
            {[{ label: 'Class', value: selClass.label }, { label: 'Term', value: selTerm }, { label: 'Model', value: 'Claude Sonnet 4' }].map(item => (
              <div key={item.label}>
                <div style={{ fontSize: 10, color: '#888780', marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#2C2C2A' }}>{item.value}</div>
              </div>
            ))}
          </div>

          <button onClick={handleGenerate} disabled={status === 'loading'}
            style={{ ...btn, width: '100%', height: 48, borderRadius: 10, background: status === 'loading' ? '#5DCAA5' : '#0F6E56', color: '#fff', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            {status === 'loading' ? <><Spinner /> Generating reports, please wait...</> : 'Generate Report Cards with AI'}
          </button>
        </div>

        {status === 'error' && (
          <div style={{ background: '#FAECE7', border: '1px solid #F0997B', borderRadius: 10, padding: '14px 18px', color: '#712B13', fontSize: 14, marginBottom: 20 }}>
            <strong>Error:</strong> {errorMsg}
          </div>
        )}

        {status === 'success' && reports.length > 0 && (
          <div style={{ background: '#fff', border: '1.5px solid #1D9E75', borderRadius: 16, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0F6E56', fontWeight: 700, fontSize: 18 }}>
                  ✓
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: '#0F6E56' }}>{reports.length} reports generated</div>
                  <div style={{ fontSize: 12, color: '#5F5E5A' }}>{selClass.label} · {selTerm} · Saved to database</div>
                </div>
              </div>
              <button onClick={downloadAllZip}
                style={{ ...btn, height: 38, padding: '0 20px', borderRadius: 8, background: '#0F6E56', color: '#fff', fontSize: 13 }}>
                Download All ZIP
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {reports.map((r: Report, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#F8F7F4', borderRadius: 8, border: '1px solid #E8E6DF' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#0F6E56' }}>{i + 1}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#1A1A18' }}>{r.name}</div>
                      <div style={{ fontSize: 11, color: '#888780' }}>{r.fileName}</div>
                    </div>
                  </div>
                  <button onClick={() => downloadHTML(r)}
                    style={{ ...btn, height: 32, padding: '0 14px', borderRadius: 6, background: '#fff', border: '1px solid #D3D1C7', fontSize: 12, color: '#1A1A18' }}>
                    Download
                  </button>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 16, padding: '12px 16px', background: '#F1EFE8', borderRadius: 8, fontSize: 12, color: '#5F5E5A' }}>
              Tip: Open the HTML file in Chrome, press Ctrl+P, then Save as PDF for print-ready report cards.
            </div>
          </div>
        )}

        {status === 'idle' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 24 }}>
            {[
              { step: '01', title: 'Fetch data', desc: 'Student marks pulled from Supabase' },
              { step: '02', title: 'AI narrative', desc: 'Claude writes 80-120 word comment' },
              { step: '03', title: 'Download', desc: 'HTML file, open in Chrome, print as PDF' },
            ].map(item => (
              <div key={item.step} style={{ background: '#fff', border: '1px solid #E8E6DF', borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#0F6E56', letterSpacing: '0.06em', marginBottom: 6 }}>STEP {item.step}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#2C2C2A', marginBottom: 4 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: '#888780', lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <>
      <style>{`@keyframes _spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.35)', borderTop: '2px solid #fff', borderRadius: '50%', animation: '_spin 0.7s linear infinite' }} />
    </>
  );
}
