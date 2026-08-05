DO $$
DECLARE
    idx_count integer := 0;
    con_count integer := 0;
    target_idx_name text;
    target_con_name text;
    r RECORD;
BEGIN
    -- 1. Identify unique constraints containing staff_id, day_of_week, and period
    FOR r IN (
        SELECT conname
        FROM pg_constraint 
        WHERE conrelid = 'public.timetable'::regclass 
          AND contype = 'u'
          AND pg_get_constraintdef(oid) LIKE '%staff_id%'
          AND pg_get_constraintdef(oid) LIKE '%day_of_week%'
          AND pg_get_constraintdef(oid) LIKE '%period%'
    ) LOOP
        con_count := con_count + 1;
        target_con_name := r.conname;
    END LOOP;

    -- 2. Identify unique indexes containing staff_id, day_of_week, and period (excluding PKs)
    FOR r IN (
        SELECT c.relname as idxname
        FROM pg_index i
        JOIN pg_class c ON c.oid = i.indexrelid
        WHERE i.indrelid = 'public.timetable'::regclass
          AND i.indisunique
          AND NOT i.indisprimary
          AND pg_get_indexdef(i.indexrelid) LIKE '%staff_id%'
          AND pg_get_indexdef(i.indexrelid) LIKE '%day_of_week%'
          AND pg_get_indexdef(i.indexrelid) LIKE '%period%'
    ) LOOP
        idx_count := idx_count + 1;
        target_idx_name := r.idxname;
    END LOOP;

    -- 3. Assert exactly one match exists to prevent accidental drops or ambiguity
    IF (con_count + idx_count) = 0 THEN
        RAISE EXCEPTION 'No unique constraint or index found on public.timetable for teacher/period scheduling.';
    ELIF (con_count + idx_count) > 1 THEN
        RAISE EXCEPTION 'Ambiguity: found multiple candidate unique constraints/indexes (% constraints, % indexes).', con_count, idx_count;
    END IF;

    -- 4. Drop the single identified target
    IF con_count = 1 THEN
        EXECUTE 'ALTER TABLE public.timetable DROP CONSTRAINT ' || quote_ident(target_con_name);
    ELIF idx_count = 1 THEN
        EXECUTE 'DROP INDEX IF EXISTS public.' || quote_ident(target_idx_name);
    END IF;
END$$;

-- Create the new wide unique index
CREATE UNIQUE INDEX IF NOT EXISTS timetable_staff_subject_period_unique 
  ON public.timetable (school_id, staff_id, day_of_week, period, subject_id);
