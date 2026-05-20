'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '@/components/Layout';
import { T } from '@/lib/i18n';
import { useLang } from '@/lib/useLang';

interface Eval { id: string; file_name: string; coaching_score: number | null; status: string; uploaded_at: string; eval_report?: string; }

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 8 ? '#15803D' : score >= 6 ? '#A16207' : '#B91C1C';
  const bg = score >= 8 ? '#DCFCE7' : score >= 6 ? '#FEF9C3' : '#FEE2E2';
  return (
    <div style={{ width: 44, height: 44, borderRadius: '50%', background: bg, border: `2px solid ${color}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, color, flexShrink: 0 }}>
      {score}
    </div>
  );
}

export default function TeacherEvalPage() {
  const { lang } = useLang();
  const [evals, setEvals] = useState<Eval[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [expanded, setExpanded] = useState<string|null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadEvals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/teacher-eval');
      if (res.ok) { const d = await res.json(); setEvals(d.evals ?? d.evaluations ?? []); }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadEvals(); }, [loadEvals]);

  async function uploadAudio(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('audio', file);
      fd.append('file_name', file.name);
      const res = await fetch('/api/teacher-eval', { method: 'POST', body: fd });
      if (res.ok) { await loadEvals(); }
    } catch { /* ignore */ }
    setUploading(false);
  }

  const avgScore = evals.filter(e => e.coaching_score != null).reduce((s, e, _, arr) => s + (e.coaching_score ?? 0) / arr.length, 0);

  return (
    <Layout title={T('teacher_eval', lang)} subtitle="AI-powered classroom quality scoring">
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: T('total_evaluations', lang as never), value: evals.length },
          { label: T('avg_score', lang as never), value: evals.length ? avgScore.toFixed(1) + '/10' : '—' },
          { label: T('excellent_label', lang as never), value: evals.filter(e => (e.coaching_score ?? 0) >= 8).length },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#4F46E5' }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Upload */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{T('upload_recording', lang as never)}</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
          Upload an audio file from a classroom session. Our AI analyses teaching quality and gives a score with coaching suggestions.
        </div>
        <input ref={fileRef} type="file" accept="audio/*" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadAudio(f); }} />
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="btn btn-primary"
          style={{ opacity: uploading ? 0.6 : 1, width: '100%' }}>
          {uploading ? T('loading', lang as never) : '📁 ' + T('upload_recording', lang as never)}
        </button>
      </div>

      {/* Eval list */}
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
      ) : evals.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🎙</div>
          <div className="empty-state-title">{T('no_evaluations_yet', lang as never)}</div>
          <div className="empty-state-sub">Upload a classroom audio file to get your first AI evaluation score.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {evals.map(ev => (
            <div key={ev.id} className="card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                onClick={() => setExpanded(expanded === ev.id ? null : ev.id)}>
                {ev.coaching_score != null ? <ScoreBadge score={ev.coaching_score} /> : (
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#F3F4F6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 12, color: '#9CA3AF' }}>{ev.status === 'processing' ? '⏳' : '—'}</span>
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{ev.file_name}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>
                    {new Date(ev.uploaded_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}{ev.status === 'processing' ? 'Processing…' : ev.status}
                  </div>
                </div>
                <span style={{ fontSize: 18, color: '#9CA3AF' }}>{expanded === ev.id ? '▲' : '▼'}</span>
              </div>
              {expanded === ev.id && ev.eval_report && (
                <div style={{ marginTop: 12, padding: '10px 12px', background: '#F9FAFB', borderRadius: 8,
                  fontSize: 13, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {ev.eval_report}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
