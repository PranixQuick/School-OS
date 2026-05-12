// app/teacher/homework/page.tsx
// Item #1 Track C Phase 4 — polished homework list with proper class/subject
// dropdowns sourced from /api/teacher/classes (replaces UUID-derive hack from PR #2b).

'use client';

import { useCallback, useEffect, useState } from 'react';
import HomeworkForm from '@/components/teacher/HomeworkForm';

interface Homework {
  id: string;
  class_id: string;
  subject_id: string;
  title: string;
  description: string | null;
  due_date: string;
  created_at: string;
}

interface Opt { id: string; label: string }

export default function HomeworkListPage() {
  const [homework, setHomework] = useState<Homework[]>([]);
  const [classes, setClasses] = useState<Opt[]>([]);
  const [subjects, setSubjects] = useState<Opt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [hwRes, classesRes] = await Promise.all([
        fetch('/api/teacher/homework', { credentials: 'same-origin' }),
        fetch('/api/teacher/classes', { credentials: 'same-origin' }),
      ]);
      if (!hwRes.ok) {
        const b = await hwRes.json().catch(() => ({}));
        throw new Error(b.error || 'HTTP ' + hwRes.status);
      }
      if (!classesRes.ok) throw new Error('Failed to load class list');
      const hwData = await hwRes.json();
      const classesData = await classesRes.json();
      setHomework(hwData.homework ?? []);
      setClasses(classesData.classes ?? []);
      setSubjects(classesData.subjects ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Homework</h1>
        <p className="mt-1 text-sm text-gray-500">Assign work and grade submissions.</p>
      </div>

      <HomeworkForm classes={classes} subjects={subjects} onCreated={load} />

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-500">Recent (last 60 days)</h2>
        {loading && <p className="text-sm text-gray-400">Loading...</p>}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}
        {!loading && !error && homework.length === 0 && (
          <p className="text-sm text-gray-400">No homework assigned yet.</p>
        )}
        <ul className="space-y-2">
          {homework.map((h) => (
            <li key={h.id}>
              <a href={'/teacher/homework/' + h.id} className="block rounded border border-gray-200 bg-white p-3 text-sm shadow-sm hover:border-gray-300">
                <div className="flex items-baseline justify-between">
                  <span className="font-medium text-gray-900">{h.title}</span>
                  <span className="text-xs text-gray-500">Due {h.due_date}</span>
                </div>
                {h.description && <p className="mt-1 text-xs text-gray-600 line-clamp-2">{h.description}</p>}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
