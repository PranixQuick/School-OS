'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';

interface Briefing {
  id: string; date: string; briefing_text: string;
  kpi_snapshot: Record<string, string | number>; generated_at: string;
}

export default function BriefingPage() {
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState<Briefing | null>(null);

  useEffect(() => { fetchBriefings(); }, []);

  async function fetchBriefings() {
    const res = await fetch('/api/briefing/generate');
    const d = await res.json() as { briefings: Briefing[] };
    const list = d.briefings ?? [];
    setBriefings(list);
    if (list.length > 0) setSelected(list[0]);
  }

  async function generateBriefing() {
    setGenerating(true);
    try {
      const res = await fetch('/api/briefing/generate', { method: 'POST' });
      const d = await res.json() as { briefing: Briefing };
      if (d.briefing) {
        setBriefings(prev => [d.briefing, ...prev.filter(b => b.date !== d.briefing.date)]);
        setSelected(d.briefing);
      }
    } finally { setGenerating(false); }
  }

  const kpiLabels: Record<string, string> = {
    total_students: 'Students', attendance_pct: 'Attendance %',
    pending_fees_amount: 'Pending Fees', new_leads_week: 'New Leads',
    high_priority_leads: 'High Priority', avg_eval_score: 'Avg Eval Score',
    teachers_present: 'Teachers Today',
  };

  return (
    <Layout
      title="Principal Briefing"
      subtitle="Daily AI-generated school intelligence report"
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/automation" className="btn btn-ghost btn-sm">← Automation</Link>
          <button onClick={generateBriefing} disabled={generating} className="btn btn-primary btn-sm">
            {generating ? 'Generating...' : '✦ Generate Today\'s Briefing'}
          </button>
        </div>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16 }}>

        {/* Sidebar: past briefings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', marginBottom: 4 }}>PAST BRIEFINGS</div>
          {briefings.length === 0 && (
            <div className="card-sm" style={{ color: '#9CA3AF', fontSize: 13 }}>No briefings yet. Generate the first one.</div>
          )}
          {briefings.map(b => (
            <button key={b.id} onClick={() => setSelected(b)}
              style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${selected?.id === b.id ? '#4F46E5' : '#E5E7EB'}`, background: selected?.id === b.id ? '#EEF2FF' : '#fff', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: selected?.id === b.id ? '#4F46E5' : '#111827' }}>
                {new Date(b.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                {new Date(b.generated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </button>
          ))}
        </div>

        {/* Main briefing content */}
        <div>
          {!selected ? (
            <div className="card"><div className="empty-state"><div className="empty-state-icon">📋</div><div className="empty-state-title">No briefing selected</div><div className="empty-state-sub">Click "Generate Today's Briefing" to create one.</div></div></div>
          ) : (
            <>
              {/* KPI snapshot */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                {Object.entries(selected.kpi_snapshot).map(([k, v]) => (
                  <div key={k} className="card-sm">
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.04em', marginBottom: 4 }}>{kpiLabels[k] ?? k}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#111827' }}>
                      {k === 'pending_fees_amount' ? `₹${Math.round(Number(v) / 1000)}K` : String(v)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Briefing text */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>
                      {new Date(selected.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                    <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>Generated at {new Date(selected.generated_at).toLocaleTimeString('en-IN')}</div>
                  </div>
                  <span className="badge badge-done">AI Generated</span>
                </div>
                <div style={{ fontSize: 15, color: '#374151', lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>
                  {selected.briefing_text}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
