'use client';

// PATH: app/admissions/call-analysis/page.tsx
// Counsellor call analysis — upload recording, view transcript + coaching score

import { useState, useEffect, useRef } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';

interface CallAnalysis {
  quality_score: number;
  summary: string;
  strengths: string;
  improvements: string;
  feedback: string;
  follow_up_suggested: boolean;
  follow_up_note?: string;
}

interface CallLog {
  id: string;
  staff?: { name: string; role: string } | null;
  inquiries?: { parent_name: string; child_name: string | null; target_class: string } | null;
  recording_url: string;
  transcript: string | null;
  quality_score: number | null;
  ai_feedback: string | null;
  duration_seconds: number | null;
  called_at: string;
  processed_at: string | null;
}

interface StaffMember { id: string; name: string; role: string; }

function scoreColor(s: number) { return s >= 8 ? '#15803D' : s >= 6 ? '#A16207' : '#B91C1C'; }
function scoreBg(s: number) { return s >= 8 ? '#DCFCE7' : s >= 6 ? '#FEF9C3' : '#FEE2E2'; }

type PageStatus = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

export default function CallAnalysisPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<PageStatus>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [result, setResult] = useState<{ analysis: CallAnalysis; transcript: string; counsellor: string } | null>(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<CallLog[]>([]);
  const [activeTab, setActiveTab] = useState<'upload' | 'history'>('upload');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/staff').then(r => r.json()).then(d => {
      const all = (d.staff ?? []) as StaffMember[];
      const counsellors = all.filter(s => s.role?.toLowerCase().includes('counsel') || s.role?.toLowerCase().includes('admin'));
      setStaff(counsellors.length > 0 ? counsellors : all);
      if (all.length > 0) setSelectedStaff(all[0].id);
    });
    loadHistory();
  }, []);

  function loadHistory() {
    fetch('/api/call-analysis/process').then(r => r.json()).then(d => setHistory(d.call_logs ?? []));
  }

  async function handleUpload() {
    if (!file) return;
    setStatus('uploading'); setStatusMsg('Uploading call recording...'); setResult(null); setError('');

    const fd = new FormData();
    fd.append('audio', file);
    if (selectedStaff) fd.append('staffId', selectedStaff);

    try {
      setStatusMsg('Transcribing with Whisper AI...');
      const res = await fetch('/api/call-analysis/process', { method: 'POST', body: fd });
      const data = await res.json() as { error?: string; analysis?: CallAnalysis; transcript?: string; counsellor?: string };

      if (!res.ok) throw new Error(data.error ?? 'Processing failed');
      setResult({ analysis: data.analysis!, transcript: data.transcript!, counsellor: data.counsellor! });
      setStatus('done');
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      loadHistory();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  }

  const isProcessing = status === 'uploading' || status === 'processing';

  return (
    <Layout
      title="Call Analysis"
      subtitle="Counsellor call quality scoring and coaching"
      actions={<Link href="/admissions/crm" className="btn btn-ghost btn-sm">← Back to CRM</Link>}
    >
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div className="tabs">
          {(['upload', 'history'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`tab-btn${activeTab === tab ? ' active' : ''}`}>
              {tab === 'upload' ? 'Analyse Call' : `History (${history.length})`}
            </button>
          ))}
        </div>

        {activeTab === 'upload' && (
          <>
            <div className="card" style={{ marginBottom: 16 }}>
              {staff.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <label className="label">SELECT COUNSELLOR</label>
                  <select className="input" value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)} style={{ height: 42 }}>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.name} — {s.role}</option>)}
                  </select>
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <label className="label">UPLOAD CALL RECORDING</label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className={`upload-zone${file ? ' active' : ''}`}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📞</div>
                  {file ? (
                    <>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#4F46E5' }}>{file.name.slice(0, 36)}{file.name.length > 36 ? '...' : ''}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{(file.size / 1024 / 1024).toFixed(1)} MB · Click to change</div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>Click to upload call recording</div>
                      <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 3 }}>MP3, WAV, M4A · Max 50MB · Counsellor-parent call</div>
                    </>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] ?? null)} />
              </div>

              {isProcessing ? (
                <div className="alert alert-info" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="spinner" style={{ width: 16, height: 16, border: '2px solid #C7D2FE', borderTop: '2px solid #4F46E5', flexShrink: 0 }} />
                  <div><div style={{ fontWeight: 700, fontSize: 13 }}>Processing</div><div style={{ fontSize: 12 }}>{statusMsg}</div></div>
                </div>
              ) : (
                <button onClick={handleUpload} disabled={!file || isProcessing} className="btn btn-primary" style={{ width: '100%' }}>
                  Analyse Call Recording
                </button>
              )}
            </div>

            {status === 'error' && <div className="alert alert-error" style={{ marginBottom: 16 }}><strong>Error:</strong> {error}</div>}

            {status === 'done' && result && (
              <div className="card" style={{ border: '1.5px solid #F59E0B', padding: 0, overflow: 'hidden' }}>
                <div style={{ background: '#FFFBEB', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#A16207', letterSpacing: '0.05em', marginBottom: 4 }}>CALL ANALYSIS COMPLETE</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>{result.counsellor}</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{result.analysis.summary}</div>
                  </div>
                  <div className="score-circle" style={{ width: 72, height: 72, background: scoreBg(result.analysis.quality_score), border: `3px solid ${scoreColor(result.analysis.quality_score)}` }}>
                    <div style={{ fontSize: 26, fontWeight: 800, color: scoreColor(result.analysis.quality_score), lineHeight: 1 }}>{result.analysis.quality_score}</div>
                    <div style={{ fontSize: 10, color: scoreColor(result.analysis.quality_score), fontWeight: 600 }}>/ 10</div>
                  </div>
                </div>
                <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { label: 'STRENGTHS', text: result.analysis.strengths, color: '#15803D', bg: '#DCFCE7', icon: '✓' },
                    { label: 'AREAS TO IMPROVE', text: result.analysis.improvements, color: '#A16207', bg: '#FEF9C3', icon: '↑' },
                    { label: 'COACHING FEEDBACK', text: result.analysis.feedback, color: '#4338CA', bg: '#EEF2FF', icon: '→' },
                  ].map(s => (
                    <div key={s.label} className="feedback-block" style={{ background: s.bg }}>
                      <div className="feedback-label" style={{ color: s.color }}><span>{s.icon}</span>{s.label}</div>
                      <div className="feedback-text">{s.text}</div>
                    </div>
                  ))}
                  {result.analysis.follow_up_suggested && result.analysis.follow_up_note && (
                    <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '12px 16px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#C2410C', marginBottom: 4 }}>📋 FOLLOW-UP RECOMMENDED</div>
                      <div style={{ fontSize: 13, color: '#374151' }}>{result.analysis.follow_up_note}</div>
                    </div>
                  )}
                  <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', marginBottom: 8 }}>TRANSCRIPT PREVIEW</div>
                    <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.65, fontFamily: 'monospace' }}>{result.transcript}</div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {history.length === 0 ? (
              <div className="card"><div className="empty-state"><div className="empty-state-icon">📞</div><div className="empty-state-title">No call analyses yet</div><div className="empty-state-sub">Upload a counsellor call recording to get started.</div></div></div>
            ) : history.map(log => {
              const analysis: CallAnalysis | null = log.ai_feedback ? JSON.parse(log.ai_feedback) as CallAnalysis : null;
              const score = log.quality_score ?? 0;
              const isExpanded = expandedLog === log.id;
              return (
                <div key={log.id} className="card">
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setExpandedLog(isExpanded ? null : log.id)}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 3 }}>
                        {log.staff?.name ?? 'Unknown counsellor'}
                        {log.inquiries && <span style={{ fontWeight: 400, color: '#9CA3AF' }}> · {log.inquiries.parent_name} ({log.inquiries.child_name ?? ''})</span>}
                      </div>
                      <div style={{ fontSize: 12, color: '#9CA3AF' }}>{new Date(log.called_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}{log.duration_seconds ? ` · ${Math.round(log.duration_seconds / 60)} min` : ''}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {score > 0 && <div className="score-circle" style={{ width: 40, height: 40, background: scoreBg(score), border: `2px solid ${scoreColor(score)}`, fontWeight: 800, fontSize: 14, color: scoreColor(score) }}>{score}</div>}
                      <span style={{ fontSize: 12, color: '#9CA3AF' }}>{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  {isExpanded && analysis && (
                    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontSize: 13, color: '#374151', fontStyle: 'italic' }}>{analysis.summary}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div style={{ background: '#DCFCE7', borderRadius: 8, padding: '10px 14px' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#15803D', marginBottom: 4 }}>STRENGTHS</div>
                          <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.5, margin: 0 }}>{analysis.strengths}</p>
                        </div>
                        <div style={{ background: '#EEF2FF', borderRadius: 8, padding: '10px 14px' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#4338CA', marginBottom: 4 }}>COACHING</div>
                          <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.5, margin: 0 }}>{analysis.feedback}</p>
                        </div>
                      </div>
                      {log.transcript && (
                        <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '10px 14px' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', marginBottom: 4 }}>TRANSCRIPT</div>
                          <p style={{ fontSize: 11, color: '#374151', lineHeight: 1.6, margin: 0, fontFamily: 'monospace' }}>{log.transcript.slice(0, 400)}{log.transcript.length > 400 ? '...' : ''}</p>
                        </div>
                      )}
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
