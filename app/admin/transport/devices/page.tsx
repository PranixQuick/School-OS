'use client';
// PATH: app/admin/transport/devices/page.tsx
// PR-2 Task B: GPS device registration for buses.
// Tokens are consumed by the existing K6 endpoint /api/transport/location.

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface Route { id: string; route_name: string; route_number: string | null }
interface Device {
  id: string;
  device_name: string;
  last_seen: string | null;
  created_at: string;
  route_id: string | null;
  route: { id: string; route_name: string; route_number: string | null } | null;
  token_preview: string | null;
}

function fmtDateTime(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
  });
}

function lastSeenStale(s: string | null): boolean {
  if (!s) return true;
  const ageMin = (Date.now() - new Date(s).getTime()) / 60000;
  return ageMin > 10;  // stale = no GPS ping in last 10 minutes
}

export default function TransportDevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(false);

  // Registration form
  const [showAdd, setShowAdd] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [routeId, setRouteId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // After-issuance reveal
  const [revealed, setRevealed] = useState<{ token: string; device_name: string; route_id: string | null } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [devRes, rtRes] = await Promise.all([
        fetch('/api/admin/transport/devices'),
        fetch('/api/admin/transport/routes'),
      ]);
      const dev = await devRes.json() as { devices?: Device[] };
      const rt = await rtRes.json() as { routes?: Route[] };
      setDevices(dev.devices ?? []);
      setRoutes(rt.routes ?? []);
    } catch (e) {
      console.error('Load devices failed:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function issueToken() {
    setSaving(true);
    setFormError('');
    try {
      const res = await fetch('/api/admin/transport/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_name: deviceName.trim(),
          route_id: routeId || null,
        }),
      });
      const d = await res.json() as { error?: string; device?: { token: string; device_name: string; route_id: string | null } };
      if (!res.ok || !d.device) {
        setFormError(d.error ?? 'Failed to issue token');
        return;
      }
      setRevealed({
        token: d.device.token,
        device_name: d.device.device_name,
        route_id: d.device.route_id,
      });
      setShowAdd(false);
      setDeviceName('');
      setRouteId('');
      await load();
    } catch (e) {
      setFormError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function revoke(device: Device) {
    if (!confirm(`Revoke token for "${device.device_name}"? The bus device will stop reporting GPS until a new token is registered.`)) return;
    try {
      const res = await fetch(`/api/admin/transport/devices?id=${device.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        alert(d.error ?? 'Revoke failed');
        return;
      }
      await load();
    } catch (e) {
      alert(String(e));
    }
  }

  async function copyToken() {
    if (!revealed) return;
    try {
      await navigator.clipboard.writeText(revealed.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Layout
      title="GPS Devices"
      subtitle="Register bus GPS devices and issue authentication tokens"
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button
          onClick={() => { setShowAdd(true); setRevealed(null); setFormError(''); }}
          style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#4F46E5', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >+ Register Device</button>
      </div>

      {/* Reveal panel — only shown right after token creation */}
      {revealed && (
        <div style={{
          background: '#F0FDF4', border: '2px solid #BBF7D0', borderRadius: 10,
          padding: 18, marginBottom: 18,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#065F46', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ⚠ Save this token now
          </div>
          <div style={{ fontSize: 13, color: '#065F46', marginBottom: 12 }}>
            Token issued for <strong>{revealed.device_name}</strong>. Copy it to the bus GPS device now — it will be masked in future listings for security.
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{
              flex: 1, background: '#fff', border: '1px solid #D1FAE5',
              padding: '10px 12px', borderRadius: 7, fontSize: 13,
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              color: '#065F46', wordBreak: 'break-all',
            }}>{revealed.token}</code>
            <button
              onClick={() => void copyToken()}
              style={{ padding: '10px 16px', borderRadius: 7, border: 'none', background: '#065F46', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >{copied ? '✓ Copied' : 'Copy'}</button>
            <button
              onClick={() => setRevealed(null)}
              style={{ padding: '10px 16px', borderRadius: 7, border: '1px solid #BBF7D0', background: '#fff', color: '#065F46', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >Done</button>
          </div>
        </div>
      )}

      {/* Registration form modal */}
      {showAdd && (
        <div
          onClick={() => setShowAdd(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 24, width: 'min(440px, 100%)' }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: '#111827', margin: '0 0 18px' }}>Register GPS Device</h2>

            <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Device Name *</label>
            <input
              type="text"
              value={deviceName}
              onChange={e => setDeviceName(e.target.value)}
              placeholder="e.g. Bus 12 — Sushruth's route"
              maxLength={100}
              style={{ width: '100%', padding: '9px 11px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: 13, marginBottom: 14, boxSizing: 'border-box' }}
            />

            <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Route (optional)</label>
            <select
              value={routeId}
              onChange={e => setRouteId(e.target.value)}
              style={{ width: '100%', padding: '9px 11px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: 13, marginBottom: 18 }}
            >
              <option value="">(no route — assign later)</option>
              {routes.map(r => (
                <option key={r.id} value={r.id}>
                  {r.route_number ? `${r.route_number} — ` : ''}{r.route_name}
                </option>
              ))}
            </select>

            {formError && (
              <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '8px 12px', borderRadius: 6, fontSize: 12, marginBottom: 12 }}>
                {formError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowAdd(false)}
                style={{ padding: '9px 16px', borderRadius: 7, border: '1px solid #E5E7EB', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >Cancel</button>
              <button
                onClick={() => void issueToken()}
                disabled={saving || !deviceName.trim()}
                style={{ padding: '9px 18px', borderRadius: 7, border: 'none', background: '#4F46E5', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (saving || !deviceName.trim()) ? 0.5 : 1 }}
              >{saving ? 'Issuing…' : 'Issue Token'}</button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#6B7280', fontSize: 13 }}>Loading devices…</div>
      ) : devices.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13, background: '#F9FAFB', borderRadius: 8 }}>
          No GPS devices registered yet. Click <strong>+ Register Device</strong> to issue your first token.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Device', 'Token', 'Route', 'Last Seen', 'Registered', ''].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#6B7280', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {devices.map(d => {
                const stale = lastSeenStale(d.last_seen);
                return (
                  <tr key={d.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#111827' }}>{d.device_name}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'ui-monospace, SFMono-Regular, monospace', color: '#6B7280', fontSize: 11 }}>{d.token_preview ?? '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#374151' }}>
                      {d.route
                        ? `${d.route.route_number ? d.route.route_number + ' — ' : ''}${d.route.route_name}`
                        : <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>(unassigned)</span>}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {d.last_seen ? (
                        <span style={{
                          background: stale ? '#FEE2E2' : '#D1FAE5',
                          color: stale ? '#991B1B' : '#065F46',
                          padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                        }}>{fmtDateTime(d.last_seen)}</span>
                      ) : <span style={{ color: '#9CA3AF' }}>never</span>}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#6B7280' }}>{fmtDateTime(d.created_at)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <button
                        onClick={() => void revoke(d)}
                        style={{ padding: '5px 11px', borderRadius: 6, border: '1px solid #FCA5A5', background: '#fff', color: '#991B1B', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                      >Revoke</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 22, padding: 12, background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 7, fontSize: 12, color: '#0C4A6E' }}>
        <strong>How it works:</strong> Each bus runs an Android GPS app that posts coordinates every 30 seconds to <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>/api/transport/location</code> using its assigned token. If a school location is configured (onboarding Step 1), buses within 300 m automatically mark as <em>arriving</em> for the parent portal.
      </div>
    </Layout>
  );
}
