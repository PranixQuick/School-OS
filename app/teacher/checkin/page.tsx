// app/teacher/checkin/page.tsx
// Item #1 Track C Phase 3 — Teacher geo check-in UI.
//
// Client component. Requests geolocation, posts to /api/teacher/checkin,
// shows result. Auth is enforced by app/teacher/layout.tsx + middleware.

'use client';

import { useState } from 'react';

interface CheckinResult {
  ok: boolean;
  inside_polygon: boolean | null;
  geofence_configured: boolean;
  today: string;
}

export default function CheckinPage() {
  const [status, setStatus] = useState<'idle' | 'locating' | 'sending' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckin() {
    setError(null);
    setResult(null);
    setStatus('locating');

    if (!('geolocation' in navigator)) {
      setStatus('error');
      setError('Geolocation is not supported on this device.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setStatus('sending');
        try {
          const res = await fetch('/api/teacher/checkin', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy_m: pos.coords.accuracy,
            }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `HTTP ${res.status}`);
          }
          const data: CheckinResult = await res.json();
          setResult(data);
          setStatus('success');
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
          setStatus('error');
        }
      },
      (err) => {
        setStatus('error');
        setError(`Geolocation failed: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Geo check-in</h1>
        <p className="mt-1 text-sm text-gray-500">
          Confirm you&apos;re on campus. Records your location and marks you present for today.
        </p>
      </div>

      <button
        onClick={handleCheckin}
        disabled={status === 'locating' || status === 'sending'}
        className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500"
      >
        {status === 'locating' && 'Getting your location...'}
        {status === 'sending' && 'Recording check-in...'}
        {status === 'idle' && 'Check in now'}
        {status === 'success' && 'Check in again'}
        {status === 'error' && 'Try again'}
      </button>

      {status === 'success' && result && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          <p className="font-medium">Check-in recorded for {result.today}.</p>
          {result.geofence_configured && result.inside_polygon === true && (
            <p className="mt-1">You&apos;re inside the campus boundary.</p>
          )}
          {result.geofence_configured && result.inside_polygon === false && (
            <p className="mt-1">Note: you appear to be outside the campus boundary.</p>
          )}
          {!result.geofence_configured && (
            <p className="mt-1 text-xs text-green-700">
              Geofence not configured for this school yet. Location was recorded.
            </p>
          )}
        </div>
      )}

      {status === 'error' && error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <p className="text-xs text-gray-400">
        Your location is used only to confirm attendance and is retained per the
        school&apos;s privacy policy.
      </p>
    </div>
  );
}
