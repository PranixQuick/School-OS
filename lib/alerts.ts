// lib/alerts.ts
// Shared helper for the in-app staff alert feed (public.staff_alerts).
// Workflow events call createStaffAlerts() to notify the roles that must act on
// or see an event in real time (e.g. a fee payment notifies accountant + principal
// + owner). Best-effort: it never throws and never blocks the caller's main action,
// so a failed alert can't fail a payment/approval.

import { supabaseAdmin } from '@/lib/supabaseClient';

export interface StaffAlertInput {
  schoolId: string;
  targetRoles?: string[];        // one alert row per role
  targetUserId?: string | null;  // and/or a specific school_users.id
  type: string;                  // 'fee_payment' | 'fee_change' | ...
  title: string;
  message: string;
  module?: string | null;        // 'fees' | 'leave' | ...
  referenceId?: string | null;   // domain row id (e.g. fee id)
  href?: string | null;          // deep link for click-through
}

export async function createStaffAlerts(input: StaffAlertInput): Promise<void> {
  try {
    const base = {
      school_id: input.schoolId,
      type: input.type,
      title: input.title,
      message: input.message,
      module: input.module ?? null,
      reference_id: input.referenceId ?? null,
      href: input.href ?? null,
    };

    const rows: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    for (const role of input.targetRoles ?? []) {
      if (!role || seen.has(role)) continue;
      seen.add(role);
      rows.push({ ...base, target_role: role });
    }
    if (input.targetUserId) rows.push({ ...base, target_user_id: input.targetUserId });

    if (rows.length === 0) return;

    const { error } = await supabaseAdmin.from('staff_alerts').insert(rows);
    if (error) console.error('[staff_alerts] insert failed (non-fatal):', error.message);
  } catch (e) {
    console.error('[staff_alerts] unexpected error (non-fatal):', e);
  }
}
