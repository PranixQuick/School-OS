'use client';
import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import { T } from '@/lib/i18n';
import { useLang } from '@/lib/useLang';

interface Report { id: string; student_name: string; class: string; section?: string;
  narrative?: string; status: string; generated_at?: string; overall_grade?: string; }

export default function ReportCardsPage() {
  const { lang } = useLang();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState('');

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/report-cards');
      if (res.ok) { const d = await res.json(); setReports(d.reports ?? d.narratives ?? []); }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  async function generateAll() {
    setGenerating(true); setGenResult('');
    try {
      const res = await fetch('/api/report-cards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const d = await res.json();
      setGenResult(d.message ?? `Generated ${d.count ?? 0} reports`);
      await loadReports();
    } catch { setGenResult('Failed to generate — try again'); }
    setGenerating(false);
  }

  const ready = reports.filter(r => r.status === 'ready' || r.narrative);

  return (
    <Layout title={T('report_cards', lang)} subtitle="AI-generated narrative reports for every student"
      actions={<button onClick={generateAll} disabled={generating} className="btn btn-primary btn-sm">
        {generating ? '⏳ Generating…' : '✨ Generate All Reports'}
      </button>}>

      {genResult && (
        <div style={{ background: '#DCFCE7', border: '1px solid #BBF7D0', borderRadius: 8,
          padding: '8px 12px', marginBottom: 12, fontSize: 13, color: '#15803D', fontWeight: 600 }}>
          ✓ {genResult}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Reports Ready', value: ready.length, color: '#15803D', bg: '#DCFCE7' },
          { label: 'Pending', value: reports.length - ready.length, color: '#A16207', bg: '#FEF9C3' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading reports…</div>
      ) : reports.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📄</div>
          <div className="empty-state-title">No reports generated yet</div>
          <div className="empty-state-sub">Tap "Generate All Reports" to create AI narratives for all students.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {reports.map(r => (
            <div key={r.id} className="card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#EEF2FF', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#4F46E5', fontSize: 13 }}>
                  {r.student_name[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{r.student_name}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>Class {r.class}{r.section ? '-' + r.section : ''}</div>
                </div>
                {r.overall_grade && (
                  <div style={{ fontWeight: 800, fontSize: 16, color: '#4F46E5' }}>{r.overall_grade}</div>
                )}
                <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                  background: r.narrative ? '#DCFCE7' : '#F3F4F6',
                  color: r.narrative ? '#15803D' : '#9CA3AF' }}>
                  {r.narrative ? 'READY' : 'PENDING'}
                </span>
              </div>
              {r.narrative && (
                <div style={{ marginTop: 10, fontSize: 13, color: '#4B5563', lineHeight: 1.6,
                  padding: '8px 10px', background: '#F9FAFB', borderRadius: 8 }}>
                  {r.narrative.length > 200 ? r.narrative.slice(0, 200) + '…' : r.narrative}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
