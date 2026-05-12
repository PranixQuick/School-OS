// components/teacher/HomeworkForm.tsx
// Item #1 Track C Phase 3 PR #2b — homework create form.

'use client';

import { useEffect, useState } from 'react';

interface ClassOption { id: string; label: string }
interface SubjectOption { id: string; label: string }

interface HomeworkFormProps {
  classes: ClassOption[];
  subjects: SubjectOption[];
  onCreated?: () => void;
}

export default function HomeworkForm({ classes, subjects, onCreated }: HomeworkFormProps) {
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => { if (!classId && classes[0]) setClassId(classes[0].id); }, [classes, classId]);
  useEffect(() => { if (!subjectId && subjects[0]) setSubjectId(subjects[0].id); }, [subjects, subjectId]);

  async function handleSubmit() {
    setError(null); setSuccess(false);
    if (!classId || !subjectId) { setError('Pick a class and subject'); return; }
    if (title.trim().length < 3) { setError('Title must be at least 3 characters'); return; }
    if (!dueDate) { setError('Pick a due date'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/teacher/homework', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          class_id: classId, subject_id: subjectId,
          title: title.trim(),
          description: description.trim() || undefined,
          due_date: dueDate,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setSuccess(true);
      setTitle(''); setDescription(''); setDueDate('');
      onCreated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setSubmitting(false); }
  }

  if (classes.length === 0 || subjects.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        You don&apos;t have any classes or subjects assigned yet. Ask your admin to assign at least one.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">Assign new homework</h3>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="hw-class" className="block text-xs text-gray-600">Class</label>
          <select id="hw-class" value={classId} onChange={(e) => setClassId(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm">
            {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="hw-subject" className="block text-xs text-gray-600">Subject</label>
          <select id="hw-subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm">
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="hw-title" className="block text-xs text-gray-600">Title</label>
        <input id="hw-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          maxLength={200} placeholder="e.g., Chapter 4 exercises"
          className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label htmlFor="hw-desc" className="block text-xs text-gray-600">Description (optional)</label>
        <textarea id="hw-desc" value={description} onChange={(e) => setDescription(e.target.value)}
          rows={3} maxLength={2000}
          className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label htmlFor="hw-due" className="block text-xs text-gray-600">Due date</label>
        <input id="hw-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
      </div>
      <button onClick={handleSubmit} disabled={submitting}
        className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300">
        {submitting ? 'Creating...' : 'Assign homework'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {success && <p className="text-xs text-green-700">Homework assigned.</p>}
    </div>
  );
}
