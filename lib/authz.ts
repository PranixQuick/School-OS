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
// ── SUPER ADMIN GATE ───────────────────────────────────────────────────────
// SEC-CRITICAL-1(a) — 2026-08-17.
//
// PREVIOUS BEHAVIOUR (vulnerable):
//     return email.endsWith('@pranixailabs.com');
//
// Platform-wide super-admin was granted to anyone whose email ended in the
// operator domain. Combined with the public POST /api/schools/create — which
// took admin_email straight from the request body and provisioned that user
// with email_confirm: true — this made super-admin *self-service*:
//
//   1. POST /api/schools/create { admin_email: "x@pranixailabs.com", ... }
//   2. read the password out of the JSON response
//   3. POST /api/auth/login
//   -> full cross-tenant super-admin over every school on the platform,
//      from three unauthenticated HTTP calls, with no DB access required.
//
// CURRENT BEHAVIOUR (fixed):
// Super-admin is an explicit, operator-controlled allowlist supplied through
// the environment. It cannot be granted by anything a request can influence.
// The registration endpoint additionally refuses reserved operator domains, so
// the escalation chain is broken in two independent places.
//
// FAIL-CLOSED BY DESIGN: with no allowlist configured, isSuperAdmin() is false
// for everybody. That is intentional. It is also not a regression — at the time
// of this change `select count(*) from school_users where email ilike
// '%@pranixailabs.com'` returned 0, so no account was relying on the old gate.
//
// CONFIGURATION: set SUPER_ADMIN_EMAILS to a comma-separated list of exact
// addresses. The pre-existing singular SUPER_ADMIN_EMAIL is still honoured.
// Values are compared case-insensitively after trimming; matching is exact —
// no suffix, prefix or wildcard matching is supported, deliberately.
//
// FOLLOW-UP (tracked, not in this PR): move the allowlist into a DB-backed
// `platform_operators` table with per-operator audit and revocation, so adding
// or removing an operator is not a redeploy.

let superAdminAllowlistCache: Set<string> | null = null;

function superAdminAllowlist(): Set<string> {
  if (superAdminAllowlistCache) return superAdminAllowlistCache;

  // Read process.env directly rather than through lib/env.ts: this module is
  // reachable from contexts where the server-only env schema is not loaded, and
  // an undefined value there must degrade to "nobody is a super admin" rather
  // than throw.
  const raw = [
    process.env.SUPER_ADMIN_EMAILS ?? '',
    process.env.SUPER_ADMIN_EMAIL ?? '',
  ].join(',');

  superAdminAllowlistCache = new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0 && e.includes('@'))
  );

  return superAdminAllowlistCache;
}

/** Test-only: clears the memoised allowlist so env changes take effect. */
export function __resetSuperAdminAllowlistForTests(): void {
  superAdminAllowlistCache = null;
}

export function isSuperAdmin(email: string): boolean {
  if (!email) return false;
  return superAdminAllowlist().has(email.trim().toLowerCase());
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
}
// Path prefixes an accountant may access. A path matches if it equals an entry
// or begins with `entry + '/'` (so '/api/admin/fees' covers '/api/admin/fees/...').
export const ACCOUNTANT_ROUTE_ALLOWLIST: string[] = [
  '/api/admin/fees',
  '/api/admin/fee-categories',
  '/api/admin/fee-templates',
  '/api/admin/expenses',
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

// ── HOSTEL ADMIN SCOPING ───────────────────────────────────────────────
export const HOSTEL_ADMIN_ROUTE_ALLOWLIST: string[] = [
  '/api/admin/hostel',
  '/api/admin/schools/branding',
  '/api/dashboard/summary',
  '/api/auth/me',
];

export function canHostelAdminAccess(pathname: string): boolean {
  return HOSTEL_ADMIN_ROUTE_ALLOWLIST.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );
}

