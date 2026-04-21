-- Phase 1 Task 1.6 — nightly institution consistency checker
-- No DDL changes. Only a stored function that the abuse-monitor cron calls.
-- Checks for rows with school_id but NULL institution_id across all dual-write
-- tables. Inserts a warn-level alert if any orphan rows are found.
-- Idempotent: CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION check_institution_consistency()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_orphans jsonb := '[]'::jsonb;
  v_count   int;
  v_alert   text;
BEGIN
  -- Students without institution_id
  SELECT COUNT(*) INTO v_count FROM students WHERE school_id IS NOT NULL AND institution_id IS NULL;
  IF v_count > 0 THEN
    v_orphans := v_orphans || jsonb_build_object('table', 'students', 'orphan_count', v_count);
  END IF;

  -- Staff without institution_id
  SELECT COUNT(*) INTO v_count FROM staff WHERE school_id IS NOT NULL AND institution_id IS NULL;
  IF v_count > 0 THEN
    v_orphans := v_orphans || jsonb_build_object('table', 'staff', 'orphan_count', v_count);
  END IF;

  -- school_users without institution_id
  SELECT COUNT(*) INTO v_count FROM school_users WHERE school_id IS NOT NULL AND institution_id IS NULL;
  IF v_count > 0 THEN
    v_orphans := v_orphans || jsonb_build_object('table', 'school_users', 'orphan_count', v_count);
  END IF;

  -- inquiries without institution_id
  SELECT COUNT(*) INTO v_count FROM inquiries WHERE school_id IS NOT NULL AND institution_id IS NULL;
  IF v_count > 0 THEN
    v_orphans := v_orphans || jsonb_build_object('table', 'inquiries', 'orphan_count', v_count);
  END IF;

  -- report_narratives without institution_id
  SELECT COUNT(*) INTO v_count FROM report_narratives WHERE school_id IS NOT NULL AND institution_id IS NULL;
  IF v_count > 0 THEN
    v_orphans := v_orphans || jsonb_build_object('table', 'report_narratives', 'orphan_count', v_count);
  END IF;

  -- report_narratives without academic_year_id
  SELECT COUNT(*) INTO v_count FROM report_narratives WHERE institution_id IS NOT NULL AND academic_year_id IS NULL;
  IF v_count > 0 THEN
    v_orphans := v_orphans || jsonb_build_object('table', 'report_narratives.academic_year_id', 'orphan_count', v_count);
  END IF;

  -- academic_records without institution_id
  SELECT COUNT(*) INTO v_count FROM academic_records WHERE school_id IS NOT NULL AND institution_id IS NULL;
  IF v_count > 0 THEN
    v_orphans := v_orphans || jsonb_build_object('table', 'academic_records', 'orphan_count', v_count);
  END IF;

  -- schools without institution_id (critical — means backfill failed for a school)
  SELECT COUNT(*) INTO v_count FROM schools WHERE institution_id IS NULL;
  IF v_count > 0 THEN
    v_orphans := v_orphans || jsonb_build_object('table', 'schools', 'orphan_count', v_count);
  END IF;

  -- Insert alert only if orphans found
  IF jsonb_array_length(v_orphans) > 0 THEN
    v_alert := 'institution_consistency_fail';
    INSERT INTO alerts (alert_type, severity, details, created_at)
    VALUES (
      v_alert,
      'warn',
      jsonb_build_object(
        'orphan_tables', v_orphans,
        'checked_at', now()
      ),
      now()
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'ok', jsonb_array_length(v_orphans) = 0,
    'orphan_tables', v_orphans,
    'checked_at', now()
  );
END;
$$;

-- Quick smoke test (should return ok=true with 0 orphans post-backfill)
-- SELECT check_institution_consistency();
