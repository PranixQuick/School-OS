// lib/permissions.ts
// ISS-6 (#6) — Hybrid per-stakeholder permissions.
//
// The hardcoded checks in lib/authz.ts remain the BASELINE. This layer lets the
// role_permissions table OVERRIDE a decision only where an explicit row exists
// for the (role, module); when the matrix is silent (no row, or a NULL cell),
// the caller's hardcoded `fallback` decision is used unchanged. That makes the
// layer additive and structurally lockout-proof.
//
// Not wired into any route yet — call sites adopt it module-by-module.
//
// Note: the Supabase client is imported lazily inside canDo() so that the pure
// helpers (normRole/resolvePerm) can be unit-tested without resolving the '@/'
// path alias or initializing the DB client.

export type PermAction = 'view' | 'create' | 'edit' | 'delete';

export interface PermRow {
  can_view: boolean | null;
  can_create: boolean | null;
  can_edit: boolean | null;
  can_delete: boolean | null;
}

// Legacy -> canonical role mapping for the role_permissions lookup. The table
// stores the legacy 'admin' label; the canonical role_v2 value is 'admin_staff'.
const ROLE_ALIASES: Record<string, string> = { admin: 'admin_staff' };

export function normRole(role: string): string {
  return ROLE_ALIASES[role] ?? role;
}

// Resolve a single action against a matrix row, falling back when the row is
// missing or the relevant cell is NULL (unset).
export function resolvePerm(row: PermRow | null | undefined, action: PermAction, fallback: boolean): boolean {
  if (!row) return fallback;
  const cell = row[`can_${action}` as keyof PermRow];
  return typeof cell === 'boolean' ? cell : fallback;
}

/**
 * Fallback-safe permission check. Looks up role_permissions for the normalized
 * role + module; if a row exists, returns its can_<action> (when set), else the
 * caller's hardcoded `fallback`. Never throws — any error returns `fallback`,
 * so an outage can never lock users out beyond the existing hardcoded rules.
 *
 * IMPORTANT: pass the existing hardcoded authz decision as `fallback`.
 */
export async function canDo(
  role: string,
  module: string,
  action: PermAction,
  fallback: boolean,
): Promise<boolean> {
  try {
    const { supabaseAdmin } = await import('@/lib/supabaseClient');
    const { data, error } = await supabaseAdmin
      .from('role_permissions')
      .select('can_view, can_create, can_edit, can_delete')
      .eq('role', normRole(role))
      .eq('module', module)
      .maybeSingle();
    if (error) return fallback;
    return resolvePerm(data as PermRow | null, action, fallback);
  } catch {
    return fallback;
  }
}
