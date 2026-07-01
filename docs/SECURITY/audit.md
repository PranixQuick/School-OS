# Security & Access Control Audit
- **RLS Status**: 157/159 base tables have RLS enabled (2 disabled are intentionally non-tenant or handled globally).
- **Cross-Tenant Isolation**: Re-scoped all policies to enforce `su.auth_user_id = auth.uid()` mapping, preventing horizontal data leakage.
- **View Security**: 14 public views audited and confirmed as expected.
