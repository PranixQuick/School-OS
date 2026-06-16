// lib/authz.ts
// Authorization helpers for v2 routes.
//
// Role enum (public.user_role on rqdnxdvuypekpmxbteju), 10 values:
//   owner | principal | admin_staff | accountant | teacher | reception
//   | admission_officer | parent | student | super_admin
//
// `school_users.role_v2` is the canonical column. `school_users.role` (text) is
// legacy and retained for backward compatibility during the role_v2 migration.
//
// Item #1 Track C (OPTION_1_TRACK_C_ITEM_1_TEACHER_DASHBOARD) corrected the
// prior stale comment in this file which described a 4-value role set
// (owner|admin|teacher|viewer) that no longer matches the database.
//
// super_admin is also a DB role value (enum entry), but the runtime gate is
// still email-suffix-based for now. A proper org_memberships table is planned
// for a later phase.

export function isSuperAdmin(email: string): boolean {
  return email.endsWith('@pranixailabs.com');
}

// Can create / manage institutions (governance action)
export function canManageInstitutions(role: string, email: string): boolean {
  return role === 'owner' || isSuperAdmin(email);
}

// Can create / manage academic years and programmes (operational action).
// Accepts both legacy `admin` (pre-migration role text) and the canonical
// `admin_staff` enum value during the transition.
export function canManageAcademicEntities(role: string, email: string): boolean {
  return (
    role === 'owner' ||
    role === 'admin' ||
    role === 'admin_staff' ||
    isSuperAdmin(email)
  );
}

// Helper for teacher-scoped checks. Use in route handlers as a quick gate
// before calling requireTeacherSession() for the full staff_id resolution.
export function isTeacher(role: string): boolean {
  return role === 'teacher';
}

// --- Accountant role (Decision 2, founder-locked 2026-06-15) ---------------
// The dedicated Accountant role is now supported. Whether a school actually uses
// a dedicated accountant or keeps accounting with admin staff is governed by
// schools.accounting_mode ('dedicated' | 'admin_only', default 'admin_only').

export type AccountingMode = 'dedicated' | 'admin_only';
// ── ACCOUNTANT FEE-ONLY SCOPING ─────────────────────────────────────────────
// The accountant role is permitted in requireAdminSession's ALLOWED_ROLES, but
// must be restricted to fee-domain routes only. Without this, an accountant can
// reach every /api/admin/* route. The allowlist below is the single source of
// truth for which API paths an accountant may access; enforcement lives in
// requireAdminSession (lib/admin-auth.ts).

export function isAccountant(role: string): boolean {
  return role === 'accountant';
}

// Gate for the accounts / finance module. Owners and super admins always pass.
// In 'dedicated' mode a dedicated accountant is permitted; in 'admin_only' mode
// accounting stays with admin staff. Pass the school's accounting_mode from the
// resolved school record; defaults to 'admin_only' to match the column default.
export function canManageAccounts(
  role: string,
  email: string,
  accountingMode: AccountingMode = 'admin_only'
): boolean {
  if (isSuperAdmin(email) || role === 'owner') return true;
  if (accountingMode === 'dedicated') {
    return role === 'accountant' || role === 'admin' || role === 'admin_staff';
  }
  return role === 'admin' || role === 'admin_staff';
// Path prefixes an accountant may access. A path matches if it equals an entry
// or begins with `entry + '/'` (so '/api/admin/fees' covers '/api/admin/fees/...').
export const ACCOUNTANT_ROUTE_ALLOWLIST: string[] = [
  '/api/admin/fees',
  '/api/admin/fee-categories',
  '/api/admin/fee-templates',
  '/api/accounts',
  '/api/billing',
  '/api/dashboard/summary',
  '/api/auth/me',
];

export function canAccountantAccess(pathname: string): boolean {
  return ACCOUNTANT_ROUTE_ALLOWLIST.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );
}
