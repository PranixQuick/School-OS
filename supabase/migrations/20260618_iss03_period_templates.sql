-- 20260618_iss03_period_templates.sql
-- ISS-3 (P3.1b): institution-type period templates (App. A).
--
-- A reference/config table of non-core period kinds per institution type, used
-- to pre-fill timetables and to create the corresponding subjects. `kind`
-- mirrors the subjects.subject_kind taxonomy so a template row maps 1:1 to a
-- subject when an admin adds it. `institution_type` stores institution_type
-- enum *labels* as text (decoupled from the enum so template config can evolve
-- independently).
--
-- Additive + idempotent: new table, unique (institution_type, kind,
-- default_name), all seed inserts use ON CONFLICT DO NOTHING.

BEGIN;

CREATE TABLE IF NOT EXISTS public.period_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_type text NOT NULL,
  kind            text NOT NULL,
  default_name    text NOT NULL,
  default_minutes integer,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT period_templates_kind_check
    CHECK (kind IN ('academic', 'lab', 'sports', 'activity', 'seminar', 'library', 'break', 'remedial'))
);

CREATE UNIQUE INDEX IF NOT EXISTS period_templates_unique
  ON public.period_templates (institution_type, kind, default_name);

-- Govt primary / upper-primary (~35-40 min)
INSERT INTO public.period_templates (institution_type, kind, default_name, default_minutes, sort_order)
SELECT it, t.kind, t.name, t.mins, t.ord
FROM unnest(ARRAY['govt_school','govt_aided_school','welfare_school','primary_school','upper_primary']) AS it
CROSS JOIN (VALUES
  ('activity','Morning Assembly',20,1),
  ('sports','PT / Drill',35,2),
  ('break','Mid-Day Meal Break',40,3),
  ('activity','Art & Craft',35,4),
  ('activity','Moral / Value Education',35,5),
  ('library','Library',35,6),
  ('activity','Work Education',35,7),
  ('remedial','Remedial',35,8)
) AS t(kind,name,mins,ord)
ON CONFLICT (institution_type, kind, default_name) DO NOTHING;

-- Govt high (~40-45 min)
INSERT INTO public.period_templates (institution_type, kind, default_name, default_minutes, sort_order)
SELECT it, t.kind, t.name, t.mins, t.ord
FROM unnest(ARRAY['high_school']) AS it
CROSS JOIN (VALUES
  ('activity','Morning Assembly',20,1),
  ('sports','PT / Games',40,2),
  ('break','Mid-Day Meal Break',40,3),
  ('lab','Computer Lab',45,4),
  ('lab','Science Lab',45,5),
  ('library','Library',40,6),
  ('activity','Value Education',40,7),
  ('activity','Art',40,8),
  ('activity','Work Education',40,9),
  ('remedial','Remedial',40,10)
) AS t(kind,name,mins,ord)
ON CONFLICT (institution_type, kind, default_name) DO NOTHING;

-- Private school (CBSE / state board) (~40-45 min)
INSERT INTO public.period_templates (institution_type, kind, default_name, default_minutes, sort_order)
SELECT it, t.kind, t.name, t.mins, t.ord
FROM unnest(ARRAY['school_k10','school_k12']) AS it
CROSS JOIN (VALUES
  ('activity','Morning Assembly',20,1),
  ('sports','Physical Education (PET)',40,2),
  ('lab','Computer Lab',45,3),
  ('library','Library',40,4),
  ('activity','Moral Science',40,5),
  ('activity','Art',40,6),
  ('activity','Music',40,7),
  ('lab','Science Practical',45,8),
  ('activity','Club / Activity',40,9),
  ('remedial','Remedial',40,10),
  ('break','Lunch Break',40,11)
) AS t(kind,name,mins,ord)
ON CONFLICT (institution_type, kind, default_name) DO NOTHING;

