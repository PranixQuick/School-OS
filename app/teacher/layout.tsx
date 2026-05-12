// app/teacher/layout.tsx
// Item #1 Track C — Teacher Dashboard (OPTION_1_TRACK_C_ITEM_1_TEACHER_DASHBOARD).
//
// Server component layout that wraps all /teacher/* pages. Performs server-side
// auth check via cookie session — redirects to /login if not authenticated, or
// to /dashboard if authenticated but not a teacher.
//
// Middleware.ts already validates session for non-public paths and injects the
// x-school-id / x-user-role headers. This layout is a defense-in-depth check
// that runs server-side at the page level and lets us short-circuit to /login
// without rendering any teacher UI for non-teachers.

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getSession } from '@/lib/auth';

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read session via cookie (getSession() falls back to next/headers cookies()
  // when no NextRequest is passed). Returns null if missing/invalid.
  const session = await getSession();

  if (!session) {
    // Preserve current path so login can redirect back.
    const h = await headers();
    const pathname = h.get('x-pathname') ?? '/teacher';
    redirect(`/login?redirect=${encodeURIComponent(pathname)}`);
  }

  if (session.userRole !== 'teacher') {
    // Logged in, but not a teacher. Send to generic dashboard.
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-base font-semibold text-gray-900">Teacher dashboard</h1>
            <a
              href="/api/auth/logout"
              className="text-sm text-gray-500 hover:text-gray-900"
            >
              Sign out
            </a>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
