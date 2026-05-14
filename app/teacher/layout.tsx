// app/teacher/layout.tsx
// Batch 10 — Teacher layout: server auth guard + TeacherLayout client shell.
// Replaces the bare header from Item #1. All /teacher/* pages inherit this.
// Sub-pages (marks, leave, proofs, etc.) need no changes — cascade applies.

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getSession } from '@/lib/auth';
import TeacherLayout from '@/components/TeacherLayout';
import type { ReactNode } from 'react';

export default async function TeacherRootLayout({ children }: { children: ReactNode }) {
  const session = await getSession();

  if (!session) {
    const h = await headers();
    const pathname = h.get('x-pathname') ?? '/teacher';
    redirect(`/login?redirect=${encodeURIComponent(pathname)}`);
  }

  if (session.userRole !== 'teacher') {
    redirect('/dashboard');
  }

  // TeacherLayout is 'use client' — receives children from server
  return (
    <TeacherLayout title="Teacher Dashboard">
      {children}
    </TeacherLayout>
  );
}
