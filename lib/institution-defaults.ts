// lib/institution-defaults.ts
// Phase 1 Task 1.5 — canonical defaults for new school_k10 institutions.
// Used by:
//   - supabase/migrations/20260506_phase1_backfill.sql (SQL equivalent)
//   - POST /api/v2/institutions (auto-creates AY + programme on school_k10)
//
// Keep in sync with the SQL backfill constants. If you change a value here,
// update the SQL migration comment and vice versa.

export const DEFAULT_TERM_STRUCTURE = {
  terms: [
    { code: 'FA1', start: '2026-06-15', end: '2026-07-31' },
    { code: 'SA1', start: '2026-09-20', end: '2026-10-10' },
    { code: 'FA2', start: '2026-11-01', end: '2026-12-15' },
    { code: 'SA2', start: '2027-03-01', end: '2027-03-25' },
  ],
};

export const DEFAULT_CBSE_GRADING_SCHEMA = {
  scale: 'cbse_9pt',
  grades: [
    { code: 'A1', min: 91, max: 100, gp: 10 },
    { code: 'A2', min: 81, max: 90,  gp: 9  },
    { code: 'B1', min: 71, max: 80,  gp: 8  },
    { code: 'B2', min: 61, max: 70,  gp: 7  },
    { code: 'C1', min: 51, max: 60,  gp: 6  },
    { code: 'C2', min: 41, max: 50,  gp: 5  },
    { code: 'D',  min: 33, max: 40,  gp: 4  },
    { code: 'E',  min: 0,  max: 32,  gp: 0  },
  ],
};

// Returns '2026-27' style label for the academic year containing the given date.
// Indian academic year runs April–March.
export function currentAcademicYearLabel(date: Date = new Date()): string {
  const month = date.getMonth() + 1; // 1-based
  const year  = date.getFullYear();
  const startYear = month >= 4 ? year : year - 1;
  const endYear   = startYear + 1;
  return `${startYear}-${String(endYear).slice(2)}`;
}

// Start/end dates for the academic year label (e.g. '2026-27' → 2026-06-01 / 2027-04-30)
export function academicYearDates(label: string): { start_date: string; end_date: string } {
  const startYear = parseInt(label.slice(0, 4), 10);
  return {
    start_date: `${startYear}-06-01`,
    end_date:   `${startYear + 1}-04-30`,
  };
}
