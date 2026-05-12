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
