'use client';

// PR-2 Task B: Manage GPS device tokens for bus tracking.
// Token shown only on creation — admin must copy it before navigating away.

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface Route { id: string; route_name: string; route_number: string | null; }
interface DeviceRow {
  id: string;
  token: string;
  device_name: string;
  last_seen: string | null;
  created_at: string;
  route_id: string | null;
  route: { id: string; route_name: string; route_number: string | null } | Array<{ id: string; route_name: string; route_number: string | null }> | null;
}

function getRoute(r: DeviceRow['route']): { route_name: string; route_number: string | null } | null {
  if (!r) return null;
  return Array.isArray(r) ? (r[0] ?? null) : r;
}

function fmtDateTime(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
  });
}

function maskToken(t: string): string {
  if (t.length <= 12) return t;
  return t.slice(0, 8) + '…' + t.slice(-4);
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(false);

  // New device form
  const [showAdd, setShowAdd] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [routeId, setRouteId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dRes, rRes] = await Promise.all([
        fetch('/api/admin/transport/devices'),
        fetch('/api/admin/transport/routes'),
      ]);
      const dJson = await dRes.json() as { devices?: DeviceRow[] };
      const rJson = await rRes.json() as { routes?: Route[] };
      setDevices(dJson.devices ?? []);
      setRoutes(rJson.routes ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createDevice() {
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/admin/transport/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_name: deviceName.trim(),
          route_id: routeId || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? 'Failed to register device');
        return;
      }
      setNewToken(d.device.token);
      setDeviceName('');
      setRouteId('');
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function revokeDevice(id: string, name: string) {
    if (!confirm('Revoke token for "' + name + '"? The bus device will stop updating.')) return;
    try {
      const res = await fetch('/api/admin/transport/devices?id=' + encodeURIComponent(id), {
        method: 'DELETE',
      });
      if (res.ok) await load();
      else alert('Revoke failed');
    } catch (e) {
      alert(String(e));
    }
  }

  const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: 13, boxSizing: 'border-box' as const };
  const labelStyle = { fontSize: 11, fontWeight: 700 as const, color: '#6B7280', marginBottom: 4, display: 'block' as const };

  return (
    <Layout title="GPS Devices" subtitle="Register and manage GPS trackers on bus devices">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: '#6B7280' }}>
          Each token authenticates one bus device. The device sends GPS pings to <code style={{ background: '#F3F4F6', padding: '2px 6px', borderRadius: 4 }}>POST /api/transport/location</code> every 30s.
        </div>
        <button onClick={() => { setShowAdd(true); setNewToken(null); setError(''); }}
                style={{ padding: '8px 18px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          + Register Device
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#6B7280' }}>Loading...</div>
      ) : devices.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#6B7280', background: '#F9FAFB', borderRadius: 10 }}>
          No GPS devices registered. Click "Register Device" to issue a token for a bus.
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9FAFB', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#6B7280' }}>Device</th>
                <th style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#6B7280' }}>Route</th>
                <th style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#6B7280' }}>Token</th>
                <th style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#6B7280' }}>Last seen</th>
                <th style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#6B7280' }}></th>
              </tr>
            </thead>
            <tbody>
              {devices.map(d => {
                const route = getRoute(d.route);
                return (
                  <tr key={d.id} style={{ borderTop: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>{d.device_name}</td>
                    <td style={{ padding: '10px 14px', color: '#374151' }}>
                      {route ? route.route_name + (route.route_number ? ' (' + route.route_number + ')' : '') : <span style={{ color: '#9CA3AF' }}>Unassigned</span>}
                    </td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11, color: '#6B7280' }}>{maskToken(d.token)}</td>
                    <td style={{ padding: '10px 14px', color: '#374151' }}>{fmtDateTime(d.last_seen)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <button onClick={() => void revokeDevice(d.id, d.device_name)}
                              style={{ padding: '4px 10px', background: '#FEE2E2', color: '#991B1B', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                        Revoke
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <div onClick={() => { if (!saving) { setShowAdd(false); setNewToken(null); } }}
             style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()}
               style={{ width: 'min(480px, 92vw)', background: '#fff', borderRadius: 12, padding: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 16 }}>Register GPS Device</div>

            {newToken ? (
              <div>
                <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E', marginBottom: 4 }}>⚠️ Save this token now</div>
                  <div style={{ fontSize: 11, color: '#92400E' }}>
                    This token is shown only once. Copy it and paste it into the Android GPS app on the bus device.
                  </div>
                </div>
                <div style={{ background: '#F9FAFB', borderRadius: 7, padding: 12, marginBottom: 16 }}>
                  <code style={{ fontSize: 13, fontFamily: 'monospace', wordBreak: 'break-all' }}>{newToken}</code>
                </div>
                <button onClick={() => void navigator.clipboard.writeText(newToken).then(() => alert('Copied'))}
                        style={{ padding: '8px 14px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', marginRight: 8 }}>
                  📋 Copy to clipboard
                </button>
                <button onClick={() => { setShowAdd(false); setNewToken(null); }}
                        style={{ padding: '8px 14px', background: '#F3F4F6', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Done
                </button>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Device name *</label>
                  <input value={deviceName} onChange={e => setDeviceName(e.target.value)}
                         placeholder="e.g. Bus 1 — Driver Phone" style={inputStyle} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Assign to route (optional)</label>
                  <select value={routeId} onChange={e => setRouteId(e.target.value)} style={inputStyle}>
                    <option value="">— Unassigned (can assign later) —</option>
                    {routes.map(r => <option key={r.id} value={r.id}>{r.route_name}{r.route_number ? ' (' + r.route_number + ')' : ''}</option>)}
                  </select>
                </div>
                {error && <div style={{ marginBottom: 12, padding: 10, background: '#FEE2E2', color: '#991B1B', borderRadius: 7, fontSize: 12 }}>{error}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setShowAdd(false)} disabled={saving}
                          style={{ flex: 1, padding: '10px', background: '#F3F4F6', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? 'wait' : 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={() => void createDevice()} disabled={saving || !deviceName.trim()}
                          style={{ flex: 1, padding: '10px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: (saving || !deviceName.trim()) ? 0.5 : 1 }}>
                    {saving ? 'Registering...' : 'Issue Token'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
