// app/teacher/lesson-plans/page.tsx
// Item #1 Track C Phase 3 PR #2b — lesson plans list (REPLACES Items 12 anti-pattern page).

'use client';

import { useCallback, useEffect, useState } from 'react';
import LessonPlanCard from '@/components/teacher/LessonPlanCard';

interface LessonPlan {
  id: string;
  class_id: string;
  subject_id: string;
  planned_date: string;
  completion_status: 'planned' | 'in_progress' | 'completed' | 'skipped';
  completed_at: string | null;
  notes: string | null;
  created_at: string;
}

export default function LessonPlansPage() {
  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inline create form state (simple — full form is in Phase 4 polish)
  const [showCreate, setShowCreate] = useState(false);
  const [createClassId, setCreateClassId] = useState('');
  const [createSubjectId, setCreateSubjectId] = useState('');
  const [createDate, setCreateDate] = useState('');
  const [createNotes, setCreateNotes] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/teacher/lesson-plans', { credentials: 'same-origin' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'HTTP ' + res.status);
      }
      const data = await res.json();
      setPlans(data.lesson_plans ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!createClassId || !createSubjectId || !createDate) {
      setError('All fields required'); return;
    }
    setCreating(true); setError(null);
    try {
      const res = await fetch('/api/teacher/lesson-plans', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          class_id: createClassId, subject_id: createSubjectId,
          planned_date: createDate, notes: createNotes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'HTTP ' + res.status);
      }
      setShowCreate(false);
      setCreateClassId(''); setCreateSubjectId(''); setCreateDate(''); setCreateNotes('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setCreating(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Lesson plans</h1>
          <p className="mt-1 text-sm text-gray-500">Track planned, in-progress, and completed lessons.</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">
          {showCreate ? 'Cancel' : 'New plan'}
        </button>
      </div>

      {showCreate && (
        <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <input type="text" placeholder="Class UUID" value={createClassId}
            onChange={(e) => setCreateClassId(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
          <input type="text" placeholder="Subject UUID" value={createSubjectId}
            onChange={(e) => setCreateSubjectId(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
          <input type="date" value={createDate} onChange={(e) => setCreateDate(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
          <textarea placeholder="Notes (optional)" maxLength={2000} rows={3}
            value={createNotes} onChange={(e) => setCreateNotes(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
          <button onClick={handleCreate} disabled={creating}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:bg-gray-300">
            {creating ? 'Creating...' : 'Create plan'}
          </button>
        </div>
      )}

      {loading && <p className="text-sm text-gray-400">Loading...</p>}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      {!loading && !error && plans.length === 0 && (
        <p className="text-sm text-gray-400">No lesson plans in the last 30 days. Click &quot;New plan&quot; to create one.</p>
      )}
      <ul className="space-y-2">
        {plans.map((p) => <LessonPlanCard key={p.id} plan={p} onUpdated={load} />)}
      </ul>
    </div>
  );
}
