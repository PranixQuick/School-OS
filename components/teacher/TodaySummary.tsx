// components/teacher/TodaySummary.tsx
// Item #1 Track C — Teacher Dashboard (OPTION_1_TRACK_C_ITEM_1_TEACHER_DASHBOARD).
//
// Client component. Fetches /api/teacher/me on mount and renders a compact
// card showing the teacher's name, today's attendance status, and three
// counters (periods, pending homework, lesson plans).

'use client';

import { useEffect, useState } from 'react';

interface MeResponse {
  staff: {
    id: string;
    name: string;
    subject: string | null;
    role: string;
    phone: string | null;
    email: string | null;
  };
  today: {
    date: string;
    attendance_status: 'present' | 'absent' | 'leave' | null;
    periods_count: number;
    pending_homework_count: number;
    lesson_plans_today_count: number;
  };
}

const STATUS_LABEL: Record<string, string> = {
  present: 'Present',
  absent: 'Absent',
  leave: 'On leave',
};

const STATUS_CLASS: Record<string, string> = {
  present: 'text-green-700 bg-green-50',
  absent: 'text-red-700 bg-red-50',
  leave: 'text-amber-700 bg-amber-50',
};

export default function TodaySummary() {
  const [data, setData] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/teacher/me', { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        return res.json() as Promise<MeResponse>;
      })
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="animate-pulse">
          <div className="h-4 w-1/3 rounded bg-gray-200" />
          <div className="mt-3 h-3 w-1/2 rounded bg-gray-100" />
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="h-12 rounded bg-gray-100" />
            <div className="h-12 rounded bg-gray-100" />
            <div className="h-12 rounded bg-gray-100" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Could not load today summary: {error}
      </div>
    );
  }

  if (!data) return null;

  const { staff, today } = data;
  const statusBadge = today.attendance_status ? (
    <span className={`ml-2 rounded px-2 py-0.5 text-xs ${STATUS_CLASS[today.attendance_status] ?? ''}`}>
      {STATUS_LABEL[today.attendance_status] ?? today.attendance_status}
    </span>
  ) : (
    <span className="ml-2 text-xs text-gray-500">Not checked in</span>
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{staff.name}</h2>
          {staff.subject && <p className="text-sm text-gray-500">{staff.subject}</p>}
        </div>
        <p className="text-xs text-gray-500">{today.date}{statusBadge}</p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded border border-gray-100 bg-gray-50 p-3">
          <div className="text-2xl font-semibold text-gray-900">{today.periods_count}</div>
          <div className="mt-1 text-xs text-gray-500">Periods today</div>
        </div>
        <div className="rounded border border-gray-100 bg-gray-50 p-3">
          <div className="text-2xl font-semibold text-gray-900">{today.pending_homework_count}</div>
          <div className="mt-1 text-xs text-gray-500">Open homework</div>
        </div>
        <div className="rounded border border-gray-100 bg-gray-50 p-3">
          <div className="text-2xl font-semibold text-gray-900">{today.lesson_plans_today_count}</div>
          <div className="mt-1 text-xs text-gray-500">Lesson plans</div>
        </div>
      </div>
    </div>
  );
}
