// components/teacher/LessonPlanCard.tsx
// Item #1 Track C Phase 3 PR #2b — single lesson plan row with status update.

'use client';

import { useState } from 'react';

type Status = 'planned' | 'in_progress' | 'completed' | 'skipped';

interface LessonPlan {
  id: string;
  planned_date: string;
  completion_status: Status;
  completed_at: string | null;
  notes: string | null;
}

const STATUS_LABEL: Record<Status, string> = {
  planned: 'Planned', in_progress: 'In progress',
  completed: 'Completed', skipped: 'Skipped',
};

const STATUS_CLASS: Record<Status, string> = {
  planned: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-50 text-blue-700',
  completed: 'bg-green-50 text-green-700',
  skipped: 'bg-amber-50 text-amber-700',
};

interface LessonPlanCardProps {
  plan: LessonPlan;
  onUpdated?: () => void;
}

export default function LessonPlanCard({ plan, onUpdated }: LessonPlanCardProps) {
  const [updating, setUpdating] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(next: Status) {
    setError(null); setUpdating(next);
    try {
      const res = await fetch('/api/teacher/lesson-plans', {
        method: 'PATCH', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: plan.id, completion_status: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'HTTP ' + res.status);
      }
      onUpdated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setUpdating(null); }
  }

  const others = (['planned', 'in_progress', 'completed', 'skipped'] as Status[])
    .filter((s) => s !== plan.completion_status);

  return (
    <li className="rounded border border-gray-200 bg-white p-3 text-sm shadow-sm">
      <div className="flex items-baseline justify-between">
        <span className="font-medium text-gray-900">{plan.planned_date}</span>
        <span className={'rounded px-2 py-0.5 text-xs ' + STATUS_CLASS[plan.completion_status]}>
          {STATUS_LABEL[plan.completion_status]}
        </span>
      </div>
      {plan.notes && <p className="mt-1 text-sm text-gray-700">{plan.notes}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {others.map((s) => (
          <button key={s} onClick={() => setStatus(s)} disabled={updating !== null}
            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            Mark {STATUS_LABEL[s].toLowerCase()}
          </button>
        ))}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </li>
  );
}
