'use client';

// PR-2 Task B: GPS device token management UI.
// Admin/principal: register new bus GPS devices, view existing devices, revoke.
//
// Token is shown ONCE on creation (full token). On subsequent views, masked.
// This is the standard pattern for issued API tokens.

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';

interface Route { id: string; route_name: string; route_number: string | null }

interface Device {
  id: string;
  device_name: string;
  token_masked: string | null;
  route_id: string | null;
  route: { id: string; route_name: string; route_number: string | null } | null;
  last_seen: string | null;
  created_at: string;
}

interface NewDeviceResult {
  id: string;
  device_name: string;
  token: string;
  route_id: string | null;
  created_at: string;
}

function fmtDateTime(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
  });
}

function relativeAge(s: string | null): string {
  if (!s) return 'Never';
  const diffMs = Date.now() - new Date(s).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [selectedRoute, setSelectedRoute] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [newToken, setNewToken] = useState<NewDeviceResult | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/transport/devices');
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load devices');
      } else {
        setDevices(data.devices ?? []);
      }
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    void fetch('/api/admin/transport/routes')
      .then(r => r.ok ? r.json() : null)
      .then((d: { routes?: Route[] } | null) => {
        if (d?.routes) setRoutes(d.routes);
      })
      .catch(() => {});
  }, []);

  async function issueDevice() {
    if (!deviceName.trim()) {
      setError('Device name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/transport/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_name: deviceName.trim(),
          route_id: selectedRoute || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to register device');
      } else {
        setNewToken(data.device);
        setShowAddModal(false);
        setDeviceName('');
        setSelectedRoute('');
        await load();
      }
    } catch (e) {
      setError(String(e));
    }
    setSaving(false);
  }

  async function revokeDevice(id: string, name: string) {
    if (!confirm(`Revoke device "${name}"? This cannot be undone. The bus GPS app will stop reporting.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/transport/devices?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        alert('Revoke failed: ' + (data.error || 'unknown'));
      } else {
        await load();
      }
    } catch (e) {
      alert('Revoke failed: ' + String(e));
    }
  }

  async function copyToken(token: string) {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the text in the readonly input
      const inp = document.getElementById('token-display') as HTMLInputElement | null;
      if (inp) { inp.select(); document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    }
  }

  return (
    <Layout
      title="GPS Devices"
      subtitle="Bus GPS device tokens — for the Android tracker app installed on each bus"
      actions={
        <Link href="/admin/transport" style={{ fontSize: 12, color: '#4F46E5', textDecoration: 'none', padding: '6px 10px', border: '1px solid #E5E7EB', borderRadius: 7 }}>
          ← Back to Transport
        </Link>
      }
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: 12, color: '#6B7280' }}>
          {devices.length} device{devices.length === 1 ? '' : 's'} registered
        </div>
        <button onClick={() => { setShowAddModal(true); setError(''); }}
          style={{ padding: '8px 18px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          + Register Device
        </button>
      </div>

      {error && !showAddModal && <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{error}</div>}

      {loading && <div style={{ padding: 20, color: '#6B7280', fontSize: 13 }}>Loading…</div>}

      {!loading && devices.length === 0 && (
        <div style={{ padding: 30, textAlign: 'center', color: '#9CA3AF', fontSize: 13, background: '#F9FAFB', borderRadius: 10 }}>
          No devices registered yet. Click &ldquo;Register Device&rdquo; to issue a token for a bus.
        </div>
      )}

      {/* Device list table */}
      {devices.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>Device</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>Route</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>Token</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>Last Seen</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>Created</th>
                <th style={{ padding: '10px 14px' }}></th>
              </tr>
            </thead>
            <tbody>
              {devices.map(d => (
                <tr key={d.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: '#111827' }}>{d.device_name}</td>
                  <td style={{ padding: '10px 14px', color: '#374151' }}>
                    {d.route ? (
                      <span>{d.route.route_name}{d.route.route_number ? ` (${d.route.route_number})` : ''}</span>
                    ) : (
                      <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>Unassigned</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: '#6B7280', fontSize: 12 }}>
                    {d.token_masked ?? '—'}
                  </td>
                  <td style={{ padding: '10px 14px', color: d.last_seen ? '#065F46' : '#9CA3AF' }}>
                    {relativeAge(d.last_seen)}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#6B7280', fontSize: 11 }}>
                    {fmtDateTime(d.created_at)}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    <button onClick={() => void revokeDevice(d.id, d.device_name)}
                      style={{ padding: '4px 10px', background: '#FEE2E2', color: '#991B1B', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add device modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setShowAddModal(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 12, padding: 24, width: 'calc(100% - 40px)', maxWidth: 440 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 14px' }}>Register New GPS Device</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Device Name *</label>
              <input value={deviceName} onChange={e => setDeviceName(e.target.value)}
                placeholder="e.g. Bus 7 GPS, Driver Phone (Suresh)"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Assign to Route (Optional)</label>
              <select value={selectedRoute} onChange={e => setSelectedRoute(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: 13 }}>
                <option value="">— No route (assign later) —</option>
                {routes.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.route_name}{r.route_number ? ` (${r.route_number})` : ''}
                  </option>
                ))}
              </select>
            </div>
            {error && <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '8px 12px', borderRadius: 7, marginBottom: 12, fontSize: 12 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowAddModal(false)}
                style={{ flex: 1, padding: '10px', background: '#F3F4F6', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => void issueDevice()} disabled={saving || !deviceName.trim()}
                style={{ flex: 2, padding: '10px', background: saving ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>
                {saving ? 'Generating…' : 'Issue Token'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* One-time token reveal modal */}
      {newToken && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 'calc(100% - 40px)', maxWidth: 560 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 6px' }}>✅ Device Registered</h3>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>
              Copy the token below into the bus GPS app on the device. <strong style={{ color: '#991B1B' }}>This is the only time the full token will be shown.</strong>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Device</label>
              <div style={{ padding: '8px 10px', background: '#F9FAFB', borderRadius: 7, fontSize: 13 }}>{newToken.device_name}</div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Token (copy now)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input id="token-display" value={newToken.token} readOnly
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: 13, fontFamily: 'ui-monospace, monospace', background: '#FEFCE8', boxSizing: 'border-box' }} />
                <button onClick={() => void copyToken(newToken.token)}
                  style={{ padding: '8px 14px', background: copied ? '#065F46' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <button onClick={() => { setNewToken(null); setCopied(false); }}
              style={{ width: '100%', padding: '10px', background: '#111827', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              I have saved the token
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
