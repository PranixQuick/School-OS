'use client';

// PATH: app/automation/substitutes/page.tsx
//
// Principal substitute-assignment admin.
// Two sections:
//   1. Periods needing a substitute today (from /api/principal/substitute/list-needed)
//      For each: pick an eligible teacher + reason → POST /api/principal/substitute/assign
//   2. Already-assigned today (fetched from same endpoint with a future flag, or simply
//      derived; for MVP we fetch separately via a small helper)
//
// Eligible substitute pool: active staff with role='teacher' belonging to this school.
// We fetch this once on mount (separate small endpoint? — inlined via /api/principal/teacher-presence
// which already returns teachers for this school, filtered in the page).

import { useState, useEffect, FormEvent } from 'react';
import Layout from '@/components/Layout';

interface NeedRow {
  late_event_id: string;
  expected_at: string;
  delta_minutes: number;
  original_staff: { id: string; name: string; subject: string | null; phone: string | null } | null;
  period: { id: string; period: number; day_of_week: number; start_time: string; end_time: string } | null;
  class: { id: string; grade_level: string; section: string } | null;
  subject: { id: string; name: string; code: string } | null;
}

interface EligibleTeacher {
  id: string;
  name: string;
  subject: string | null;
}

export default function SubstitutesAdmin() {
  const [needs, setNeeds] = useState<NeedRow[]>([]);
  const [eligible, setEligible] = useState<EligibleTeacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [pickedSub, setPickedSub] = useState<Record<string, string>>({}); // late_event_id → staff_id
  const [reasons, setReasons] = useState<Record<string, string>>({}); // late_event_id → reason
  const [submittingFor, setSubmittingFor] = useState<string | null>(null);
  const [errorFor, setErrorFor] = useState<Record<string, string>>({});
  const [successFor, setSuccessFor] = useState<Record<string, string>>({});

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [needsRes, presRes] = await Promise.all([
        fetch('/api/principal/substitute/list-needed'),
        fetch('/api/principal/teacher-presence'),
      ]);
      if (needsRes.ok) {
        const nd = await needsRes.json();
        setNeeds(nd.needs ?? []);
      }
      if (presRes.ok) {
        const pd = await presRes.json();
        // Filter to teachers only (role='teacher'). presence endpoint returns the
        // role field on each teacher. is_active was already enforced server-side.
        const teachers = (pd.teachers ?? [])
          .filter((t: { role: string }) => t.role === 'teacher')
          .map((t: { id: string; name: string; subject: string | null }) => ({
            id: t.id, name: t.name, subject: t.subject,
          }));
        setEligible(teachers);
      }
      if (needsRes.ok && presRes.ok) setLastRefreshedAt(new Date());
    } finally {
      setLoading(false);
    }
  }

  async function handleAssign(need: NeedRow, e: FormEvent) {
    e.preventDefault();
    const leId = need.late_event_id;
    const subId = pickedSub[leId];
    const reason = (reasons[leId] ?? '').trim();

    setErrorFor(prev => ({ ...prev, [leId]: '' }));
    setSuccessFor(prev => ({ ...prev, [leId]: '' }));

    if (!subId) { setErrorFor(prev => ({ ...prev, [leId]: 'Pick a substitute teacher' })); return; }
    if (!reason) { setErrorFor(prev => ({ ...prev, [leId]: 'Reason cannot be empty' })); return; }
    if (!need.original_staff || !need.period || !need.class) {
      setErrorFor(prev => ({ ...prev, [leId]: 'Missing class/period/teacher context — refresh and try again' }));
      return;
    }

    setSubmittingFor(leId);
    try {
      const res = await fetch('/api/principal/substitute/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original_staff_id: need.original_staff.id,
          original_class_id: need.class.id,
          original_period_id: need.period.id,
          substitute_staff_id: subId,
          reason,
          late_event_id: leId,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErrorFor(prev => ({ ...prev, [leId]: d.error ?? 'Failed to assign substitute' }));
      } else {
        setSuccessFor(prev => ({ ...prev, [leId]: 'Assigned. Notification sent (pending Item 13).' }));
        // Reload after short delay so the resolved late_event drops out of "needs".
        setTimeout(loadAll, 800);
      }
    } catch {
      setErrorFor(prev => ({ ...prev, [leId]: 'Network error.' }));
    } finally {
      setSubmittingFor(null);
    }
  }

  return (
    <Layout
      title="Substitute Assignments"
      subtitle={lastRefreshedAt
        ? `Last refreshed ${lastRefreshedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST`
        : 'Loading...'}
      actions={
        <button onClick={loadAll} disabled={loading} className="btn btn-ghost btn-sm">
          {loading ? '↻ Loading...' : '↻ Refresh'}
        </button>
      }
    >
      {/* === Section: Periods needing a substitute === */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-header">
          <div>
            <div className="section-title">Periods Needing a Substitute</div>
            <div className="section-sub">
              {lastRefreshedAt && (
                <span style={{ display: 'inline-block', marginRight: 8, fontSize: 11, color: '#9CA3AF' }}>
                  ↻ {lastRefreshedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST ·
                </span>
              )}
              {needs.length} open late event{needs.length === 1 ? '' : 's'} today
            </div>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="empty-state-icon">⏳</div>
            <div className="empty-state-title">Loading...</div>
          </div>
        ) : needs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">✓</div>
            <div className="empty-state-title">No periods need a substitute right now</div>
            <div className="empty-state-sub">Open late events resolve here as they occur.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {needs.map(need => {
              const leId = need.late_event_id;
              const orig = need.original_staff;
              const cls = need.class;
              const per = need.period;
              const subj = need.subject;
              return (
                <div key={leId} style={{
                  background: '#FAFAFA', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                        {orig?.name ?? 'Unknown teacher'} · {need.delta_minutes} min late
                      </div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                        {cls ? `Class ${cls.grade_level}-${cls.section}` : 'Unknown class'}
                        {per ? ` · Period ${per.period} (${per.start_time?.slice(0,5)}–${per.end_time?.slice(0,5)})` : ''}
                        {subj ? ` · ${subj.name}` : ''}
                      </div>
                    </div>
                    <span className="badge badge-low">URGENT</span>
                  </div>

                  <form onSubmit={e => handleAssign(need, e)}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                      <div>
                        <label className="label">Pick substitute teacher</label>
                        <select
                          value={pickedSub[leId] ?? ''}
                          onChange={e => setPickedSub(prev => ({ ...prev, [leId]: e.target.value }))}
                          className="input"
                          style={{ width: '100%', height: 38 }}
                        >
                          <option value="">— Select —</option>
                          {eligible
                            .filter(t => t.id !== orig?.id)
                            .map(t => (
                              <option key={t.id} value={t.id}>
                                {t.name}{t.subject ? ` (${t.subject})` : ''}
                              </option>
                            ))}
                        </select>
                      </div>
                      <div>
                        <label className="label">Reason</label>
                        <input
                          type="text"
                          value={reasons[leId] ?? ''}
                          onChange={e => setReasons(prev => ({ ...prev, [leId]: e.target.value }))}
                          placeholder="e.g. Sick leave, school errand"
                          className="input"
                          maxLength={500}
                        />
                      </div>
                    </div>

                    {errorFor[leId] && (
                      <div className="alert alert-error" style={{ marginTop: 10 }}>{errorFor[leId]}</div>
                    )}
                    {successFor[leId] && (
                      <div className="alert alert-success" style={{ marginTop: 10 }}>{successFor[leId]}</div>
                    )}

                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="submit"
                        disabled={submittingFor === leId}
                        className="btn btn-primary btn-sm"
                      >
                        {submittingFor === leId ? 'Assigning...' : 'Assign substitute'}
                      </button>
                    </div>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Eligible pool reference */}
      <div className="card-sm" style={{ background: '#F9FAFB' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 6 }}>
          Eligible substitute pool ({eligible.length} active teacher{eligible.length === 1 ? '' : 's'})
        </div>
        <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>
          {eligible.length === 0
            ? 'No active teachers available as substitutes for this school.'
            : eligible.map(t => t.name + (t.subject ? ` (${t.subject})` : '')).join(' · ')}
        </div>
      </div>
    </Layout>
  );
}
