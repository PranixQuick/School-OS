'use client';
// NetworkStatus — mounts once in layout, shows offline banner with reconnect UX
// Uses navigator.onLine + online/offline events for native APK support

import { useState, useEffect } from 'react';

export default function NetworkStatus() {
  const [online, setOnline] = useState(true);
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setOnline(navigator.onLine);

    function handleOnline() {
      setOnline(true);
      setJustReconnected(true);
      setTimeout(() => setJustReconnected(false), 3000);
    }
    function handleOffline() {
      setOnline(false);
      setJustReconnected(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (online && !justReconnected) return null;

  return (
    <>
      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .netbanner { animation: slideUp 0.3s ease; }
      `}</style>
      {!online && (
        <div className="netbanner" style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9998,
          background: '#B91C1C', color: '#fff',
          padding: `12px 16px calc(12px + env(safe-area-inset-bottom)) 16px`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FCA5A5', animation: 'pulse 1.5s infinite' }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>No internet connection</span>
          </div>
          <button onClick={() => window.location.reload()}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, padding: '5px 12px', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Retry
          </button>
        </div>
      )}
      {online && justReconnected && (
        <div className="netbanner" style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9998,
          background: '#16A34A', color: '#fff',
          padding: `10px 16px calc(10px + env(safe-area-inset-bottom)) 16px`,
          textAlign: 'center', fontSize: 13, fontWeight: 600,
        }}>
          ✓ Back online
        </div>
      )}
    </>
  );
}
