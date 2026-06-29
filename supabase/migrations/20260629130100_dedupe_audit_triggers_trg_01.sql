-- TRG-01 (P1-04): 6 tables had duplicate audit triggers (audit_<t> AND trg_audit_<t>), both
-- calling audit_row_change on the same INSERT/UPDATE/DELETE events => two identical audit rows
-- per change. Drop the legacy audit_<t>; keep trg_audit_<t>.
-- NOTE: applied to prod rqdnxdvuypekpmxbteju via MCP apply_migration on 2026-06-29 and verified
-- (each table now has exactly 1 audit trigger). Committed here for repo source-of-truth parity.

DROP TRIGGER IF EXISTS audit_academic_records ON public.academic_records;
DROP TRIGGER IF EXISTS audit_health_incidents ON public.health_incidents;
DROP TRIGGER IF EXISTS audit_parent_complaints ON public.parent_complaints;
DROP TRIGGER IF EXISTS audit_parents ON public.parents;
DROP TRIGGER IF EXISTS audit_students ON public.students;
DROP TRIGGER IF EXISTS audit_transfer_certificates ON public.transfer_certificates;
