// app/teacher/proofs/page.tsx
// Item #1 Track C Phase 4 — classroom proofs: capture + timeline.

'use client';

import { useCallback, useEffect, useState } from 'react';

interface Proof {
  id: string;
  class_id: string;
  taken_at: string;
  audit_status: string;
  audit_notes: string | null;
  signed_url: string | null;
}

interface ClassOpt { id: string; label: string }

export default function ProofsPage() {
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [classes, setClasses] = useState<ClassOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pickedClass, setPickedClass] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [proofsRes, classesRes] = await Promise.all([
        fetch('/api/teacher/proofs', { credentials: 'same-origin' }),
        fetch('/api/teacher/classes', { credentials: 'same-origin' }),
      ]);
      if (!proofsRes.ok) throw new Error('Failed to load proofs');
      if (!classesRes.ok) throw new Error('Failed to load classes');
      const proofsData = await proofsRes.json();
      const classesData = await classesRes.json();
      setProofs(proofsData.proofs ?? []);
      setClasses(classesData.classes ?? []);
      if (!pickedClass && classesData.classes?.[0]) setPickedClass(classesData.classes[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }, [pickedClass]);

  useEffect(() => { load(); }, [load]);

  async function handleCapture() {
    setError(null); setSuccess(false);
    if (!pickedClass) { setError('Pick a class'); return; }

    // Get a file from the user via hidden input (camera-friendly on mobile)
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        // Get geolocation (best-effort)
        const pos = await new Promise<GeolocationPosition | null>((resolve) => {
          if (!navigator.geolocation) return resolve(null);
          navigator.geolocation.getCurrentPosition(
            (p) => resolve(p), () => resolve(null),
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
          );
        });

        // Request signed upload URL
        const initRes = await fetch('/api/teacher/proofs', {
          method: 'POST', credentials: 'same-origin',
        });
        if (!initRes.ok) {
          const body = await initRes.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to get upload URL');
        }
        const { upload_url, photo_path } = await initRes.json();

        // Upload directly to signed URL
        const upRes = await fetch(upload_url, {
          method: 'PUT', body: file,
          headers: { 'Content-Type': file.type || 'image/jpeg' },
        });
        if (!upRes.ok) throw new Error('Photo upload failed');

        // Finalize
        const finRes = await fetch('/api/teacher/proofs', {
          method: 'PUT', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            photo_path,
            class_id: pickedClass,
            geo_lat: pos?.coords.latitude,
            geo_lng: pos?.coords.longitude,
          }),
        });
        if (!finRes.ok) {
          const body = await finRes.json().catch(() => ({}));
          throw new Error(body.error || 'Finalize failed');
        }
        setSuccess(true);
        load();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally { setUploading(false); }
    };
    input.click();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Classroom proofs</h1>
        <p className="mt-1 text-sm text-gray-500">Capture a photo to confirm class is in session.</p>
      </div>

      {classes.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          You don&apos;t have any classes assigned yet. Ask your admin to schedule you.
        </div>
      ) : (
        <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <label htmlFor="proof-class" className="block text-xs text-gray-600">Class</label>
          <select id="proof-class" value={pickedClass} onChange={(e) => setPickedClass(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm">
            {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <button onClick={handleCapture} disabled={uploading}
            className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300">
            {uploading ? 'Uploading...' : 'Capture photo'}
          </button>
        </div>
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">Proof uploaded.</div>}

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-500">Recent (last 30 days)</h2>
        {loading && <p className="text-sm text-gray-400">Loading...</p>}
        {!loading && proofs.length === 0 && <p className="text-sm text-gray-400">No proofs uploaded yet.</p>}
        <ul className="space-y-2">
          {proofs.map((p) => (
            <li key={p.id} className="rounded border border-gray-200 bg-white p-3 text-sm shadow-sm">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-gray-600">{new Date(p.taken_at).toLocaleString()}</span>
                <span className={'rounded px-2 py-0.5 text-xs ' + (p.audit_status === 'approved' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700')}>
                  {p.audit_status}
                </span>
              </div>
              {p.signed_url && (
                <img src={p.signed_url} alt="Classroom proof" className="mt-2 max-h-48 rounded" />
              )}
              {p.audit_notes && <p className="mt-1 text-xs text-gray-600">{p.audit_notes}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
