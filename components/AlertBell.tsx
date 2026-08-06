'use client';
// components/AlertBell.tsx
// Notification bell for the shared staff Layout. Polls /api/alerts, shows an
// unread badge, and opens a dropdown of recent alerts. Clicking an alert marks
// it read and follows its deep link. Self-contained — renders nothing harmful
// for roles with no alerts.

import { useState, useEffect, useCallback, useRef } from 'react';

interface Alert {
  id: string;
  type: string;
  module?: string | null;
  title: string;
  message: string;
  href?: string | null;
  is_read: boolean;
  created_at: string;
}

export default function AlertBell() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/alerts');
      if (!r.ok) return;
      const d = await r.json();
      setAlerts(d.alerts ?? []);
      setUnread(d.unread ?? 0);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const markAll = async () => {
    setUnread(0);
    setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
    try {
      await fetch('/api/alerts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) });
    } catch { /* ignore */ }
  };

  const openAlert = async (a: Alert) => {
    if (!a.is_read) {
      setUnread(u => Math.max(0, u - 1));
      setAlerts(prev => prev.map(x => x.id === a.id ? { ...x, is_read: true } : x));
      try {
        await fetch('/api/alerts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id }) });
      } catch { /* ignore */ }
    }
    if (a.href) window.location.href = a.href;
  };

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={() => setOpen(o => !o)} aria-label="Alerts"
        style={{ position: 'relative', width: 40, height: 40, borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        🔔
        {unread > 0 && (
          <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 9, background: '#DC2626', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 46, width: 320, maxHeight: 420, overflowY: 'auto', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, boxShadow: '0 10px 25px rgba(0,0,0,0.12)', zIndex: 100 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid #F3F4F6' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>Alerts</span>
            {unread > 0 && (
              <button onClick={markAll} style={{ background: 'none', border: 'none', color: '#4F46E5', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Mark all read</button>
            )}
          </div>
          {alerts.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No alerts yet.</div>
          ) : (
            alerts.map(a => (
              <button key={a.id} onClick={() => openAlert(a)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px', borderBottom: '1px solid #F3F4F6', background: a.is_read ? '#fff' : '#F5F3FF', border: 'none', borderLeft: a.is_read ? '3px solid transparent' : '3px solid #4F46E5', cursor: 'pointer' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{a.title}</div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{a.message}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
