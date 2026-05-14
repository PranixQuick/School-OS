'use client';
// app/admin/regulatory/page.tsx
// Batch 5A — Regulatory Intelligence dashboard.
// Shows institution-mapped regulatory sources, urgent notices, full feed.

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface RegulatoryNotice {
  id: string; source_code: string; title: string; summary: string;
  url: string; published_at: string | null; scraped_at: string;
  notice_type: string; priority: string; acknowledged?: boolean;
}

interface Source {
  source_code: string; display_name: string; last_scraped_at: string | null;
  recent_notices: number; is_primary: boolean; active: boolean;
}

const PRIORITY_COLOR: Record<string, [string, string]> = {
  urgent: ['#FEF2F2','#DC2626'],
  high:   ['#FEF9C3','#B45309'],
  normal: ['#F0F9FF','#0369A1'],
  low:    ['#F9FAFB','#9CA3AF'],
};

const TYPE_LABELS: Record<string, string> = {
  all: 'All', exam_schedule: 'Exam Schedules', scholarship_deadline: 'Scholarships',
  compliance_deadline: 'Compliance', circular: 'Circulars', result: 'Results',
  hall_ticket: 'Hall Tickets', general: 'General',
};

const SOURCE_BADGE: Record<string, string> = {
  CBSE_ACADEMIC:'#EEF2FF', CBSE_EXAM:'#EEF2FF', BSE_TELANGANA:'#FFF7ED',
  NCERT:'#F0FDF4', UGC:'#FDF4FF', AICTE:'#FFF1F2', JNTUH:'#FFF7ED',
  ICDS_WCD:'#ECFDF5', NSP:'#F0F9FF', ICSE:'#EEF2FF',
};

