'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Layout from '@/components/Layout';
import { T } from '@/lib/i18n';
import { useLang } from '@/lib/useLang';

interface CheckIn {
  id: string; checked_in_at: string; lat: number | null; lng: number | null; note: string | null;
}
interface GeoResult {
  success?: boolean; status?: string; is_late?: boolean; delta_minutes?: number;
  inside_polygon?: boolean; poor_accuracy?: boolean; message?: string; error?: string;
}

type GeoStatus = 'idle' | 'requesting' | 'locating' | 'submitting' | 'done' | 'error';

// Offline queue: store pings that failed due to network, retry on reconnect
const OFFLINE_KEY = 'edprosys_geo_queue';
function loadQueue(): Array<{lat:number;lng:number;accuracy_m:number;timestamp:string}> {
  try { return JSON.parse(localStorage.getItem(OFFLINE_KEY) ?? '[]'); } catch { return []; }
}
function saveQueue(q: ReturnType<typeof loadQueue>) {
  try { localStorage.setItem(OFFLINE_KEY, JSON.stringify(q)); } catch {/* noop */}
}

export default function CheckInPage() {
  const { lang } = useLang();
  const [checkins, setCheckins]       = useState<CheckIn[]>([]);
  const [loading, setLoading]         = useState(true);
  const [punching, setPunching]       = useState(false);
  const [msg, setMsg]                 = useState('');
  const [success, setSuccess]         = useState('');
  const [todayPunched, setTodayPunched] = useState(false);
  // Geo state
  const [geoStatus, setGeoStatus]     = useState<GeoStatus>('idle');
  const [geoResult, setGeoResult]     = useState<GeoResult | null>(null);
  const [geoError, setGeoError]       = useState('');
  const [accuracy, setAccuracy]       = useState<number | null>(null);
  const [offlineCount, setOfflineCount] = useState(0);
  const geoWatchRef = useRef<number | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const loadCheckins = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/teacher/check-in');
      if (r.ok) {
        const d = await r.json() as { checkins?: CheckIn[] };
        const list = d.checkins ?? [];
        setCheckins(list);
        setTodayPunched(list.some(c => c.checked_in_at?.startsWith(todayStr)));
      }
    } catch {/* ignore */}
    setLoading(false);
  }, [todayStr]);

  useEffect(() => {
    void loadCheckins();
    setOfflineCount(loadQueue().length);
    // Try to flush offline queue when online
    void flushOfflineQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Manual check-in (original behavior preserved)
  async function punchIn() {
    setPunching(true); setMsg(''); setSuccess('');
    try {
      const res = await fetch('/api/teacher/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: '' }),
      });
      const d = await res.json() as { error?: string; message?: string };
      if (res.ok) { setSuccess(d.message ?? 'Checked in'); await loadCheckins(); }
      else setMsg(d.error ?? 'Failed');
    } catch { setMsg('Network error'); }
    setPunching(false);
  }

  // Flush any queued offline pings
  async function flushOfflineQueue() {
    const q = loadQueue();
    if (q.length === 0) return;
    const remaining = [];
    for (const ping of q) {
      try {
        const res = await fetch('/api/teacher/geo-checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...ping, offline_queued: true }),
        });
        if (!res.ok) remaining.push(ping);
      } catch { remaining.push(ping); }
    }
    saveQueue(remaining);
    setOfflineCount(remaining.length);
  }

  // GPS geo-fenced check-in
  function startGeoCheckin() {
    if (!('geolocation' in navigator)) {
      setGeoError('GPS ఈ పరికరంలో అందుబాటులో లేదు');
      setGeoStatus('error');
      return;
    }
    setGeoStatus('requesting'); setGeoError(''); setGeoResult(null); setAccuracy(null);

    if (geoWatchRef.current !== null) {
      navigator.geolocation.clearWatch(geoWatchRef.current);
    }

    setGeoStatus('locating');
    geoWatchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng, accuracy: acc } = pos.coords;
        setAccuracy(Math.round(acc));

        // Stop watching once we have a reading
        if (geoWatchRef.current !== null) {
          navigator.geolocation.clearWatch(geoWatchRef.current);
          geoWatchRef.current = null;
        }

        setGeoStatus('submitting');
        const payload = {
          lat, lng,
          accuracy_m: acc,
          timestamp: new Date().toISOString(),
        };

        try {
          const res = await fetch('/api/teacher/geo-checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const d = await res.json() as GeoResult;
          if (res.ok) {
            setGeoResult(d);
            setGeoStatus('done');
            void loadCheckins();
          } else {
            // Offline queue
            const q = loadQueue();
            q.push(payload);
            saveQueue(q);
            setOfflineCount(q.length);
            setGeoError(d.error ?? 'Network error — saved offline, will sync automatically');
            setGeoStatus('error');
          }
        } catch {
          // Network failure — queue for later
          const q = loadQueue();
          q.push(payload);
          saveQueue(q);
          setOfflineCount(q.length);
          setGeoError('Network error — చెక్-ఇన్ offline లో సేవ్ చేయబడింది. తర్వాత sync అవుతుంది.');
          setGeoStatus('error');
        }
      },
      (err) => {
        const msgs: Record<number, string> = {
          1: 'GPS అనుమతి నిరాకరించారు. Settings లో location enable చేయండి.',
          2: 'Location కనుగొనడం సాధ్యపడలేదు. మళ్ళీ ప్రయత్నించండి.',
          3: 'GPS time-out — మళ్ళీ ప్రయత్నించండి.',
        };
        setGeoError(msgs[err.code] ?? 'GPS error');
        setGeoStatus('error');
        if (geoWatchRef.current !== null) {
          navigator.geolocation.clearWatch(geoWatchRef.current);
          geoWatchRef.current = null;
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  // Geo status display config
  const geoStatusConfig: Record<GeoStatus, { icon: string; label: string; bg: string; color: string }> = {
    idle:       { icon: '📍', label: 'GPS హాజరు', bg: '#EEF2FF', color: '#4F46E5' },
    requesting: { icon: '⏳', label: 'GPS అనుమతి అడుగుతోంది…', bg: '#FFF7ED', color: '#D97706' },
    locating:   { icon: '🛰', label: 'Location కనుగొంటోంది…', bg: '#FFF7ED', color: '#D97706' },
    submitting: { icon: '⬆', label: 'Submitting…', bg: '#FFF7ED', color: '#D97706' },
    done:       { icon: '✅', label: geoResult?.message ?? 'హాజరు నమోదైంది', bg: '#F0FDF4', color: '#15803D' },
    error:      { icon: '⚠️', label: 'Error', bg: '#FEF2F2', color: '#B91C1C' },
  };

  const cfg = geoStatusConfig[geoStatus];
  const geoActive = ['requesting','locating','submitting'].includes(geoStatus);

  return (
    <Layout title="Check In" subtitle="Daily attendance">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        .pulsing{animation:pulse 1.2s ease-in-out infinite}`}
      </style>

      {/* Offline queue banner */}
      {offlineCount > 0 && (
        <div style={{ background: '#FFF7ED', border: '1px solid #FCD34D', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#92400E' }}>
          ⏳ {offlineCount} offline check-in(s) pending sync.{' '}
          <button onClick={() => void flushOfflineQueue()} style={{ background: 'none', border: 'none', color: '#4F46E5', fontWeight: 700, cursor: 'pointer', fontSize: 13, padding: 0 }}>
            Sync now →
          </button>
        </div>
      )}

      {/* GPS Geo-fenced Check-In card */}
      <div style={{ background: cfg.bg, border: `1px solid ${cfg.color}40`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: cfg.color, marginBottom: 6 }}>
          {cfg.icon} GPS హాజరు నమోదు
        </div>
        <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 14, lineHeight: 1.5 }}>
          పాఠశాల సీమలో ఉన్నప్పుడు GPS ద్వారా హాజరు నమోదు చేయండి.
          {accuracy !== null && (
            <span style={{ color: accuracy > 150 ? '#D97706' : '#15803D', fontWeight: 600 }}>
              {' '}(Accuracy: {accuracy}m{accuracy > 150 ? ' — తక్కువ' : ' ✓'})
            </span>
          )}
        </div>

        {geoStatus === 'done' && geoResult && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: cfg.color, marginBottom: 6 }}>
              {geoResult.message}
            </div>
            {geoResult.is_late && (
              <div style={{ fontSize: 13, color: '#D97706', fontWeight: 600 }}>
                ⏰ ఆలస్యం: {geoResult.delta_minutes} నిమిషాలు
              </div>
            )}
            {geoResult.inside_polygon === false && (
              <div style={{ fontSize: 13, color: '#D97706', fontWeight: 600 }}>
                ⚠️ పాఠశాల సీమ వెలుపల
              </div>
            )}
            {geoResult.poor_accuracy && (
              <div style={{ fontSize: 13, color: '#D97706', fontWeight: 600 }}>
                📡 GPS accuracy తక్కువ — దగ్గరగా వెళ్ళి మళ్ళీ ప్రయత్నించండి
              </div>
            )}
          </div>
        )}

        {geoStatus === 'error' && (
          <div style={{ color: '#B91C1C', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
            ⚠️ {geoError}
          </div>
        )}

        <button
          onClick={geoStatus === 'done' ? () => setGeoStatus('idle') : startGeoCheckin}
          disabled={geoActive}
          className={geoActive ? 'pulsing' : ''}
          style={{
            width: '100%', padding: '14px', borderRadius: 12, border: 'none',
            background: geoActive ? '#9CA3AF' : geoStatus === 'done' ? '#15803D' : '#4F46E5',
            color: '#fff', fontSize: 15, fontWeight: 800, cursor: geoActive ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}>
          {geoActive ? `${cfg.icon} ${cfg.label}` :
           geoStatus === 'done' ? '✅ మళ్ళీ హాజరు నమోదు' :
           '📍 GPS హాజరు నమోదు చేయి'}
        </button>
      </div>

      {/* Manual check-in (original, preserved) */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16, padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
          ✍️ Manual Check-In
        </div>
        <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 12 }}>
          GPS లేకపోతే manual check-in వాడవచ్చు
        </div>
        {success && (
          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 13, color: '#15803D' }}>
            ✅ {success}
          </div>
        )}
        {msg && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 13, color: '#B91C1C' }}>
            ⚠️ {msg}
          </div>
        )}
        {todayPunched ? (
          <div style={{ padding: '10px 14px', background: '#F0FDF4', borderRadius: 10, fontSize: 13, color: '#15803D', fontWeight: 600 }}>
            ✅ Today&apos;s manual check-in already recorded
          </div>
        ) : (
          <button onClick={() => void punchIn()} disabled={punching}
            style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: punching ? '#9CA3AF' : '#374151', color: '#fff', fontSize: 14, fontWeight: 700, cursor: punching ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {punching ? 'Checking in…' : '✍️ Manual Check-In'}
          </button>
        )}
      </div>

      {/* Recent check-in history */}
      <div style={{ fontSize: 13, fontWeight: 700, color: '#6B7280', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 10 }}>
        Recent Check-Ins
      </div>
      {loading ? (
        <div style={{ padding: 20, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
      ) : checkins.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No check-ins yet</div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden' }}>
          {checkins.slice(0, 7).map((c, i) => (
            <div key={c.id} style={{ padding: '10px 16px', borderBottom: i < 6 ? '1px solid #F9FAFB' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                  {new Date(c.checked_in_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </div>
                {c.lat && c.lng && (
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>📍 GPS: {c.lat.toFixed(4)}, {c.lng.toFixed(4)}</div>
                )}
              </div>
              <div style={{ fontSize: 12, color: '#6B7280', background: '#F9FAFB', padding: '3px 8px', borderRadius: 6 }}>
                {new Date(c.checked_in_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
