'use client';

import { useState, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';

interface StaffMember { id: string; name: string; role: string; subject: string | null; }
interface EvalResult { score: number; strengths: string; improvements: string; feedback: string; }
interface Recording { id: string; file_name: string; coaching_score: number | null; eval_report: string | null; status: string; uploaded_at: string; }

type PageStatus = 'idle' | 'generating' | 'uploading' | 'processing' | 'done' | 'error';

function scoreColor(s: number) { return s >= 8 ? '#15803D' : s >= 6 ? '#A16207' : '#B91C1C'; }
function scoreBg(s: number) { return s >= 8 ? '#DCFCE7' : s >= 6 ? '#FEF9C3' : '#FEE2E2'; }

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
    setStatus('uploading'); setStatusMsg('Uploading audio...'); setResult(null); setErrorMsg('');
    const fd = new FormData();
    fd.append('audio', file); fd.append('staffId', selectedStaff);
    try {
      setStatusMsg('Transcribing with Whisper...');
      const res = await fetch('/api/teacher-eval/process', { method: 'POST', body: fd });
      const data = await res.json() as { error?: string; evaluation?: EvalResult; teacherName?: string };
      if (!res.ok) throw new Error(data.error ?? 'Processing failed');
      setResult(data.evaluation ?? null); setTeacherName(data.teacherName ?? '');
      setStatus('done'); setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      refreshHistory();
    } catch (err: unknown) { setErrorMsg(err instanceof Error ? err.message : 'Unknown error'); setStatus('error'); }
  }

  async function handleGenerateSample() {
    if (!selectedStaff) return;
    setStatus('generating'); setStatusMsg('Generating classroom audio with OpenAI TTS...'); setResult(null); setErrorMsg('');
    try {
      const genRes = await fetch('/api/teacher-eval/generate-audio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staffId: selectedStaff, scriptIndex }) });
      const genData = await genRes.json() as { error?: string; fileUrl?: string; storagePath?: string; fileName?: string };
      if (!genRes.ok) throw new Error(genData.error ?? 'Audio generation failed');
      setStatus('processing'); setStatusMsg('Transcribing and evaluating...'); setScriptIndex(i => (i + 1) % 2);
      const procRes = await fetch('/api/teacher-eval/process', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staffId: selectedStaff, storagePath: genData.storagePath, fileUrl: genData.fileUrl, fileName: genData.fileName ?? 'sample.mp3' }) });
      const procData = await procRes.json() as { error?: string; evaluation?: EvalResult; teacherName?: string };
      if (!procRes.ok) throw new Error(procData.error ?? 'Evaluation failed');
      setResult(procData.evaluation ?? null); setTeacherName(procData.teacherName ?? '');
      setStatus('done'); refreshHistory();
    } catch (err: unknown) { setErrorMsg(err instanceof Error ? err.message : 'Unknown error'); setStatus('error'); }
  }

  const isProcessing = ['generating', 'uploading', 'processing'].includes(status);
  const selectedStaffName = staff.find(s => s.id === selectedStaff)?.name ?? '';

  return (
    <Layout title="Teacher Evaluation" subtitle="Classroom recording analysis and coaching feedback">
      <div style={{ maxWidth: 760, margin: '0 auto' }}>

        <div className="tabs">
          {(['upload', 'history'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`tab-btn${activeTab === tab ? ' active' : ''}`}>
              {tab === 'upload' ? 'Upload & Analyse' : `History (${history.length})`}
            </button>
          ))}
        </div>

        {activeTab === 'upload' && (
          <>
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 18 }}>
                <label className="label">SELECT TEACHER</label>
                <select className="input" style={{ height: 42 } as CSSProperties} value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)}>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name}{s.subject ? ` — ${s.subject}` : ''}</option>)}
                  {staff.length === 0 && <option value="">Loading...</option>}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                <div>
                  <label className="label">UPLOAD RECORDING</label>
                  <div onClick={() => fileRef.current?.click()} className={`upload-zone${file ? ' active' : ''}`}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>🎙</div>
                    {file ? (
                      <>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#4F46E5' }}>{file.name.slice(0, 24)}{file.name.length > 24 ? '...' : ''}</div>
                        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{(file.size / 1024 / 1024).toFixed(1)} MB · Click to change</div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>Click to upload audio</div>
                        <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 3 }}>MP3, WAV, M4A · Max 50MB</div>
                      </>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] ?? null)} />
                  <button onClick={handleUpload} disabled={!file || !selectedStaff || isProcessing} className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}>Analyse Upload</button>
                </div>

                <div>
                  <label className="label">AUTO-GENERATE SAMPLE</label>
                  <div className="upload-zone" style={{ cursor: 'default', borderStyle: 'solid', borderColor: '#E5E7EB', background: '#F9FAFB' }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>🤖</div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>No audio? No problem.</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>OpenAI TTS generates a classroom script, then runs the full pipeline automatically.</div>
                  </div>
                  <button onClick={handleGenerateSample} disabled={!selectedStaff || isProcessing} className="btn btn-ghost" style={{ width: '100%', marginTop: 8, background: '#F0FDF4', borderColor: '#BBF7D0', color: '#15803D' }}>Generate Sample Audio</button>
                </div>
              </div>

              {isProcessing ? (
                <div className="alert alert-info" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="spinner" style={{ width: 16, height: 16, border: '2px solid #C7D2FE', borderTop: '2px solid #4F46E5', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>Processing</div>
                    <div style={{ fontSize: 12, marginTop: 1 }}>{statusMsg}</div>
                  </div>
                </div>
              ) : (
                <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 28, border: '1px solid #F3F4F6' }}>
                  {[{ l: 'Teacher', v: selectedStaffName || '—' }, { l: 'Pipeline', v: 'Whisper → Claude' }, { l: 'Est. time', v: '30–90 sec' }].map(x => (
                    <div key={x.l}>
                      <div style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 2, fontWeight: 600, letterSpacing: '0.04em' }}>{x.l.toUpperCase()}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{x.v}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {status === 'error' && <div className="alert alert-error" style={{ marginBottom: 16 }}><strong>Error:</strong> {errorMsg}</div>}

            {status === 'done' && result && (
              <div className="card" style={{ border: '1.5px solid #F59E0B', padding: 0, overflow: 'hidden' }}>
                <div style={{ background: '#FFFBEB', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#A16207', letterSpacing: '0.05em', marginBottom: 4 }}>EVALUATION COMPLETE</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>{teacherName}</div>
                  </div>
                  <div className="score-circle" style={{ width: 72, height: 72, background: scoreBg(result.score), border: `3px solid ${scoreColor(result.score)}` }}>
                    <div style={{ fontSize: 26, fontWeight: 800, color: scoreColor(result.score), lineHeight: 1 }}>{result.score}</div>
                    <div style={{ fontSize: 10, color: scoreColor(result.score), fontWeight: 600 }}>/ 10</div>
                  </div>
                </div>
                <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { label: 'STRENGTHS', text: result.strengths, color: '#15803D', bg: '#DCFCE7', icon: '✓' },
                    { label: 'AREAS FOR IMPROVEMENT', text: result.improvements, color: '#A16207', bg: '#FEF9C3', icon: '↑' },
                    { label: 'COACHING FEEDBACK', text: result.feedback, color: '#4338CA', bg: '#EEF2FF', icon: '→' },
                  ].map(s => (
                    <div key={s.label} className="feedback-block" style={{ background: s.bg }}>
                      <div className="feedback-label" style={{ color: s.color }}><span>{s.icon}</span>{s.label}</div>
                      <div className="feedback-text">{s.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {history.length === 0 ? (
              <div className="card"><div className="empty-state"><div className="empty-state-icon">🎙</div><div className="empty-state-title">No evaluations yet</div><div className="empty-state-sub">Upload a recording or generate a sample.</div></div></div>
            ) : history.map(rec => {
              const evalData = rec.eval_report ? JSON.parse(rec.eval_report) as EvalResult : null;
              const score = rec.coaching_score ?? 0;
              return (
                <div key={rec.id} className="card">
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: evalData ? 14 : 0 }}>
                    <div><div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 3 }}>{rec.file_name.replace(/sample_classroom_\d+/, 'Sample Recording')}</div><div style={{ fontSize: 12, color: '#9CA3AF' }}>{new Date(rec.uploaded_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {score > 0 && <div className="score-circle" style={{ width: 40, height: 40, background: scoreBg(score), border: `2px solid ${scoreColor(score)}`, fontWeight: 800, fontSize: 14, color: scoreColor(score) }}>{score}</div>}
                      <span className={`badge badge-${rec.status === 'done' ? 'done' : rec.status === 'failed' ? 'failed' : 'pending'}`}>{rec.status.toUpperCase()}</span>
                    </div>
                  </div>
                  {evalData && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={{ background: '#DCFCE7', borderRadius: 8, padding: '10px 14px' }}><div style={{ fontSize: 10, fontWeight: 700, color: '#15803D', marginBottom: 4 }}>STRENGTHS</div><p style={{ fontSize: 12, color: '#374151', lineHeight: 1.5, margin: 0 }}>{evalData.strengths.slice(0, 140)}...</p></div>
                      <div style={{ background: '#EEF2FF', borderRadius: 8, padding: '10px 14px' }}><div style={{ fontSize: 10, fontWeight: 700, color: '#4338CA', marginBottom: 4 }}>COACHING</div><p style={{ fontSize: 12, color: '#374151', lineHeight: 1.5, margin: 0 }}>{evalData.feedback.slice(0, 140)}...</p></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
