import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getSession } from '@/lib/auth';

// Server-side guard for the entire /admin/* area.
//
// Background: admin API routes are already gated by requireAdminSession()
// (lib/admin-auth.ts), so non-admin roles cannot perform admin write actions.
// However, the admin *pages* themselves had no guard, so a portal user (e.g. a
// teacher) could open an admin page by typing its URL and see an empty admin
// shell — a trust/first-impression problem even though no real data showed.
//
// This layout blocks that: portal roles are redirected to their own home before
// any admin page renders. Only roles that have a dedicated non-admin portal AND
// no legitimate use of any /admin page are redirected. Every other role (admin
// staff, accountant, counsellor, librarian, transport/hostel/placement staff,
// registrar, principal, owner, oversight, viewer) either uses /admin pages
// directly or is gated per-action at the API layer, so they pass through.

const PORTAL_HOME: Record<string, string> = {
  teacher: '/teacher',
  aww: '/teacher',
  student: '/student',
  parent: '/parent',
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const portalHome = PORTAL_HOME[session.userRole];
  if (portalHome) redirect(portalHome);

  return <>{children}</>;
}