-- Junior / Intermediate college (~50-60 min)
INSERT INTO public.period_templates (institution_type, kind, default_name, default_minutes, sort_order)
SELECT it, t.kind, t.name, t.mins, t.ord
FROM unnest(ARRAY['junior_college','intermediate_college']) AS it
CROSS JOIN (VALUES
  ('lab','Physics Lab',90,1),
  ('lab','Chemistry Lab',90,2),
  ('lab','Biology Lab',60,3),
  ('seminar','Competitive Coaching',60,4),
  ('seminar','Seminar',60,5),
  ('seminar','Mentoring',50,6),
  ('sports','Sports',50,7),
  ('activity','Ethics / EVS',50,8)
) AS t(kind,name,mins,ord)
ON CONFLICT (institution_type, kind, default_name) DO NOTHING;

-- Degree / University (incl. MBA, Medical) (~60 min)
INSERT INTO public.period_templates (institution_type, kind, default_name, default_minutes, sort_order)
SELECT it, t.kind, t.name, t.mins, t.ord
FROM unnest(ARRAY['degree_college','university','mba','medical']) AS it
CROSS JOIN (VALUES
  ('library','Library',60,1),
  ('seminar','Tutorial / Seminar',60,2),
  ('sports','Sports / NCC / NSS',60,3),
  ('lab','Lab Practical',120,4),
  ('seminar','Mentoring',60,5),
  ('activity','Open Elective',60,6)
) AS t(kind,name,mins,ord)
ON CONFLICT (institution_type, kind, default_name) DO NOTHING;

-- Engineering
INSERT INTO public.period_templates (institution_type, kind, default_name, default_minutes, sort_order)
SELECT it, t.kind, t.name, t.mins, t.ord
FROM unnest(ARRAY['engineering']) AS it
CROSS JOIN (VALUES
  ('lab','Science Lab',120,1),
  ('lab','Workshop / Engineering Drawing',180,2),
  ('lab','Programming Lab',120,3),
  ('seminar','Seminar / Review',60,4),
  ('library','Library',60,5),
  ('sports','NCC / NSS / Games',60,6),
  ('seminar','Tutorial',60,7)
) AS t(kind,name,mins,ord)
ON CONFLICT (institution_type, kind, default_name) DO NOTHING;

-- ITI / Polytechnic / Vocational (60 min)
INSERT INTO public.period_templates (institution_type, kind, default_name, default_minutes, sort_order)
SELECT it, t.kind, t.name, t.mins, t.ord
FROM unnest(ARRAY['polytechnic','vocational']) AS it
CROSS JOIN (VALUES
  ('lab','Workshop Practical',60,1),
  ('lab','Engineering Drawing',60,2),
  ('activity','Employability / Soft Skills',60,3),
  ('academic','Workshop Calculation & Science',60,4),
  ('activity','Safety / Field Visit',60,5)
) AS t(kind,name,mins,ord)
ON CONFLICT (institution_type, kind, default_name) DO NOTHING;

-- Coaching / Tuition
INSERT INTO public.period_templates (institution_type, kind, default_name, default_minutes, sort_order)
SELECT it, t.kind, t.name, t.mins, t.ord
FROM unnest(ARRAY['coaching','coaching_center','tuition_center']) AS it
CROSS JOIN (VALUES
  ('seminar','Doubt Session',60,1),
  ('seminar','Weekly / Grand Test',90,2),
  ('academic','Revision',60,3),
  ('seminar','Counselling',45,4)
) AS t(kind,name,mins,ord)
ON CONFLICT (institution_type, kind, default_name) DO NOTHING;

-- Anganwadi / Pre-primary
INSERT INTO public.period_templates (institution_type, kind, default_name, default_minutes, sort_order)
SELECT it, t.kind, t.name, t.mins, t.ord
FROM unnest(ARRAY['anganwadi','pre_school','kg']) AS it
CROSS JOIN (VALUES
  ('break','Feeding / Poshan',30,1),
  ('activity','Circle Time / Bal-Vatika',30,2),
  ('activity','Growth Monitoring / Weighing',30,3),
  ('activity','Immunization / Mamta Diwas',30,4),
  ('activity','Storytelling / Play',30,5),
  ('seminar','Mother Meeting / ECCE',45,6)
) AS t(kind,name,mins,ord)
ON CONFLICT (institution_type, kind, default_name) DO NOTHING;

COMMIT;

-- Rollback:
--   DROP TABLE IF EXISTS public.period_templates;
