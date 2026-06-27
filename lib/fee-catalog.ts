// lib/fee-catalog.ts
// Canonical fee catalogue for Indian institutions (KG → PG). Drives the admin
// fee picker and the parent fee breakdown so both speak the same vocabulary.
// Blackbaud Challenge 01 focus is NON-TUITION collection; tuition reuses the
// same rail and is included for completeness. Keys are stored verbatim in
// fees.fee_type (text), so existing values (tuition/exam/activity/transport/
// hostel/library/lab/admission/uniform/books) remain valid.

export type FeeGroupId = 'core' | 'academic' | 'activities' | 'residential' | 'other';

export interface FeeTypeDef {
  key: string;        // value stored in fees.fee_type
  label: string;      // display label
  icon: string;       // emoji glyph for cards/rows
  group: FeeGroupId;
  tuition?: boolean;  // true only for the tuition line
}

// Order matters — non-tuition first (challenge focus), tuition last.
export const FEE_CATALOG: FeeTypeDef[] = [
  { key: 'registration', label: 'Registration / Admission', icon: '📝', group: 'core' },
  { key: 'admission',    label: 'Admission',                 icon: '🪪', group: 'core' },
  { key: 'transport',    label: 'Transport / Bus',           icon: '🚌', group: 'core' },
  { key: 'uniform',      label: 'Uniform',                   icon: '👕', group: 'core' },

  { key: 'exam',         label: 'Examination',               icon: '🧪', group: 'academic' },
  { key: 'books',        label: 'Books & Stationery',        icon: '📚', group: 'academic' },
  { key: 'lab',          label: 'Laboratory',                icon: '🔬', group: 'academic' },
  { key: 'library',      label: 'Library',                   icon: '📖', group: 'academic' },
  { key: 'technology',   label: 'Smart Class / Technology',  icon: '💻', group: 'academic' },

  { key: 'activity',     label: 'Activity / Co-curricular',  icon: '🎨', group: 'activities' },
  { key: 'events',       label: 'Events / Tickets',          icon: '🎟️', group: 'activities' },
  { key: 'sports',       label: 'Sports',                    icon: '⚽', group: 'activities' },
  { key: 'excursion',    label: 'Field Trip / Excursion',    icon: '🚐', group: 'activities' },
  { key: 'yearbook',     label: 'Yearbook',                  icon: '📔', group: 'activities' },

  { key: 'meals',        label: 'Meals / Midday',            icon: '🍱', group: 'residential' },
  { key: 'hostel',       label: 'Hostel & Mess',             icon: '🏠', group: 'residential' },

  { key: 'development',  label: 'Development Fee',           icon: '🏗️', group: 'other' },
  { key: 'late_fee',     label: 'Late Fee / Fine',           icon: '⏰', group: 'other' },
  { key: 'misc',         label: 'Miscellaneous',             icon: '💼', group: 'other' },

  { key: 'tuition',      label: 'Tuition',                   icon: '🎓', group: 'core', tuition: true },
];

export const FEE_GROUPS: { id: FeeGroupId; label: string }[] = [
  { id: 'core',        label: 'Core' },
  { id: 'academic',    label: 'Academic' },
  { id: 'activities',  label: 'Activities & Events' },
  { id: 'residential', label: 'Residential & Meals' },
  { id: 'other',       label: 'Other' },
];

const BY_KEY: Record<string, FeeTypeDef> = Object.fromEntries(
  FEE_CATALOG.map((f) => [f.key, f]),
);

export function feeTypeDef(key: string | null | undefined): FeeTypeDef {
  const k = (key ?? '').toLowerCase();
  return (
    BY_KEY[k] ?? {
      key: k || 'other',
      label: k ? k.charAt(0).toUpperCase() + k.slice(1) : 'Other',
      icon: '💰',
      group: 'other',
    }
  );
}

export const FEE_TYPE_KEYS: string[] = FEE_CATALOG.map((f) => f.key);
