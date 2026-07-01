# Security & Access Control Audit
- **RLS Status**: 157/159 base tables have RLS enabled (2 disabled are intentionally non-tenant or handled globally).
- **Cross-Tenant Isolation**: Re-scoped all policies to enforce `su.school_id` checks referencing active session mapping, preventing horizontal data leakage (SEC-W0-12).
- **View Security**: 14 public views audited and confirmed as expected.
- **SECURITY DEFINER Functions**: PUBLIC execute privilege revoked on all 21 definer functions (PR #253).
- **Route Handlers**: Authenticated sessions enforced via secure getSession checks across 17 API handlers (PRs #248-#252).
