import { describe, it, expect } from 'vitest';
import { normalizeId, validateId, bareKey, dedupBatch } from '../../lib/csv-id-validation';

describe('normalizeId', () => {
  it('trims, collapses whitespace and uppercases', () => {
    const r = normalizeId('  abc-123  ');
    expect(r.value).toBe('ABC-123');
    expect(r.changed).toBe(true);
  });

  it('reports changed=false when already normalized', () => {
    expect(normalizeId('ABC-123').changed).toBe(false);
  });

  it('strips zero-width characters and BOM', () => {
    const input = 'A' + String.fromCharCode(0x200b) + 'B' + String.fromCharCode(0xfeff);
    expect(normalizeId(input).value).toBe('AB');
  });

  it('folds dash variants and smart quotes', () => {
    const input = 'A' + String.fromCharCode(0x2013) + 'B'; // en dash
    expect(normalizeId(input).value).toBe('A-B');
  });

  it('converts full-width, Devanagari and Telugu digits to ASCII', () => {
    expect(normalizeId(String.fromCharCode(0xff11, 0xff12, 0xff13)).value).toBe('123'); // full-width 123
    expect(normalizeId(String.fromCharCode(0x0967, 0x0968)).value).toBe('12');           // Devanagari 12
    expect(normalizeId(String.fromCharCode(0x0c6f)).value).toBe('9');                     // Telugu 9
  });

  it('preserves separators / - . _', () => {
    expect(normalizeId('a/b-c.d_e').value).toBe('A/B-C.D_E');
  });

  it('flags all-zeros and TEST/DUMMY as warnings', () => {
    expect(normalizeId('0000').warnings).toContain('ALL_ZEROS');
    expect(normalizeId('test99').warnings).toContain('TEST_DUMMY');
  });

  it('handles null/undefined safely', () => {
    expect(normalizeId(null).value).toBe('');
    expect(normalizeId(undefined).value).toBe('');
  });
});

describe('validateId', () => {
  it('accepts a valid admission number', () => {
    const r = validateId('2024/001', 'admission');
    expect(r.severity).toBe('ok');
    expect(r.codes).toEqual([]);
    expect(r.bareKey).toBe('2024001');
  });

  it('accepts a valid PAN (case-insensitive input)', () => {
    expect(validateId('abcde1234f', 'pan').severity).toBe('ok');
  });

  it('rejects an invalid PAN', () => {
    const r = validateId('ABCDE1234', 'pan');
    expect(r.severity).toBe('error');
    expect(r.codes).toContain('REGEX_FAIL');
  });

  it('accepts an 11-digit UDISE', () => {
    expect(validateId('12345678901', 'udise').severity).toBe('ok');
  });

  it('treats a short all-digit UDISE as a soft Excel-zero-strip warning', () => {
    const r = validateId('1234567', 'udise');
    expect(r.severity).toBe('warn');
    expect(r.codes).toContain('EXCEL_ZERO_STRIP');
    expect(r.codes).not.toContain('REGEX_FAIL');
  });

  it('flags illegal characters as a hard error', () => {
    const r = validateId('2024@001', 'admission');
    expect(r.severity).toBe('error');
    expect(r.codes).toContain('ILLEGAL_CHAR');
  });

  it('errors on a blank mandatory value but not an optional one', () => {
    expect(validateId('', 'admission', { mandatory: true }).severity).toBe('error');
    const opt = validateId('', 'admission');
    expect(opt.severity).toBe('ok');
    expect(opt.bareKey).toBe('');
  });

  it('warns (but stays valid) on mixed separators', () => {
    const r = validateId('A/B-C', 'admission');
    expect(r.severity).toBe('warn');
    expect(r.codes).toContain('MIXED_SEPARATORS');
  });
});

describe('bareKey', () => {
  it('strips separators and uppercases', () => {
    expect(bareKey('2024/001-a')).toBe('2024001A');
  });
});

describe('dedupBatch', () => {
  it('classifies per-institution duplicates correctly', () => {
    const verdicts = dedupBatch([
      { rowIndex: 0, bareKey: '2024001', schoolId: 'S1', year: '2024', name: 'Asha' },
      { rowIndex: 1, bareKey: '2024001', schoolId: 'S1', year: '2024', name: 'Asha' },
      { rowIndex: 2, bareKey: '2024001', schoolId: 'S1', year: '2025', name: 'Asha' },
      { rowIndex: 3, bareKey: '2024001', schoolId: 'S1', year: '2024', name: 'Ravi' },
      { rowIndex: 4, bareKey: '2024001', schoolId: 'S2', year: '2024', name: 'Asha' },
      { rowIndex: 5, bareKey: '', schoolId: 'S1' },
    ]);
    expect(verdicts[0].code).toBeNull();
    expect(verdicts[1].code).toBe('DUP_HARD');
    expect(verdicts[2].code).toBe('DUP_SOFT_READMISSION');
    expect(verdicts[3].code).toBe('DUP_CRITICAL_NAME_MISMATCH');
    expect(verdicts[4].code).toBeNull();   // different school — never deduped
    expect(verdicts[5].code).toBeNull();   // empty key — passed through
  });
});
