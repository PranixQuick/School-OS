// components/teacher/SubstituteBanner.tsx
// Item #1 Track C Phase 4 — read-only substitute display banner.

'use client';

import { useEffect, useState } from 'react';

interface SubstituteAssignment {
  id: string;
  original_staff_id?: string;
  substitute_staff_id?: string;
  original_class_id: string;
  status: string;
  assigned_at: string;
  reason: string | null;
}

interface SubstituteToday {
  date: string;
  covering_for: SubstituteAssignment[];
  covered_by: SubstituteAssignment[];
}

export default function SubstituteBanner() {
  const [data, setData] = useState<SubstituteToday | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/teacher/substitute-today', { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'HTTP ' + res.status);
        }
        return res.json() as Promise<SubstituteToday>;
      })
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  if (error) return null; // silent failure — banner is non-critical
  if (!data) return null;
  if (data.covering_for.length === 0 && data.covered_by.length === 0) return null;

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
      {data.covering_for.length > 0 && (
        <p>
          <span className="font-medium">Covering today:</span> you have {data.covering_for.length}{' '}
          {data.covering_for.length === 1 ? 'class' : 'classes'} substituting for another teacher.
        </p>
      )}
      {data.covered_by.length > 0 && (
        <p className="mt-1">
          <span className="font-medium">Covered today:</span> {data.covered_by.length}{' '}
          {data.covered_by.length === 1 ? 'class is' : 'classes are'} being covered for you.
        </p>
      )}
    </div>
  );
}
