'use client';
// app/admin/meals/page.tsx
// Batch 4A — Mid-day meal attendance tracking.
// Guard: meal_tracking_enabled feature flag.
// Date selector + class/section selector → student roster with meal checkboxes.
// Monthly summary tab: date | enrolled | meals served | coverage %.

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface StudentMeal { student_id: string; name: string; roll_number: string | null; class: string; section: string; meal_served: boolean | null; }
interface SummaryRow { date: string; meals_served: number; total_enrolled: number; coverage_pct: number; }
type Tab = 'daily' | 'summary';

function today() { return new Date().toISOString().slice(0, 10); }

export default function MealsPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('daily');
  const [date, setDate] = useState(today());
  const [classFilter, setClassFilter] = useState('');
  const [section, setSection] = useState('');
  const [roster, setRoster] = useState<StudentMeal[]>([]);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [sumLoading, setSumLoading] = useState(false);

  useEffect(() => {
    void fetch('/api/admin/institution-config')
      .then(r => r.json()).then((d: { feature_flags?: Record<string, unknown> }) => {
        setEnabled(!!(d.feature_flags?.meal_tracking_enabled));
      }).catch(() => setEnabled(false));
  }, []);

  const loadRoster = useCallback(async () => {
    if (!enabled) return;
    setLoading(true); setSaveStatus(null);
    const params = new URLSearchParams({ date });
    if (classFilter) params.set('class', classFilter);
    if (section) params.set('section', section);
    const res = await fetch('/api/admin/meal-attendance?' + params.toString());
    const d = await res.json() as { roster?: StudentMeal[] };
    const students = d.roster ?? [];
    setRoster(students);
    const defaultChecks: Record<string, boolean> = {};
    students.forEach(s => { defaultChecks[s.student_id] = s.meal_served ?? true; });
    setChecks(defaultChecks);
    setLoading(false);
  }, [date, classFilter, section, enabled]);

  useEffect(() => { if (enabled) void loadRoster(); }, [enabled, loadRoster]);

  const loadSummary = useCallback(async () => {
    setSumLoading(true);
    const from = new Date(Date.now() - 30*24*60*60*1000).toISOString().slice(0,10);
    const to = today();
    const res = await fetch(`/api/admin/meal-attendance/summary?from=${from}&to=${to}`);
    const d = await res.json() as { summary?: SummaryRow[] };
    setSummary(d.summary ?? []);
    setSumLoading(false);
  }, []);

  useEffect(() => { if (tab === 'summary' && enabled) void loadSummary(); }, [tab, enabled, loadSummary]);

  async function save() {
    setSaving(true); setSaveStatus(null);
    const records = roster.map(s => ({ student_id: s.student_id, meal_served: checks[s.student_id] ?? true }));
    const res = await fetch('/api/admin/meal-attendance', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, records }),
    });
    const d = await res.json() as { saved?: number; error?: string };
    setSaveStatus(res.ok ? `✓ Saved ${d.saved} records` : `Error: ${d.error}`);
    setSaving(false);
  }

  const cardStyle = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, marginBottom: 20 };
  const served = roster.filter(s => checks[s.student_id] ?? true).length;

  if (enabled === null) return <Layout title="Meal Attendance"><div style={{ padding: 40, color: '#9CA3AF' }}>Loading...</div></Layout>;
  if (!enabled) return (
    <Layout title="Meal Attendance">
      <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🍽</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#374151' }}>Meal tracking not enabled</div>
        <div style={{ fontSize: 12, marginTop: 6 }}>Enable "Mid-day meal tracking" in Settings → Institution to use this feature.</div>
      </div>
    </Layout>
  );

  return (
    <Layout title="Meal Attendance" subtitle="Track mid-day meal distribution">

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['daily','summary'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '6px 16px', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: tab===t ? '#4F46E5' : '#fff', color: tab===t ? '#fff' : '#374151' }}>
            {t === 'daily' ? '📅 Daily' : '📊 Monthly Summary'}
          </button>
        ))}
      </div>

      {tab === 'daily' && (
        <div style={cardStyle}>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', marginBottom: 3 }}>DATE</div>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                style={{ padding: '5px 8px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12 }} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', marginBottom: 3 }}>CLASS</div>
              <input value={classFilter} onChange={e => setClassFilter(e.target.value)} placeholder="e.g. 5"
                style={{ padding: '5px 8px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, width: 60 }} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', marginBottom: 3 }}>SECTION</div>
              <input value={section} onChange={e => setSection(e.target.value)} placeholder="A"
                style={{ padding: '5px 8px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, width: 60 }} />
            </div>
            <button onClick={() => void loadRoster()} style={{ marginTop: 16, padding: '6px 14px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Load</button>
          </div>

          {loading ? <div style={{ color: '#9CA3AF', fontSize: 12, padding: 20 }}>Loading roster...</div> : roster.length === 0 ? (
            <div style={{ color: '#9CA3AF', fontSize: 12, padding: 20, textAlign: 'center' }}>No students found. Select a class and click Load.</div>
          ) : (
            <>
              {/* Summary row */}
              <div style={{ background: '#F0FDF4', borderRadius: 8, padding: '8px 14px', marginBottom: 14, fontSize: 12, color: '#166534', fontWeight: 700 }}>
                🍽 {served} of {roster.length} students receiving meal today
              </div>
              {/* Roster table */}
              <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB' }}>
                      {['Roll','Name','Class','✅ Meal Served'].map(h => (
                        <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, fontSize: 10, color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map(s => (
                      <tr key={s.student_id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td style={{ padding: '7px 10px', color: '#6B7280' }}>{s.roll_number ?? '—'}</td>
                        <td style={{ padding: '7px 10px', fontWeight: 600 }}>{s.name}</td>
                        <td style={{ padding: '7px 10px', color: '#6B7280' }}>{s.class}-{s.section}</td>
                        <td style={{ padding: '7px 10px' }}>
                          <input type="checkbox" checked={checks[s.student_id] ?? true}
                            onChange={e => setChecks(prev => ({ ...prev, [s.student_id]: e.target.checked }))}
                            style={{ width: 16, height: 16, cursor: 'pointer' }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button onClick={() => void save()} disabled={saving}
                  style={{ padding: '7px 18px', background: '#065F46', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Saving...' : '💾 Save Attendance'}
                </button>
                {saveStatus && <span style={{ fontSize: 11, color: saveStatus.startsWith('✓') ? '#065F46' : '#B91C1C' }}>{saveStatus}</span>}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'summary' && (
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 14 }}>Last 30 Days</div>
          {sumLoading ? <div style={{ color: '#9CA3AF', fontSize: 12 }}>Loading...</div> : summary.length === 0 ? (
            <div style={{ color: '#9CA3AF', fontSize: 12 }}>No meal records in the last 30 days.</div>
          ) : (
            <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#F9FAFB' }}>
                    {['Date','Enrolled','Meals Served','Coverage'].map(h => (
                      <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, fontSize: 10, color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summary.map(r => (
                    <tr key={r.date} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '7px 10px' }}>{r.date}</td>
                      <td style={{ padding: '7px 10px', color: '#6B7280' }}>{r.total_enrolled}</td>
                      <td style={{ padding: '7px 10px', fontWeight: 700, color: '#065F46' }}>{r.meals_served}</td>
                      <td style={{ padding: '7px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ flex: 1, background: '#E5E7EB', borderRadius: 3, height: 6 }}>
                            <div style={{ width: `${r.coverage_pct}%`, background: r.coverage_pct >= 80 ? '#16A34A' : r.coverage_pct >= 50 ? '#CA8A04' : '#DC2626', height: 6, borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, minWidth: 30 }}>{r.coverage_pct}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
