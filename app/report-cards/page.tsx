// /app/report-cards/page.tsx
'use client';

import { useState } from 'react';

const CLASSES = [
  { label: 'Class 5 – A', classNum: '5', section: 'A' },
  { label: 'Class 5 – B', classNum: '5', section: 'B' },
  { label: 'Class 6 – A', classNum: '6', section: 'A' },
  { label: 'Class 6 – B', classNum: '6', section: 'B' },
];

const TERMS = [
  'Term 1 2024-25',
  'Term 2 2024-25',
  'Term 3 2024-25',
];

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function ReportCardsPage() {
  const [selectedClass, setSelectedClass] = useState(CLASSES[0]);
  const [selectedTerm, setSelectedTerm] = useState(TERMS[0]);
  const [status, setStatus] = useState<Status>('idle');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState('');
  const [count, setCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleGenerate() {
    setStatus('loading');
    setDownloadUrl(null);
    setErrorMsg('');

    try {
      const res = await fetch('/api/report-cards/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classNum: selectedClass.classNum,
          section: selectedClass.section,
          term: selectedTerm,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Generation failed');
      }

      const generatedCount = Number(res.headers.get('X-Generated-Count') ?? 0);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const fileName = `ReportCards_Class${selectedClass.classNum}${selectedClass.section}.zip`;

      setDownloadUrl(url);
      setDownloadName(fileName);
      setCount(generatedCount);
      setStatus('success');

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setErrorMsg(message);
      setStatus('error');
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F8F7F4',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>

      {/* Top nav */}
      <div style={{
        background: '#ffffff',
        borderBottom: '1px solid #E8E6DF',
        padding: '0 32px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: '#0F6E56',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>S</span>
          </div>
          <span style={{ fontWeight: 600, fontSize: 15, color: '#1A1A18' }}>School OS</span>
        </div>
        <span style={{ fontSize: 13, color: '#888780' }}>Suchitra Academy · Admin</span>
      </div>

      {/* Page content */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: '#E1F5EE', borderRadius: 20,
            padding: '4px 12px', marginBottom: 16,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#0F6E56' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#0F6E56', letterSpacing: '0.04em' }}>
              AI REPORT CARDS
            </span>
          </div>
          <h1 style={{
            fontSize: 30, fontWeight: 700, color: '#1A1A18',
            margin: '0 0 8px', letterSpacing: '-0.5px',
          }}>
            Report Card Generator
          </h1>
          <p style={{ fontSize: 15, color: '#5F5E5A', margin: 0, lineHeight: 1.6 }}>
            Select a class and term. Claude will generate personalised narratives for each student and package all PDFs into a single download.
          </p>
        </div>

        {/* Control card */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #E8E6DF',
          borderRadius: 16,
          padding: 32,
          marginBottom: 24,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>

            {/* Class selector */}
            <div>
              <label style={{
                display: 'block', fontSize: 12, fontWeight: 600,
                color: '#5F5E5A', letterSpacing: '0.04em', marginBottom: 8,
              }}>
                SELECT CLASS
              </label>
              <select
                value={`${selectedClass.classNum}-${selectedClass.section}`}
                onChange={e => {
                  const found = CLASSES.find(c => `${c.classNum}-${c.section}` === e.target.value);
                  if (found) setSelectedClass(found);
                }}
                style={{
                  width: '100%', height: 44, borderRadius: 8,
                  border: '1px solid #D3D1C7', background: '#FAFAF8',
                  fontSize: 14, color: '#1A1A18', padding: '0 12px',
                  outline: 'none', cursor: 'pointer',
                }}
              >
                {CLASSES.map(c => (
                  <option key={`${c.classNum}-${c.section}`} value={`${c.classNum}-${c.section}`}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Term selector */}
            <div>
              <label style={{
                display: 'block', fontSize: 12, fontWeight: 600,
                color: '#5F5E5A', letterSpacing: '0.04em', marginBottom: 8,
              }}>
                SELECT TERM
              </label>
              <select
                value={selectedTerm}
                onChange={e => setSelectedTerm(e.target.value)}
                style={{
                  width: '100%', height: 44, borderRadius: 8,
                  border: '1px solid #D3D1C7', background: '#FAFAF8',
                  fontSize: 14, color: '#1A1A18', padding: '0 12px',
                  outline: 'none', cursor: 'pointer',
                }}
              >
                {TERMS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Info strip */}
          <div style={{
            background: '#F1EFE8', borderRadius: 8, padding: '12px 16px',
            display: 'flex', gap: 24, marginBottom: 28,
          }}>
            {[
              { label: 'Class selected', value: selectedClass.label },
              { label: 'Term', value: selectedTerm },
              { label: 'AI model', value: 'Claude Sonnet 4' },
            ].map(item => (
              <div key={item.label}>
                <div style={{ fontSize: 11, color: '#888780', marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#2C2C2A' }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={status === 'loading'}
            style={{
              width: '100%', height: 48, borderRadius: 10,
              background: status === 'loading' ? '#5DCAA5' : '#0F6E56',
              border: 'none', color: '#ffffff',
              fontSize: 15, fontWeight: 600, cursor: status === 'loading' ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              transition: 'background 0.2s',
            }}
          >
            {status === 'loading' ? (
              <>
                <Spinner />
                Generating reports — this takes ~30 seconds...
              </>
            ) : (
              <>
                <span style={{ fontSize: 17 }}>✦</span>
                Generate Report Cards with AI
              </>
            )}
          </button>
        </div>

        {/* Success state */}
        {status === 'success' && downloadUrl && (
          <div style={{
            background: '#ffffff', border: '1.5px solid #1D9E75',
            borderRadius: 16, padding: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: '#E1F5EE',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16,
                }}>✓</div>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#0F6E56' }}>
                  {count} reports generated successfully
                </span>
              </div>
              <p style={{ fontSize: 13, color: '#5F5E5A', margin: 0 }}>
                {selectedClass.label} · {selectedTerm} · AI narratives saved to database
              </p>
            </div>
            
              href={downloadUrl}
              download={downloadName}
              style={{
                height: 44, padding: '0 24px', borderRadius: 8,
                background: '#0F6E56', color: '#ffffff',
                fontSize: 14, fontWeight: 600, textDecoration: 'none',
                display: 'flex', alignItems: 'center', gap: 8,
                whiteSpace: 'nowrap',
              }}
            >
              ↓ Download ZIP
            </a>
          </div>
        )}

        {/* Error state */}
        {status === 'error' && (
          <div style={{
            background: '#FAECE7', border: '1px solid #F0997B',
            borderRadius: 12, padding: '16px 20px',
            color: '#712B13', fontSize: 14,
          }}>
            <strong>Error:</strong> {errorMsg}
          </div>
        )}

        {/* How it works */}
        <div style={{
          marginTop: 40,
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12,
        }}>
          {[
            { step: '01', title: 'Fetch data', desc: 'Students + marks pulled from Supabase' },
            { step: '02', title: 'AI narrative', desc: 'Claude writes personalised 80–120 word comment' },
            { step: '03', title: 'PDF + ZIP', desc: 'Branded PDFs packaged for download' },
          ].map(item => (
            <div key={item.step} style={{
              background: '#ffffff', border: '1px solid #E8E6DF',
              borderRadius: 12, padding: '16px 18px',
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: '#0F6E56',
                letterSpacing: '0.06em', marginBottom: 6,
              }}>
                STEP {item.step}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#2C2C2A', marginBottom: 4 }}>
                {item.title}
              </div>
              <div style={{ fontSize: 12, color: '#888780', lineHeight: 1.5 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{
      width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)',
      borderTop: '2px solid #fff', borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
