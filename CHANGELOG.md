# School OS — CHANGELOG

## 2026-05-12 — Item #1 Teacher Dashboard (Track C)

### PR #10 (merged) — Phase 2: Auth + landing page

- Added `lib/teacher-auth.ts` (`requireTeacherSession` helper, defense-in-depth IDOR guard)
- Added `app/api/teacher/me/route.ts` (today summary endpoint)
- Added `components/teacher/TodaySummary.tsx`
- Added `app/teacher/layout.tsx` (server-side session guard)
- REPLACED `app/teacher/page.tsx` with session-based landing
- MODIFIED `middleware.ts` — removed `/teacher` and `/api/teacher` from PUBLIC_PATHS
- MODIFIED `lib/authz.ts` — corrected stale role enum comment, added `isTeacher`
- MODIFIED `lib/getSchoolId.ts` — throws `MissingSchoolIdError` on missing header (was DEMO_SCHOOL_ID fallback). Silent tenant leak surface closed per master decision Q5.
- REPLACED `app/api/teacher/login/route.ts` with 410 Gone stub (anti-pattern removed)

### Manual prod application during PR #10 → PR #2a handoff

PR #10's migration file (`supabase/migrations/20260512020000_item_1_teacher_rls_and_seed.sql`) was **not** auto-applied because Supabase migrations do not run on Vercel deploy. The work it described was applied directly to production in three pieces via Supabase MCP:

1. **`item_1_current_teacher_staff_id_helper`** — applied by master orchestrator at 2026-05-12 02:31 UTC. Creates `public.current_teacher_staff_id()` (SECURITY DEFINER, granted to authenticated). Returns the `staff_id` from `school_users` for `auth.uid()`.
2. **Test teacher seed** — applied by master orchestrator at 2026-05-12 02:31 UTC via direct SQL. Created `auth.users` row for `test.teacher@schoolos.local`, linked it to `staff_id ebfae3cc-...` and `school_users id 268d6f30-...`. Credentials live in `system_state.spawn_3_thread_state.item_1_test_teacher_credentials` on the control plane.
3. **`item_1_phase3_additive_teacher_rls`** — applied by Spawn 3 at 2026-05-12 02:51 UTC. 14 additive policies across 10 tables (`timetable`, `staff_class_assignments`, `classes`, `subjects`, `homework`, `homework_submissions`, `lesson_plans`, `teacher_leave_requests`, `teacher_geo_pings`, `classroom_proofs`). All idempotent (DROP IF EXISTS + CREATE).

The original PR #10 migration file has been replaced with a tombstone comment in PR #2a.

### PR #2a (this PR) — Phase 3 Part 1: Geo check-in + Leave requests

- Added `app/api/teacher/checkin/route.ts` + `app/teacher/checkin/page.tsx`
- Added `app/api/teacher/leave/route.ts` + `app/teacher/leave/page.tsx`
- Added `components/teacher/LeaveForm.tsx`
- Added cross-tenant RLS verification tests in `app/api/teacher/__tests__/cross_tenant_block.test.ts`
- Tombstoned redundant PR #10 migration file

### Architecture note: `supabaseAdmin` in Phase 3 routes

All Phase 3 routes use `supabaseAdmin` with mandatory explicit `.eq('staff_id', ctx.staffId).eq('school_id', ctx.schoolId)` scoping, per master decision `OPTION_B_SUPABASE_ADMIN_WITH_EXPLICIT_SCOPING`. The additive RLS policies installed by `item_1_phase3_additive_teacher_rls` are the foundation for the eventual migration to `supabaseForUser(accessToken)`, scheduled for Item #15 (service-role audit). Every Phase 3 `supabaseAdmin` import carries a `// TODO(item-15): migrate to supabaseForUser` marker.
