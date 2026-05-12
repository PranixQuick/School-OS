// app/teacher/lesson-plans/page.tsx
// Item #1 Track C Phase 4 — polished lesson plans page with proper dropdowns
// sourced from /api/teacher/classes (replaces UUID-paste hack from PR #2b).

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

interface Opt { id: string; label: string }

export default function LessonPlansPage() {
  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [classes, setClasses] = useState<Opt[]>([]);
  const [subjects, setSubjects] = useState<Opt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createClassId, setCreateClassId] = useState('');
  const [createSubjectId, setCreateSubjectId] = useState('');
  const [createDate, setCreateDate] = useState('');
  const [createNotes, setCreateNotes] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [planRes, classesRes] = await Promise.all([
        fetch('/api/teacher/lesson-plans', { credentials: 'same-origin' }),
        fetch('/api/teacher/classes', { credentials: 'same-origin' }),
      ]);
      if (!planRes.ok) {
        const b = await planRes.json().catch(() => ({}));
        throw new Error(b.error || 'HTTP ' + planRes.status);
      }
      if (!classesRes.ok) throw new Error('Failed to load class list');
      const planData = await planRes.json();
      const classesData = await classesRes.json();
      setPlans(planData.lesson_plans ?? []);
      setClasses(classesData.classes ?? []);
      setSubjects(classesData.subjects ?? []);
      if (!createClassId && classesData.classes?.[0]) setCreateClassId(classesData.classes[0].id);
      if (!createSubjectId && classesData.subjects?.[0]) setCreateSubjectId(classesData.subjects[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }, [createClassId, createSubjectId]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!createClassId || !createSubjectId || !createDate) { setError('All fields required'); return; }
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
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || 'HTTP ' + res.status);
      }
      setShowCreate(false); setCreateDate(''); setCreateNotes('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setCreating(false); }
  }

  const canCreate = classes.length > 0 && subjects.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Lesson plans</h1>
          <p className="mt-1 text-sm text-gray-500">Track planned, in-progress, and completed lessons.</p>
        </div>
        {canCreate && (
          <button onClick={() => setShowCreate(!showCreate)}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">
            {showCreate ? 'Cancel' : 'New plan'}
          </button>
        )}
      </div>

      {!canCreate && !loading && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          You don&apos;t have any classes assigned yet. Ask your admin to schedule you.
        </div>
      )}

      {showCreate && canCreate && (
        <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="lp-class" className="block text-xs text-gray-600">Class</label>
              <select id="lp-class" value={createClassId} onChange={(e) => setCreateClassId(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm">
                {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="lp-subject" className="block text-xs text-gray-600">Subject</label>
              <select id="lp-subject" value={createSubjectId} onChange={(e) => setCreateSubjectId(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm">
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>
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
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {!loading && !error && plans.length === 0 && canCreate && (
        <p className="text-sm text-gray-400">No lesson plans in the last 30 days. Click &quot;New plan&quot; to create one.</p>
      )}
      <ul className="space-y-2">
        {plans.map((p) => <LessonPlanCard key={p.id} plan={p} onUpdated={load} />)}
      </ul>
    </div>
  );
}
