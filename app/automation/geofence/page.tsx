'use client';

// PATH: app/automation/geofence/page.tsx
//
// Principal-facing geofence admin.
// Three sections:
//   1. Current active geofence (lat/lng list of vertices)
//   2. Define new polygon — paste GeoJSON, validates client-side, POSTs to /api/principal/geofence/define
//   3. Today's teacher presence summary — fetched from /api/principal/teacher-presence

import { useState, useEffect, FormEvent } from 'react';
import Layout from '@/components/Layout';

interface GeofenceData {
  id: string;
  polygon_geojson: { type: string; coordinates: number[][][] };
  radius_meters_fallback: number | null;
  active_from: string;
  active_to: string | null;
  created_at: string;
}

interface TeacherPresence {
  id: string;
  name: string;
  role: string;
  subject: string | null;
  scheduled_today: boolean;
  any_ping_today: boolean;
  inside_ping_count: number;
  first_inside_ping_at: string | null;
  late_event_count: number;
  max_late_minutes: number;
  status: string;
}

interface PresenceSummary {
  total_staff: number;
  scheduled_today: number;
  present: number;
  late: number;
  no_show: number;
}

interface PresenceData {
  date: string;
  day_of_week: number;
  summary: PresenceSummary;
  teachers: TeacherPresence[];
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  no_show:             { label: 'No-show',          cls: 'badge-low' },
  late_no_ping:        { label: 'Late, no ping',    cls: 'badge-low' },
  outside_zone:        { label: 'Outside zone',     cls: 'badge-medium' },
  late_present:        { label: 'Late but present', cls: 'badge-medium' },
  present:             { label: 'Present',          cls: 'badge-high' },
  unscheduled_present: { label: 'Off-day, on-site', cls: 'badge-indigo' },
  unscheduled_outside: { label: 'Off-day, off-site',cls: 'badge-gray' },
  not_scheduled:       { label: 'Not scheduled',    cls: 'badge-gray' },
};

