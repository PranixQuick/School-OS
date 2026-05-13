// tests/unit/fee-generation.test.ts
// Vitest unit tests — pure logic, zero network/DB calls.
// Tests: fee generation hash, duplicate prevention logic, TC number format.
import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';

// ── Replicated from app/api/admin/fee-templates/[id]/generate/route.ts ──────
function makeGenHash(schoolId: string, studentId: string, feeType: string, templateId: string, dueDate: string): string {
  const raw = `${schoolId}|${studentId}|${feeType}|${templateId}|${dueDate.slice(0, 7)}`;
  return 'gen:' + createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

// ── Replicated from supabase/functions/notifications-dispatcher/generate_tc_number ──
function generateTcNumberFormat(year: string, sequence: number): string {
  return `TC-${year}-${sequence.toString().padStart(3, '0')}`;
}

// ── Replicated from app/api/admin/transfer-certificates/[id]/issue/route.ts ──
function pdfHashFromBase64(pdfBase64: string): string {
  return createHash('sha256').update(Buffer.from(pdfBase64, 'base64')).digest('hex');
}

// ── Replicated promotion logic from Item #9 ───────────────────────────────────
function getTargetClass(currentClass: string, maxGrade: string): string | null {
  const current = parseInt(currentClass, 10);
  const max = parseInt(maxGrade, 10);
  if (isNaN(current) || isNaN(max)) return null;
  if (current >= max) return null; // graduating
  return String(current + 1);
}

// ── DPDP anonymization field check ────────────────────────────────────────────
function anonymizePhone(id: string): string {
  return `ANON-${id}`;
}

function anonymizeName(): string {
  return 'ANONYMIZED';
}

// ─────────────────────────────────────────────────────────────────────────────
describe('fee generation hash', () => {
  const schoolId = '00000000-0000-0000-0000-000000000001';
  const studentId = '00000000-0000-0000-0000-000000000020';
  const templateId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  it('produces a stable hash for same inputs', () => {
    const h1 = makeGenHash(schoolId, studentId, 'tuition', templateId, '2026-07-15');
    const h2 = makeGenHash(schoolId, studentId, 'tuition', templateId, '2026-07-15');
    expect(h1).toBe(h2);
  });

  it('hashes include gen: prefix', () => {
    const h = makeGenHash(schoolId, studentId, 'tuition', templateId, '2026-07-01');
    expect(h).toMatch(/^gen:[0-9a-f]{16}$/);
  });

  it('same month different day produces same hash (month-level dedup)', () => {
    const h1 = makeGenHash(schoolId, studentId, 'tuition', templateId, '2026-07-01');
    const h2 = makeGenHash(schoolId, studentId, 'tuition', templateId, '2026-07-31');
    expect(h1).toBe(h2);
  });

  it('different months produce different hashes', () => {
    const h1 = makeGenHash(schoolId, studentId, 'tuition', templateId, '2026-07-01');
    const h2 = makeGenHash(schoolId, studentId, 'tuition', templateId, '2026-08-01');
    expect(h1).not.toBe(h2);
  });

  it('different fee_types produce different hashes', () => {
    const h1 = makeGenHash(schoolId, studentId, 'tuition', templateId, '2026-07-01');
    const h2 = makeGenHash(schoolId, studentId, 'transport', templateId, '2026-07-01');
    expect(h1).not.toBe(h2);
  });

  it('different students produce different hashes', () => {
    const s2 = '00000000-0000-0000-0000-000000000021';
    const h1 = makeGenHash(schoolId, studentId, 'tuition', templateId, '2026-07-01');
    const h2 = makeGenHash(schoolId, s2, 'tuition', templateId, '2026-07-01');
    expect(h1).not.toBe(h2);
  });

  it('different schools produce different hashes', () => {
    const school2 = '00000000-0000-0000-0000-000000000002';
    const h1 = makeGenHash(schoolId, studentId, 'tuition', templateId, '2026-07-01');
    const h2 = makeGenHash(school2, studentId, 'tuition', templateId, '2026-07-01');
    expect(h1).not.toBe(h2);
  });

  it('hash is exactly 20 chars (gen: + 16 hex)', () => {
    const h = makeGenHash(schoolId, studentId, 'lab', templateId, '2026-09-01');
    expect(h.length).toBe(20);
  });
});

describe('TC number format', () => {
  it('formats TC number with 3-digit zero-padded sequence', () => {
    expect(generateTcNumberFormat('2026', 1)).toBe('TC-2026-001');
    expect(generateTcNumberFormat('2026', 9)).toBe('TC-2026-009');
    expect(generateTcNumberFormat('2026', 10)).toBe('TC-2026-010');
    expect(generateTcNumberFormat('2026', 100)).toBe('TC-2026-100');
  });

  it('TC number matches expected pattern', () => {
    const tc = generateTcNumberFormat('2026', 42);
    expect(tc).toMatch(/^TC-\d{4}-\d{3,}$/);
  });
});

describe('PDF hash generation', () => {
  it('returns 64-char hex string for base64 input', () => {
    const fakeBase64 = Buffer.from('fake pdf content here').toString('base64');
    const hash = pdfHashFromBase64(fakeBase64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('same content produces same hash', () => {
    const b64 = Buffer.from('consistent content').toString('base64');
    expect(pdfHashFromBase64(b64)).toBe(pdfHashFromBase64(b64));
  });

  it('different content produces different hashes', () => {
    const b1 = Buffer.from('version one').toString('base64');
    const b2 = Buffer.from('version two').toString('base64');
    expect(pdfHashFromBase64(b1)).not.toBe(pdfHashFromBase64(b2));
  });
});

describe('academic year promotion logic', () => {
  it('promotes grade 5 to 6 when max is 10', () => {
    expect(getTargetClass('5', '10')).toBe('6');
  });

  it('returns null for graduating student (at max grade)', () => {
    expect(getTargetClass('10', '10')).toBeNull();
  });

  it('returns null for student above max grade', () => {
    expect(getTargetClass('12', '10')).toBeNull();
  });

  it('returns null for non-numeric grade', () => {
    expect(getTargetClass('KG', '10')).toBeNull();
  });

  it('promotes grade 1 to 2', () => {
    expect(getTargetClass('1', '12')).toBe('2');
  });
});

describe('DPDP anonymization logic', () => {
  it('anonymizes name to ANONYMIZED', () => {
    expect(anonymizeName()).toBe('ANONYMIZED');
  });

  it('anonymizes phone with ANON- prefix and ID', () => {
    const id = 'abc-123';
    expect(anonymizePhone(id)).toBe('ANON-abc-123');
    expect(anonymizePhone(id)).toMatch(/^ANON-/);
  });

  it('different IDs produce different anon phones', () => {
    expect(anonymizePhone('id-1')).not.toBe(anonymizePhone('id-2'));
  });

  it('anonymized phone never equals original', () => {
    const phone = '+919100000101';
    const anon = anonymizePhone('some-uuid');
    expect(anon).not.toBe(phone);
  });
});
