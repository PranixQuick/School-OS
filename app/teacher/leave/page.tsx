// app/teacher/leave/page.tsx
// Item #1 Track C Phase 3 — Leave requests page: form + history list.

'use client';

import { useCallback, useEffect, useState } from 'react';
import LeaveForm from '@/components/teacher/LeaveForm';

interface LeaveRequest {
  id: string;
  leave_type: string;
  from_date: string;
  to_date: string;
  reason: string;
  status: string;
  approved_at: string | null;
  created_at: string;
}

const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
  cancelled: 'bg-gray-100 text-gray-700',
};

export default function LeavePage() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/teacher/leave', { credentials: 'same-origin' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setRequests(data.requests ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Leave requests</h1>
        <p className="mt-1 text-sm text-gray-500">Submit new requests and track status.</p>
      </div>

      <LeaveForm onSubmitted={loadRequests} />

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-500">Your requests (last 90 days)</h2>
        {loading && <p className="text-sm text-gray-400">Loading...</p>}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {!loading && !error && requests.length === 0 && (
          <p className="text-sm text-gray-400">No leave requests in the last 90 days.</p>
        )}
        <ul className="space-y-2">
          {requests.map((r) => (
            <li key={r.id} className="rounded border border-gray-200 bg-white p-3 text-sm shadow-sm">
              <div className="flex items-baseline justify-between">
                <span className="font-medium text-gray-900">{r.leave_type}</span>
                <span className={`rounded px-2 py-0.5 text-xs ${STATUS_CLASS[r.status] ?? STATUS_CLASS.pending}`}>
                  {r.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {r.from_date} → {r.to_date}
              </p>
              <p className="mt-1 text-sm text-gray-700">{r.reason}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
