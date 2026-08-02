-- HOD scope: which colleges + which department each HOD can see
CREATE TABLE IF NOT EXISTS staff_hod_scope (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  department TEXT NOT NULL CHECK (department IN ('science','commerce','arts','engineering','other')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  UNIQUE (staff_id, school_id, department)
);

CREATE INDEX IF NOT EXISTS idx_staff_hod_scope_staff ON staff_hod_scope(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_hod_scope_school_dept ON staff_hod_scope(school_id, department);

-- RLS
ALTER TABLE staff_hod_scope ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HOD reads own scope" ON staff_hod_scope FOR SELECT
  USING (staff_id = auth.uid() OR EXISTS (
    SELECT 1 FROM staff WHERE staff.id = auth.uid() AND staff.role IN ('owner','admin','principal')
  ));

CREATE POLICY "Owner/admin/principal manages scope" ON staff_hod_scope FOR ALL
  USING (EXISTS (
    SELECT 1 FROM staff WHERE staff.id = auth.uid() AND staff.role IN ('owner','admin','principal')
  ));

-- Update staff.role CHECK constraint to include 'hod' if not already
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE staff ADD CONSTRAINT staff_role_check CHECK (
  role IN ('owner','principal','admin_staff','admin','accountant','viewer','counsellor','teacher','hod')
);
