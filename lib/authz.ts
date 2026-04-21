// lib/authz.ts
// Phase 1 Task 1.5 — authorization helpers for v2 routes.
//
// Role set that actually exists in school_users.role today:
//   owner | admin | teacher | viewer
// (CHECK constraint on school_users.role enforces this)
//
// super_admin is not a DB role — it's an email-suffix gate for Phase 1.
// Phase 2 will introduce a proper org_memberships table.

export function isSuperAdmin(email: string): boolean {
  return email.endsWith('@pranixailabs.com');
}

// Can create / manage institutions (governance action)
export function canManageInstitutions(role: string, email: string): boolean {
  return role === 'owner' || isSuperAdmin(email);
}

// Can create / manage academic years and programmes (operational action)
export function canManageAcademicEntities(role: string, email: string): boolean {
  return role === 'owner' || role === 'admin' || isSuperAdmin(email);
}
