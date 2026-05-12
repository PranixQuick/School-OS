// app/teacher/page.tsx
// Item #1 Track C Phase 4 — polished teacher dashboard landing.
//
// Server component rendering: SubstituteBanner (if applicable) + TodaySummary
// + grid of 5 quick action tiles (check-in, homework, lesson plans, leave, proofs).

import TodaySummary from '@/components/teacher/TodaySummary';
import SubstituteBanner from '@/components/teacher/SubstituteBanner';

const QUICK_ACTIONS = [
  { href: '/teacher/checkin', label: 'Geo check-in', desc: 'Mark yourself present' },
  { href: '/teacher/homework', label: 'Homework', desc: 'Assign and grade' },
  { href: '/teacher/lesson-plans', label: 'Lesson plans', desc: 'Plan and track' },
  { href: '/teacher/leave', label: 'Leave', desc: 'Request and view status' },
  { href: '/teacher/proofs', label: 'Classroom proofs', desc: 'Capture and view' },
];

export default function TeacherHome() {
  return (
    <div className="space-y-4">
      <SubstituteBanner />
      <TodaySummary />

      <section>
        <h2 className="mb-3 text-sm font-medium text-gray-500">Quick actions</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {QUICK_ACTIONS.map((a) => (
            <a key={a.href} href={a.href}
              className="rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-sm hover:border-gray-300">
              <span className="font-medium text-gray-900">{a.label}</span>
              <span className="mt-0.5 block text-xs text-gray-500">{a.desc}</span>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
