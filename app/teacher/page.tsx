// app/teacher/page.tsx
// Item #1 Track C — Teacher Dashboard (OPTION_1_TRACK_C_ITEM_1_TEACHER_DASHBOARD).
//
// REPLACES the prior phone+PIN-per-request page. This is now a thin server
// component that renders the TodaySummary client component. All data fetching
// happens client-side via /api/teacher/me with session cookie credentials.
//
// Auth is handled by app/teacher/layout.tsx (server-side redirect to /login if
// not authenticated, or /dashboard if not a teacher), plus middleware.ts
// session enforcement. By the time this page renders, the user is guaranteed
// to be a logged-in teacher.

import TodaySummary from '@/components/teacher/TodaySummary';

export default function TeacherHome() {
  return (
    <div className="space-y-6">
      <TodaySummary />

      <section>
        <h2 className="mb-3 text-sm font-medium text-gray-500">Quick actions</h2>
        <div className="grid grid-cols-2 gap-2">
          <a
            href="/teacher/homework"
            className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-900 shadow-sm hover:border-gray-300"
          >
            Homework
          </a>
          <a
            href="/teacher/lesson-plans"
            className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-900 shadow-sm hover:border-gray-300"
          >
            Lesson plans
          </a>
        </div>
      </section>

      <p className="text-xs text-gray-400">
        Phase 2 of Item #1 will add: check-in, leave requests, homework grading,
        lesson plan creation. Phase 3 adds classroom proofs and substitute
        display.
      </p>
    </div>
  );
}