export default function GeofenceAdmin() {
  const [geofence, setGeofence] = useState<GeofenceData | null>(null);
  const [presence, setPresence] = useState<PresenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [defineInput, setDefineInput] = useState('');
  const [defineError, setDefineError] = useState('');
  const [defineSuccess, setDefineSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [gRes, pRes] = await Promise.all([
        fetch('/api/principal/geofence/get'),
        fetch('/api/principal/teacher-presence'),
      ]);
      const gd = await gRes.json();
      const pd = await pRes.json();
      if (gRes.ok) setGeofence(gd.geofence);
      if (pRes.ok) setPresence(pd as PresenceData);
      if (gRes.ok && pRes.ok) setLastRefreshedAt(new Date());
    } finally {
      setLoading(false);
    }
  }

  async function handleDefine(e: FormEvent) {
    e.preventDefault();
    setDefineError(''); setDefineSuccess(''); setSubmitting(true);
    let parsed: unknown;
    try {
      parsed = JSON.parse(defineInput);
    } catch (err) {
      setDefineError('Not valid JSON. Paste a GeoJSON Polygon object.');
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/principal/geofence/define', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ polygon_geojson: parsed }),
      });
      const d = await res.json();
      if (!res.ok) {
        setDefineError(d.error ?? 'Failed to save geofence');
      } else {
        setDefineSuccess(`Geofence saved. Active from ${new Date(d.active_from).toLocaleString()}`);
        setDefineInput('');
        await loadAll();
      }
    } catch {
      setDefineError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function formatVertex(pt: number[]): string {
    const [lng, lat] = pt;
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }

  return (
    <Layout
      title="Geofence Administration"
      subtitle={lastRefreshedAt ? `Last refreshed ${lastRefreshedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST` : 'Loading...'}
      actions={
        <button onClick={loadAll} disabled={loading} className="btn btn-ghost btn-sm">
          {loading ? '↻ Loading...' : '↻ Refresh'}
        </button>
      }
    >
      {/* === Section 1: Current geofence === */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-header">
          <div>
            <div className="section-title">Current Geofence</div>
            <div className="section-sub">
              {geofence
                ? `Active since ${new Date(geofence.active_from).toLocaleString('en-IN')}`
                : 'No geofence defined yet for this school.'}
            </div>
          </div>
        </div>

        {geofence ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
              <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Vertices</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>
                  {(geofence.polygon_geojson.coordinates[0]?.length ?? 0) - 1}
                </div>
              </div>
              <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Fallback radius</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>
                  {geofence.radius_meters_fallback ?? '—'} m
                </div>
              </div>
            </div>

            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>#</th><th>Latitude, Longitude</th></tr></thead>
                <tbody>
                  {geofence.polygon_geojson.coordinates[0]?.slice(0, -1).map((pt, i) => (
                    <tr key={i}>
                      <td style={{ width: 60, color: '#6B7280' }}>{i + 1}</td>
                      <td style={{ fontFamily: 'monospace' }}>{formatVertex(pt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">📍</div>
            <div className="empty-state-title">No geofence defined</div>
            <div className="empty-state-sub">Use the form below to define your school&apos;s geofence polygon.</div>
          </div>
        )}
      </div>

      {/* === Section 2: Define new polygon === */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-header">
          <div>
            <div className="section-title">Define New Geofence</div>
            <div className="section-sub">Paste a GeoJSON Polygon. Defining a new one supersedes the current geofence immediately.</div>
          </div>
        </div>

        <form onSubmit={handleDefine}>
          <label className="label">GeoJSON Polygon</label>
          <textarea
            value={defineInput}
            onChange={e => setDefineInput(e.target.value)}
            placeholder={'{\n  "type": "Polygon",\n  "coordinates": [[\n    [78.4867, 17.3850],\n    [78.4867, 17.3870],\n    [78.4887, 17.3870],\n    [78.4887, 17.3850],\n    [78.4867, 17.3850]\n  ]]\n}'}
            rows={10}
            style={{
              width: '100%',
              border: '1px solid #D1D5DB',
              background: '#F9FAFB',
              borderRadius: 9,
              padding: '12px 14px',
              fontFamily: 'monospace',
              fontSize: 13,
              outline: 'none',
              resize: 'vertical',
            }}
          />

          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 8, lineHeight: 1.6 }}>
            • Coordinates are in [longitude, latitude] order (GeoJSON convention).<br/>
            • The outer ring must be closed (first point == last point).<br/>
            • Minimum 4 points (triangle + closing point).
          </div>

          {defineError && (
            <div className="alert alert-error" style={{ marginTop: 12 }}>{defineError}</div>
          )}
          {defineSuccess && (
            <div className="alert alert-success" style={{ marginTop: 12 }}>{defineSuccess}</div>
          )}

          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" disabled={submitting || !defineInput.trim()} className="btn btn-primary">
              {submitting ? 'Saving...' : 'Save geofence'}
            </button>
          </div>
        </form>
      </div>

      {/* === Section 3: Today's teacher presence === */}
      <div className="card">
        <div className="section-header">
          <div>
            <div className="section-title">Teacher Presence Today</div>
            <div className="section-sub">
              {lastRefreshedAt && (
                <span style={{ display: 'inline-block', marginRight: 8, fontSize: 11, color: '#9CA3AF' }}>
                  ↻ {lastRefreshedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST ·
                </span>
              )}
              {presence
                ? `${presence.summary.scheduled_today} scheduled · ${presence.summary.present} present · ${presence.summary.late} late · ${presence.summary.no_show} no-show`
                : 'Loading...'}
            </div>
          </div>
        </div>

        {presence && presence.teachers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👩‍🏫</div>
            <div className="empty-state-title">No active teaching staff</div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Teacher</th>
                  <th>Status</th>
                  <th>Inside pings</th>
                  <th>Late events</th>
                  <th>Max delay</th>
                </tr>
              </thead>
              <tbody>
                {presence?.teachers.map(t => {
                  const badge = STATUS_BADGE[t.status] ?? STATUS_BADGE.not_scheduled;
                  return (
                    <tr key={t.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#111827' }}>{t.name}</div>
                        <div style={{ fontSize: 11, color: '#9CA3AF' }}>{t.subject ?? t.role}</div>
                      </td>
                      <td><span className={`badge ${badge.cls}`}>{badge.label}</span></td>
                      <td>{t.inside_ping_count}</td>
                      <td>{t.late_event_count > 0 ? <span className="badge badge-low">{t.late_event_count}</span> : <span style={{ color: '#9CA3AF' }}>—</span>}</td>
                      <td>{t.max_late_minutes > 0 ? `${t.max_late_minutes} min` : <span style={{ color: '#9CA3AF' }}>—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
