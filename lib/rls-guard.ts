// lib/rls-guard.ts
// Phase 0 Task 0.2 — RLS audit.
// Calls the `rls_audit()` SQL function defined in 20260421_phase0_rls_functions.sql.
// Intended to run nightly from a cron route (wired in a later phase).

import { supabaseAdmin } from './supabaseClient';

export interface RlsAuditReport {
  ok: boolean;
  scanned_at: string;
  public_tables_without_rls: string[];
  tables_with_only_permissive_policies: string[];
  tenant_tables_missing_strict_policy: string[];
  error?: string;
}

export async function auditRls(): Promise<RlsAuditReport> {
  const scanned_at = new Date().toISOString();
  const { data, error } = await supabaseAdmin.rpc('rls_audit');
  if (error) {
    return {
      ok: false,
      scanned_at,
      public_tables_without_rls: [],
      tables_with_only_permissive_policies: [],
      tenant_tables_missing_strict_policy: [],
      error: error.message,
    };
  }

  const raw = (data ?? {}) as {
    public_tables_without_rls?: string[];
    tables_with_only_permissive_policies?: string[];
    tenant_tables_missing_strict_policy?: string[];
  };

  const public_tables_without_rls = raw.public_tables_without_rls ?? [];
  const tables_with_only_permissive_policies = raw.tables_with_only_permissive_policies ?? [];
  const tenant_tables_missing_strict_policy = raw.tenant_tables_missing_strict_policy ?? [];

  const ok =
    public_tables_without_rls.length === 0 &&
    tables_with_only_permissive_policies.length === 0 &&
    tenant_tables_missing_strict_policy.length === 0;

  return {
    ok,
    scanned_at,
    public_tables_without_rls,
    tables_with_only_permissive_policies,
    tenant_tables_missing_strict_policy,
  };
}
