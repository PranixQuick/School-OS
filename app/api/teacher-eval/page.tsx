'use client';

import { useState, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';

const SCHOOL_ID = '00000000-0000-0000-0000-000000000001';

interface Staff { id: string; name: string; subject: string | null; }
interface EvalResult {
  score: number;
  strengths: string;
  improvements: string;
  feedback: string;
}
interface Recording {
  id: string;
  file_name: string;
  coaching_score: number | null;
  eval_report: string | null;
  status: string;
  uploaded_at: string;
  staff_id: string;
}

type UploadStatus = 'idle' | 'uploading' | 'done' | 'error';

const BTN: CSSProperties = { border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 };

const SCORE_COLOR = (s: number) =>
  s >= 8 ? '#0F6E56' : s >= 6 ? '#854F0B' : '#993C1D';
const SCORE_BG = (s: number) =>
  s >= 8 ? '#E1F5EE' : s >= 6 ? '#FAEEDA' : '#FAECE7';

export default function TeacherEvalPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selectedStaff, setSelectedStaff] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [result, setResult] = useState<EvalResult | null>(null);
  const [teacherName, setTeacherName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [history, setHistory] = useState<Recording[]>([]);
  const [activeTab, setActiveTab] = useState<'upload' | 'history'>('upload');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/teacher-eval/history`)
      .then(r => r.json())
      .then(d => setHistory(d.recordings ?? []));

    // Fetch staff from Supabase via API
    fetch(`/api/staff`)
      .then(r => r.json())
      .then(d => {
        const teachers = (d.staff ?? []).filter((s: Staff & { role: string }) => s.role === 'teacher' || s.role === 'admin');
        setStaff(teachers);
        if (teachers.length > 0) setSelectedStaff(teachers[0].id);
      });
  }, []);

  async function handleSubmit() {
    if (!file || !selectedStaff) return;
    setStatus('uploading');
    setResult(null);
    setErrorMsg('');

    const fd = new FormData();
    fd.append('audio', file);
    fd.append('staffId', selectedStaff);

    try {
      const res = await fetch('/api/teacher-eval/process', { method: 'POST', body: fd });
      const data = await res.json() as { error?: string; evaluation?: EvalResult; teacherName?: string };
      if (!res.ok) throw new Error(data.error ?? 'Processing failed');
      setResult(data.evaluation ?? null);
      setTeacherName(data.teacherName ?? '');
      setStatus('done');
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      // Refresh history
      fetch('/api/teacher-eval/history').then(r => r.json()).then(d => setHistory(d.recordings ?? []));
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  }

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
            Upload a classroom audio recording. Whisper transcribes it, Claude evaluates teaching quality and generates actionable coaching feedback.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid #E8E6DF' }}>
          {(['upload', 'history'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ ...BTN, padding: '10px 20px', background: 'none', fontSize: 14, color: activeTab === tab ? '#854F0B' : '#888780', borderBottom: activeTab === tab ? '2px solid #854F0B' : '2px solid transparent', marginBottom: -1, borderRadius: 0 }}>
              {tab === 'upload' ? 'Upload & Analyse' : `History (${history.length})`}
            </button>
          ))}
        </div>

        {activeTab === 'upload' && (
          <>
            {/* Upload card */}
            <div style={{ background: '#fff', border: '1px solid #E8E6DF', borderRadius: 16, padding: 28, marginBottom: 20 }}>

              {/* Teacher selector */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#5F5E5A', letterSpacing: '0.05em', marginBottom: 7 }}>SELECT TEACHER</label>
                <select value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)}
                  style={{ width: '100%', height: 42, borderRadius: 8, border: '1px solid #D3D1C7', background: '#FAFAF8', fontSize: 14, padding: '0 12px', outline: 'none' }}>
                  {staff.map(s => (
                    <option key={s.id} value={s.id}>{s.name}{s.subject ? ` — ${s.subject}` : ''}</option>
                  ))}
                  {staff.length === 0 && <option value="">Loading teachers...</option>}
                </select>
              </div>

              {/* File upload */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#5F5E5A', letterSpacing: '0.05em', marginBottom: 7 }}>AUDIO RECORDING</label>
                <div
                  onClick={() => fileRef.current?.click()}
                  style={{
                    border: `2px dashed ${file ? '#854F0B' : '#D3D1C7'}`,
                    borderRadius: 10,
                    padding: '28px 20px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: file ? '#FAEEDA' : '#FAFAF8',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: 28, marginBottom: 8 }}>🎙</div>
                  {file ? (
                    <>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#854F0B' }}>{file.name}</div>
                      <div style={{ fontSize: 12, color: '#888780', marginTop: 4 }}>
                        {(file.size / (1024 * 1024)).toFixed(1)} MB · Click to change
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#2C2C2A' }}>Click to upload audio</div>
                      <div style={{ fontSize: 12, color: '#888780', marginTop: 4 }}>MP3, WAV, M4A · Max 50MB</div>
                    </>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="audio/mp3,audio/mpeg,audio/wav,audio/x-wav,audio/m4a,audio/mp4"
                  style={{ display: 'none' }}
                  onChange={e => setFile(e.target.files?.[0] ?? null)}
                />
              </div>

              {/* Info strip */}
              <div style={{ background: '#F1EFE8', borderRadius: 8, padding: '12px 16px', display: 'flex', gap: 32, marginBottom: 24 }}>
                {[
                  { label: 'Teacher', value: selectedStaffName || '—' },
                  { label: 'File', value: file ? file.name.slice(0, 20) + (file.name.length > 20 ? '...' : '') : 'None selected' },
                  { label: 'Pipeline', value: 'Whisper → Claude' },
                ].map(item => (
                  <div key={item.label}>
                    <div style={{ fontSize: 10, color: '#888780', marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#2C2C2A' }}>{item.value}</div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleSubmit}
                disabled={!file || !selectedStaff || status === 'uploading'}
                style={{
                  ...BTN,
                  width: '100%', height: 48, borderRadius: 10,
                  background: (!file || !selectedStaff) ? '#D3D1C7' : status === 'uploading' ? '#EF9F27' : '#854F0B',
                  color: '#fff', fontSize: 15,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                }}
              >
                {status === 'uploading' ? <><Spinner color="#fff" /> Transcribing and analysing — please wait (30–90s)...</> : 'Analyse Recording with AI'}
              </button>
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
                {/* Score header */}
                <div style={{ background: '#FAEEDA', padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#854F0B', letterSpacing: '0.05em', marginBottom: 4 }}>EVALUATION COMPLETE</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#1A1A18' }}>{teacherName}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      width: 72, height: 72, borderRadius: '50%',
                      background: SCORE_BG(result.score),
                      border: `3px solid ${SCORE_COLOR(result.score)}`,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: SCORE_COLOR(result.score), lineHeight: 1 }}>{result.score}</div>
                      <div style={{ fontSize: 9, color: SCORE_COLOR(result.score), fontWeight: 600 }}>/ 10</div>
                    </div>
                  </div>
                </div>

                {/* Feedback sections */}
                <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {[
                    { label: 'STRENGTHS', text: result.strengths, color: '#0F6E56', bg: '#E1F5EE', icon: '✓' },
                    { label: 'AREAS FOR IMPROVEMENT', text: result.improvements, color: '#854F0B', bg: '#FAEEDA', icon: '↑' },
                    { label: 'COACHING FEEDBACK', text: result.feedback, color: '#3C3489', bg: '#EEEDFE', icon: '→' },
                  ].map(section => (
                    <div key={section.label} style={{ background: section.bg, borderRadius: 10, padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: section.color }}>{section.icon}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: section.color, letterSpacing: '0.05em' }}>{section.label}</span>
                      </div>
                      <p style={{ fontSize: 14, color: '#2C2C2A', lineHeight: 1.7, margin: 0 }}>{section.text}</p>
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
                No recordings yet. Upload your first recording to get started.
              </div>
            )}
            {history.map(rec => {
              const evalData = rec.eval_report ? JSON.parse(rec.eval_report) as EvalResult : null;
              const date = new Date(rec.uploaded_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
              return (
                <div key={rec.id} style={{ background: '#fff', border: '1px solid #E8E6DF', borderRadius: 12, padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: evalData ? 16 : 0 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#1A1A18', marginBottom: 4 }}>{rec.file_name}</div>
                      <div style={{ fontSize: 12, color: '#888780' }}>{date}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {rec.coaching_score && (
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: SCORE_BG(rec.coaching_score), border: `2px solid ${SCORE_COLOR(rec.coaching_score)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: SCORE_COLOR(rec.coaching_score) }}>
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
                        <p style={{ fontSize: 12, color: '#2C2C2A', lineHeight: 1.5, margin: 0 }}>{evalData.strengths.slice(0, 120)}...</p>
                      </div>
                      <div style={{ background: '#EEEDFE', borderRadius: 8, padding: '10px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#3C3489', marginBottom: 4 }}>COACHING</div>
                        <p style={{ fontSize: 12, color: '#2C2C2A', lineHeight: 1.5, margin: 0 }}>{evalData.feedback.slice(0, 120)}...</p>
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
      <div style={{ width: 16, height: 16, border: `2px solid ${color}40`, borderTop: `2px solid ${color}`, borderRadius: '50%', animation: 'te_spin 0.7s linear infinite' }} />
    </>
  );
}
