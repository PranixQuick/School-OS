// app/teacher/homework/[id]/page.tsx
// Item #1 Track C Phase 3 PR #2b — homework detail + grade submissions.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { use } from 'react';

interface Submission {
  id: string;
  student_id: string;
  submitted_at: string | null;
  status: string;
  marks_obtained: number | null;
  teacher_remarks: string | null;
}

interface HomeworkDetail {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  class_id: string;
  subject_id: string;
}

const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-50 text-blue-700',
  late: 'bg-amber-50 text-amber-700',
  graded: 'bg-green-50 text-green-700',
  missed: 'bg-red-50 text-red-700',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function HomeworkDetailPage({ params }: PageProps) {
  const { id } = use(params);

  const [homework, setHomework] = useState<HomeworkDetail | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [marks, setMarks] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/teacher/homework/' + id, { credentials: 'same-origin' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'HTTP ' + res.status);
      }
      const data = await res.json();
      setHomework(data.homework);
      setSubmissions(data.submissions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function grade(submissionId: string) {
    if (!marks || isNaN(Number(marks))) { setError('Marks must be a number'); return; }
    setError(null);
    try {
      const res = await fetch('/api/teacher/homework/' + id, {
        method: 'PATCH', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_id: submissionId,
          marks_obtained: Number(marks),
          teacher_remarks: remarks.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'HTTP ' + res.status);
      }
      setGradingId(null); setMarks(''); setRemarks('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (loading) return <p className="text-sm text-gray-400">Loading...</p>;
  if (error) return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
  );
  if (!homework) return <p className="text-sm text-gray-400">Not found.</p>;

  return (
    <div className="space-y-4">
      <div>
        <a href="/teacher/homework" className="text-xs text-blue-600 hover:underline">← Back to homework</a>
        <h1 className="mt-1 text-xl font-semibold text-gray-900">{homework.title}</h1>
        <p className="mt-1 text-sm text-gray-500">Due {homework.due_date}</p>
        {homework.description && <p className="mt-2 text-sm text-gray-700">{homework.description}</p>}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-500">Submissions ({submissions.length})</h2>
        {submissions.length === 0 && <p className="text-sm text-gray-400">No submissions yet.</p>}
        <ul className="space-y-2">
          {submissions.map((s) => (
            <li key={s.id} className="rounded border border-gray-200 bg-white p-3 text-sm shadow-sm">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-gray-600">Student {s.student_id.slice(0, 8)}</span>
                <span className={'rounded px-2 py-0.5 text-xs ' + (STATUS_CLASS[s.status] ?? STATUS_CLASS.pending)}>
                  {s.status}
                </span>
              </div>
              {s.submitted_at && <p className="mt-1 text-xs text-gray-500">Submitted {new Date(s.submitted_at).toLocaleString()}</p>}
              {s.marks_obtained !== null && <p className="mt-1 text-sm text-gray-700">Marks: {s.marks_obtained}</p>}
              {s.teacher_remarks && <p className="mt-1 text-xs text-gray-600">{s.teacher_remarks}</p>}

              {s.status !== 'graded' && gradingId !== s.id && (
                <button onClick={() => setGradingId(s.id)}
                  className="mt-2 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">
                  Grade
                </button>
              )}

              {gradingId === s.id && (
                <div className="mt-2 space-y-2">
                  <input type="number" min={0} max={1000} placeholder="Marks (0-1000)"
                    value={marks} onChange={(e) => setMarks(e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
                  <input type="text" placeholder="Remarks (optional)" maxLength={1000}
                    value={remarks} onChange={(e) => setRemarks(e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
                  <div className="flex gap-2">
                    <button onClick={() => grade(s.id)}
                      className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700">Save</button>
                    <button onClick={() => { setGradingId(null); setMarks(''); setRemarks(''); }}
                      className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50">Cancel</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