export default function RegulatoryPage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [notices, setNotices] = useState<RegulatoryNotice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [setting_up, setSettingUp] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [setupResult, setSetupResult] = useState<{ mapped_sources?: string[] } | null>(null);

  const loadSources = useCallback(async () => {
    const res = await fetch('/api/admin/regulatory/sources');
    const d = await res.json() as { sources?: Source[]; configured?: boolean };
    setSources(d.sources ?? []);
    setConfigured(d.configured ?? false);
    return d.configured ?? false;
  }, []);

  const loadNotices = useCallback(async (type = 'all') => {
    const params = new URLSearchParams({ limit: '30' });
    if (type !== 'all') params.set('notice_type', type);
    const res = await fetch('/api/admin/regulatory/notices?' + params.toString());
    const d = await res.json() as { notices?: RegulatoryNotice[]; total?: number };
    setNotices(d.notices ?? []);
    setTotal(d.total ?? 0);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const isConfigured = await loadSources();
      if (isConfigured) await loadNotices();
      setLoading(false);
    })();
  }, [loadSources, loadNotices]);

  useEffect(() => { if (configured) void loadNotices(filterType); }, [filterType, configured, loadNotices]);

  async function setupRegulatory() {
    setSettingUp(true);
    const res = await fetch('/api/admin/regulatory/setup', { method: 'POST' });
    const d = await res.json() as { mapped_sources?: string[]; error?: string };
    if (res.ok) {
      setSetupResult(d);
      setConfigured(true);
      await loadSources();
      await loadNotices();
    }
    setSettingUp(false);
  }

  async function scrapeNow() {
    setScraping(true);
    await fetch('/api/admin/regulatory/scrape-now', { method: 'POST' });
    await loadSources();
    await loadNotices(filterType);
    setScraping(false);
  }

  async function acknowledge(id: string) {
    await fetch(`/api/admin/regulatory/notices/${id}/acknowledge`, { method: 'POST' });
    setNotices(prev => prev.map(n => n.id === id ? { ...n, acknowledged: true } : n));
  }

  const urgentNotices = notices.filter(n => (n.priority === 'urgent' || n.priority === 'high') && !n.acknowledged);
  const lastUpdated = sources.reduce((latest, s) => {
    if (!s.last_scraped_at) return latest;
    return !latest || s.last_scraped_at > latest ? s.last_scraped_at : latest;
  }, null as string | null);

  const cardStyle = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, marginBottom: 14 };
  const inputStyle = { padding: '5px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 12 };

  if (loading) return (
    <Layout title="Regulatory Intelligence">
      <div style={{ padding: 40, color: '#9CA3AF', textAlign: 'center' }}>Loading…</div>
    </Layout>
  );

  // Setup screen
  if (!configured) return (
    <Layout title="Regulatory Intelligence" subtitle="Track updates from CBSE, State Boards, UGC and more">
      <div style={{ maxWidth: 520, margin: '40px auto', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 10 }}>
          Set up Regulatory Intelligence
        </div>
        <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.7, marginBottom: 28 }}>
          Based on your institution type, we&apos;ll automatically track relevant updates
          from CBSE, State Boards, UGC, AICTE, and other regulatory bodies.
          New notices are scraped daily and classified by AI.
        </div>
        {setupResult?.mapped_sources && (
          <div style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 8, padding: '10px 16px', marginBottom: 20, fontSize: 12, color: '#065F46', fontWeight: 600 }}>
            ✓ Mapped {setupResult.mapped_sources.length} sources: {setupResult.mapped_sources.join(', ')}
          </div>
        )}
        <button onClick={() => void setupRegulatory()} disabled={setting_up}
          style={{ padding: '12px 32px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          {setting_up ? 'Setting up…' : '✓ Enable Regulatory Tracking'}
        </button>
      </div>
    </Layout>
  );

  return (
    <Layout title="Regulatory Intelligence" subtitle={`${sources.length} sources tracked`}
      actions={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {lastUpdated && <span style={{ fontSize: 11, color: '#9CA3AF' }}>Updated {new Date(lastUpdated).toLocaleDateString('en-IN')}</span>}
          <button onClick={() => void scrapeNow()} disabled={scraping}
            style={{ padding: '6px 14px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            {scraping ? '⏳ Checking…' : '🔄 Check for Updates'}
          </button>
        </div>
      }
    >
      {/* Priority alerts bar */}
      {urgentNotices.length === 0 ? (
        <div style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: '#065F46', fontWeight: 600, marginBottom: 16 }}>
          ✓ No urgent regulatory notices
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#B91C1C', marginBottom: 8 }}>
            ⚠️ {urgentNotices.length} URGENT NOTICE{urgentNotices.length !== 1 ? 'S' : ''}
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6 }}>
            {urgentNotices.slice(0, 5).map(n => (
              <div key={n.id} style={{ background: PRIORITY_COLOR[n.priority][0], border: `1px solid ${PRIORITY_COLOR[n.priority][1]}40`, borderRadius: 8, padding: '10px 14px', minWidth: 240, flexShrink: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: PRIORITY_COLOR[n.priority][1], marginBottom: 4 }}>
                  {n.source_code} · {n.priority.toUpperCase()}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', lineHeight: 1.4, marginBottom: 8 }}>
                  {n.title.slice(0, 80)}{n.title.length > 80 ? '…' : ''}
                </div>
                <a href={n.url} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 10, color: '#4F46E5', fontWeight: 700, textDecoration: 'none' }}>
                  View →
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {Object.entries(TYPE_LABELS).map(([k, label]) => (
          <button key={k} onClick={() => setFilterType(k)}
            style={{ padding: '5px 12px', border: `1px solid ${filterType === k ? '#4F46E5' : '#E5E7EB'}`, borderRadius: 20, fontSize: 11, fontWeight: filterType === k ? 700 : 400, color: filterType === k ? '#4F46E5' : '#6B7280', background: filterType === k ? '#EEF2FF' : '#fff', cursor: 'pointer' }}>
            {label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9CA3AF', alignSelf: 'center' }}>{total} notices</span>
      </div>

      {/* Notices feed */}
      {notices.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📰</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>No notices yet</div>
          <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 6 }}>
            Click &quot;Check for Updates&quot; to fetch the latest notices from your tracked sources.
          </div>
        </div>
      ) : (
        <div>
          {notices.map(n => {
            const [bg, fg] = PRIORITY_COLOR[n.priority] ?? PRIORITY_COLOR.normal;
            return (
              <div key={n.id} style={{ ...cardStyle, opacity: n.acknowledged ? 0.55 : 1, borderLeft: `3px solid ${fg}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 5, flexWrap: 'wrap' }}>
                      <span style={{ background: SOURCE_BADGE[n.source_code] ?? '#F3F4F6', fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 4, color: '#374151' }}>
                        {n.source_code.replace('_', ' ')}
                      </span>
                      <span style={{ background: bg, color: fg, fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4 }}>
                        {n.priority.toUpperCase()}
                      </span>
                      <span style={{ fontSize: 9, color: '#9CA3AF' }}>
                        {n.notice_type.replace('_',' ')}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', lineHeight: 1.4, marginBottom: 4 }}>
                      {n.title.slice(0, 100)}{n.title.length > 100 ? '…' : ''}
                    </div>
                    {n.summary && n.summary !== n.title && (
                      <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.5, marginBottom: 4 }}>{n.summary}</div>
                    )}
                    <div style={{ fontSize: 10, color: '#9CA3AF' }}>
                      {n.published_at ? new Date(n.published_at).toLocaleDateString('en-IN') : ''}
                      {n.published_at ? ' · ' : ''}
                      Scraped {new Date(n.scraped_at).toLocaleDateString('en-IN')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <a href={n.url} target="_blank" rel="noopener noreferrer"
                      style={{ padding: '5px 10px', background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 10, fontWeight: 700, color: '#374151', textDecoration: 'none' }}>
                      🔗 View
                    </a>
                    {!n.acknowledged && (
                      <button onClick={() => void acknowledge(n.id)}
                        style={{ padding: '5px 10px', background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 6, fontSize: 10, fontWeight: 700, color: '#065F46', cursor: 'pointer' }}>
                        ✓ Ack
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sources panel */}
      <div style={cardStyle}>
        <button onClick={() => setSourcesOpen(o => !o)}
          style={{ display: 'flex', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#374151', padding: 0 }}>
          <span>📡 Tracked Sources ({sources.length})</span>
          <span>{sourcesOpen ? '▲' : '▼'}</span>
        </button>
        {sourcesOpen && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sources.map(s => (
              <div key={s.source_code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: '#F9FAFB', borderRadius: 7 }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{s.display_name}</span>
                  {s.is_primary && <span style={{ fontSize: 9, background: '#EEF2FF', color: '#4F46E5', fontWeight: 700, padding: '1px 5px', borderRadius: 3, marginLeft: 6 }}>PRIMARY</span>}
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#9CA3AF' }}>
                  <span>{s.recent_notices} notices (30d)</span>
                  <span>{s.last_scraped_at ? 'Scraped ' + new Date(s.last_scraped_at).toLocaleDateString('en-IN') : 'Never scraped'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
