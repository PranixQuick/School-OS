'use client';

import { useState, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';

interface StaffMember { id: string; name: string; role: string; subject: string | null; }
interface EvalResult { score: number; strengths: string; improvements: string; feedback: string; }
interface Recording {
  id: string; file_name: string; coaching_score: number | null;
  eval_report: string | null; status: string; uploaded_at: string; staff_id: string;
}

type PageStatus = 'idle' | 'generating' | 'uploading' | 'processing' | 'done' | 'error';

const BTN: CSSProperties = { border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 };

function scoreColor(s: number) { return s >= 8 ? '#0F6E56' : s >= 6 ? '#854F0B' : '#993C1D'; }
function scoreBg(s: number) { return s >= 8 ? '#E1F5EE' : s >= 6 ? '#FAEEDA' : '#FAECE7'; }

export default function TeacherEvalPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<PageStatus>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [result, setResult] = useState<EvalResult | null>(null);
  const [teacherName, setTeacherName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [history, setHistory] = useState<Recording[]>([]);
  const [activeTab, setActiveTab] = useState<'upload' | 'history'>('upload');
  const [scriptIndex, setScriptIndex] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/staff').then(r => r.json()).then(d => {
      const all = (d.staff ?? []) as StaffMember[];
      setStaff(all);
      if (all.length > 0) setSelectedStaff(all[0].id);
    });
    refreshHistory();
  }, []);

  function refreshHistory() {
    fetch('/api/teacher-eval/history').then(r => r.json()).then(d => setHistory(d.recordings ?? []));
  }

  async function handleUpload() {
    if (!file || !selectedStaff) return;
    setStatus('uploading');
    setStatusMsg('Uploading audio...');
    setResult(null); setErrorMsg('');

    const fd = new FormData();
    fd.append('audio', file);
    fd.append('staffId', selectedStaff);

    try {
      setStatusMsg('Transcribing with Whisper...');
      const res = await fetch('/api/teacher-eval/process', { method: 'POST', body: fd });
      const data = await res.json() as { error?: string; evaluation?: EvalResult; teacherName?: string };
      if (!res.ok) throw new Error(data.error ?? 'Processing failed');
      setResult(data.evaluation ?? null);
      setTeacherName(data.teacherName ?? '');
      setStatus('done');
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      refreshHistory();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  }

  async function handleGenerateSample() {
    if (!selectedStaff) return;
    setStatus('generating');
    setStatusMsg('Generating classroom audio with OpenAI TTS...');
    setResult(null); setErrorMsg('');

    try {
      // Step 1: Generate TTS audio
      const genRes = await fetch('/api/teacher-eval/generate-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: selectedStaff, scriptIndex }),
      });
      const genData = await genRes.json() as { error?: string; fileUrl?: string; storagePath?: string; fileName?: string };
      if (!genRes.ok) throw new Error(genData.error ?? 'Audio generation failed');

      setStatus('processing');
      setStatusMsg('Transcribing and evaluating...');
      setScriptIndex(i => (i + 1) % 2);

      // Step 2: Process the generated audio
      const procRes = await fetch('/api/teacher-eval/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: selectedStaff,
          storagePath: genData.storagePath,
          fileUrl: genData.fileUrl,
          fileName: genData.fileName ?? 'sample.mp3',
        }),
      });
      const procData = await procRes.json() as { error?: string; evaluation?: EvalResult; teacherName?: string };
      if (!procRes.ok) throw new Error(procData.error ?? 'Evaluation failed');

      setResult(procData.evaluation ?? null);
      setTeacherName(procData.teacherName ?? '');
      setStatus('done');
      refreshHistory();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  }

  const isProcessing = ['generating', 'uploading', 'processing'].includes(status);
  const selectedStaffName = staff.find(s => s.id === selectedStaff)?.name ?? '';

  return (
    <div style={{ minHeight: '100vh', background: '#F8F7F4', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* Nav */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #E8E6DF', height: 56, display: 'flex', alignItems: 'center', padding: '0 32px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: '#0F6E56', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>S</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#1A1A18' }}>School OS</span>
          </a>
          <span style={{ color: '#D3D1C7', margin: '0 6px' }}>/</span>
          <span style={{ fontSize: 14, color: '#5F5E5A' }}>Teacher Evaluation</span>
        </div>
        <span style={{ fontSize: 12, color: '#888780' }}>Suchitra Academy</span>
      </nav>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#FAEEDA', borderRadius: 20, padding: '4px 12px', marginBottom: 14 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#854F0B' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#854F0B', letterSpacing: '0.05em' }}>AI TEACHER EVALUATION</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1A1A18', margin: '0 0 8px', letterSpacing: '-0.5px' }}>
            Classroom Recording Analyser
          </h1>
          <p style={{ fontSize: 15, color: '#5F5E5A', margin: 0, lineHeight: 1.6 }}>
            Upload a real classroom recording or generate a sample to test. Whisper transcribes, Claude evaluates and generates coaching feedback.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E8E6DF', marginBottom: 24 }}>
          {(['upload', 'history'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ ...BTN, padding: '10px 20px', background: 'none', fontSize: 14, color: activeTab === tab ? '#854F0B' : '#888780', borderBottom: activeTab === tab ? '2px solid #854F0B' : '2px solid transparent', marginBottom: -1, borderRadius: 0 }}>
              {tab === 'upload' ? 'Upload & Analyse' : `History (${history.length})`}
            </button>
          ))}
        </div>

        {activeTab === 'upload' && (
          <>
            <div style={{ background: '#fff', border: '1px solid #E8E6DF', borderRadius: 16, padding: 28, marginBottom: 20 }}>

              {/* Teacher selector */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#5F5E5A', letterSpacing: '0.05em', marginBottom: 7 }}>SELECT TEACHER</label>
                <select value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)}
                  style={{ width: '100%', height: 42, borderRadius: 8, border: '1px solid #D3D1C7', background: '#FAFAF8', fontSize: 14, padding: '0 12px', outline: 'none' }}>
                  {staff.map(s => (
                    <option key={s.id} value={s.id}>{s.name}{s.subject ? ` — ${s.subject}` : ''}</option>
                  ))}
                  {staff.length === 0 && <option value="">Loading...</option>}
                </select>
              </div>

              {/* Two-path: Upload or Generate */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>

                {/* Upload path */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#5F5E5A', letterSpacing: '0.05em', marginBottom: 7 }}>UPLOAD RECORDING</label>
                  <div onClick={() => fileRef.current?.click()}
                    style={{ border: `2px dashed ${file ? '#854F0B' : '#D3D1C7'}`, borderRadius: 10, padding: '20px 14px', textAlign: 'center', cursor: 'pointer', background: file ? '#FAEEDA' : '#FAFAF8' }}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>🎙</div>
                    {file ? (
                      <>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#854F0B' }}>{file.name.slice(0, 22)}{file.name.length > 22 ? '...' : ''}</div>
                        <div style={{ fontSize: 11, color: '#888780', marginTop: 2 }}>{(file.size / 1024 / 1024).toFixed(1)} MB</div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#2C2C2A' }}>Click to upload</div>
                        <div style={{ fontSize: 11, color: '#888780', marginTop: 2 }}>MP3, WAV, M4A · 50MB</div>
                      </>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] ?? null)} />
                  <button onClick={handleUpload} disabled={!file || !selectedStaff || isProcessing}
                    style={{ ...BTN, width: '100%', height: 40, borderRadius: 8, marginTop: 8, background: (!file || !selectedStaff || isProcessing) ? '#D3D1C7' : '#854F0B', color: '#fff', fontSize: 13 }}>
                    Analyse Upload
                  </button>
                </div>

                {/* Generate path */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#5F5E5A', letterSpacing: '0.05em', marginBottom: 7 }}>AUTO-GENERATE SAMPLE</label>
                  <div style={{ border: '2px dashed #D3D1C7', borderRadius: 10, padding: '20px 14px', textAlign: 'center', background: '#F1EFE8' }}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>🤖</div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#2C2C2A' }}>No audio? No problem.</div>
                    <div style={{ fontSize: 11, color: '#888780', marginTop: 2 }}>Generates a classroom script via OpenAI TTS then runs the full pipeline automatically.</div>
                  </div>
                  <button onClick={handleGenerateSample} disabled={!selectedStaff || isProcessing}
                    style={{ ...BTN, width: '100%', height: 40, borderRadius: 8, marginTop: 8, background: (!selectedStaff || isProcessing) ? '#D3D1C7' : '#0F6E56', color: '#fff', fontSize: 13 }}>
                    Generate Sample Audio
                  </button>
                </div>
              </div>

              {/* Status indicator */}
              {isProcessing && (
                <div style={{ background: '#FAEEDA', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Spinner color="#854F0B" />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#854F0B' }}>Processing</div>
                    <div style={{ fontSize: 12, color: '#5F5E5A' }}>{statusMsg}</div>
                  </div>
                </div>
              )}

              {/* Info strip (idle) */}
              {!isProcessing && (
                <div style={{ background: '#F1EFE8', borderRadius: 8, padding: '12px 16px', display: 'flex', gap: 32 }}>
                  {[
                    { label: 'Teacher', value: selectedStaffName || '—' },
                    { label: 'Pipeline', value: 'Whisper → Claude Sonnet' },
                    { label: 'Est. time', value: '30–90 seconds' },
                  ].map(item => (
                    <div key={item.label}>
                      <div style={{ fontSize: 10, color: '#888780', marginBottom: 2 }}>{item.label}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#2C2C2A' }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Error */}
            {status === 'error' && (
              <div style={{ background: '#FAECE7', border: '1px solid #F0997B', borderRadius: 10, padding: '14px 18px', color: '#712B13', fontSize: 14, marginBottom: 20 }}>
                <strong>Error:</strong> {errorMsg}
              </div>
            )}

            {/* Result */}
            {status === 'done' && result && (
              <div style={{ background: '#fff', border: '1.5px solid #854F0B', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ background: '#FAEEDA', padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#854F0B', letterSpacing: '0.05em', marginBottom: 4 }}>EVALUATION COMPLETE</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#1A1A18' }}>{teacherName}</div>
                  </div>
                  <div style={{ width: 72, height: 72, borderRadius: '50%', background: scoreBg(result.score), border: `3px solid ${scoreColor(result.score)}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: 26, fontWeight: 800, color: scoreColor(result.score), lineHeight: 1 }}>{result.score}</div>
                    <div style={{ fontSize: 10, color: scoreColor(result.score), fontWeight: 600 }}>/ 10</div>
                  </div>
                </div>
                <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {[
                    { label: 'STRENGTHS', text: result.strengths, color: '#0F6E56', bg: '#E1F5EE', icon: '✓' },
                    { label: 'AREAS FOR IMPROVEMENT', text: result.improvements, color: '#854F0B', bg: '#FAEEDA', icon: '↑' },
                    { label: 'COACHING FEEDBACK', text: result.feedback, color: '#3C3489', bg: '#EEEDFE', icon: '→' },
                  ].map(s => (
                    <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{s.icon}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: s.color, letterSpacing: '0.05em' }}>{s.label}</span>
                      </div>
                      <p style={{ fontSize: 14, color: '#2C2C2A', lineHeight: 1.7, margin: 0 }}>{s.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* History tab */}
        {activeTab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {history.length === 0 && (
              <div style={{ background: '#fff', border: '1px solid #E8E6DF', borderRadius: 12, padding: 40, textAlign: 'center', color: '#888780', fontSize: 14 }}>
                No evaluations yet. Upload a recording or generate a sample to get started.
              </div>
            )}
            {history.map(rec => {
              const evalData = rec.eval_report ? JSON.parse(rec.eval_report) as EvalResult : null;
              const date = new Date(rec.uploaded_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
              return (
                <div key={rec.id} style={{ background: '#fff', border: '1px solid #E8E6DF', borderRadius: 12, padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: evalData ? 14 : 0 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#1A1A18', marginBottom: 3 }}>{rec.file_name}</div>
                      <div style={{ fontSize: 12, color: '#888780' }}>{date}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {rec.coaching_score && (
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: scoreBg(rec.coaching_score), border: `2px solid ${scoreColor(rec.coaching_score)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: scoreColor(rec.coaching_score) }}>
                          {rec.coaching_score}
                        </div>
                      )}
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: rec.status === 'done' ? '#E1F5EE' : rec.status === 'failed' ? '#FAECE7' : '#FAEEDA', color: rec.status === 'done' ? '#0F6E56' : rec.status === 'failed' ? '#993C1D' : '#854F0B' }}>
                        {rec.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  {evalData && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={{ background: '#E1F5EE', borderRadius: 8, padding: '10px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#0F6E56', marginBottom: 4 }}>STRENGTHS</div>
                        <p style={{ fontSize: 12, color: '#2C2C2A', lineHeight: 1.5, margin: 0 }}>{evalData.strengths.slice(0, 140)}{evalData.strengths.length > 140 ? '...' : ''}</p>
                      </div>
                      <div style={{ background: '#EEEDFE', borderRadius: 8, padding: '10px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#3C3489', marginBottom: 4 }}>COACHING</div>
                        <p style={{ fontSize: 12, color: '#2C2C2A', lineHeight: 1.5, margin: 0 }}>{evalData.feedback.slice(0, 140)}{evalData.feedback.length > 140 ? '...' : ''}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Spinner({ color = '#854F0B' }: { color?: string }) {
  return (
    <>
      <style>{`@keyframes te_spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 16, height: 16, border: `2px solid ${color}40`, borderTop: `2px solid ${color}`, borderRadius: '50%', animation: 'te_spin 0.7s linear infinite', flexShrink: 0 }} />
    </>
  );
}
