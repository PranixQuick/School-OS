// lib/receipt.ts
// Shared fee-receipt-number allocator. Format: RCPT/{SCHOOL_CODE}/{ACADEMIC_YEAR}/{SEQ}
// e.g. RCPT/SUCH/2025-26/000001
//
// Used by: admin mark-paid, Razorpay webhook, parent confirm-payment.
// Atomic + concurrent-safe via SQL function next_fee_receipt_no (single-statement upsert+RETURNING).
// Returns null on failure — callers decide fail-closed (offline) vs best-effort (online).

import { supabaseAdmin } from '@/lib/supabaseClient';

/** Indian academic year (Apr-Mar). e.g. 2025-26. IST-based. */
export function deriveAcademicYear(d: Date = new Date()): string {
  const ist = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const y = ist.getFullYear();
  const m = ist.getMonth() + 1; // 1-12
  const startYear = m >= 4 ? y : y - 1;
  const endYY = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endYY}`;
}

/** Derive a short uppercase code from a slug when no receipt_prefix is set. */
export function derivePrefix(slug: string | null | undefined, fallback = 'SCH'): string {
  if (!slug) return fallback;
  const alpha = slug.replace(/[^a-zA-Z]/g, '').toUpperCase();
  return alpha.slice(0, 4) || fallback;
}

/**
 * Allocate the next receipt number for a school.
 * Resolves prefix (schools.receipt_prefix ?? derived from slug) and academic year
 * (academic_years.is_current label ?? derived Indian AY), then calls the atomic SQL allocator.
 * @returns formatted receipt string, or null on failure.
 */
export async function allocateReceiptNumber(schoolId: string): Promise<string | null> {
  try {
    const { data: school } = await supabaseAdmin
      .from('schools')
      .select('receipt_prefix, slug')
      .eq('id', schoolId)
      .maybeSingle();

    const prefix = (school?.receipt_prefix as string | null) ?? derivePrefix(school?.slug as string | null);

    const { data: ay } = await supabaseAdmin
      .from('academic_years')
      .select('label')
      .eq('school_id', schoolId)
      .eq('is_current', true)
      .maybeSingle();

    const academicYear = (ay?.label as string | null) ?? deriveAcademicYear();

    const { data, error } = await supabaseAdmin.rpc('next_fee_receipt_no', {
      p_school: schoolId,
      p_ay: academicYear,
      p_prefix: prefix,
    });
    if (error) {
      console.error('[allocateReceiptNumber] rpc failed:', error.message);
      return null;
    }
    return (data as string | null) ?? null;
  } catch (e) {
    console.error('[allocateReceiptNumber] failed:', e);
    return null;
  }
}
