import { describe, it, expect } from 'vitest';
import { normRole, resolvePerm, type PermRow } from '../../lib/permissions';

describe('normRole', () => {
  it('maps legacy admin -> admin_staff', () => {
    expect(normRole('admin')).toBe('admin_staff');
  });
  it('leaves canonical roles unchanged', () => {
    expect(normRole('admin_staff')).toBe('admin_staff');
    expect(normRole('teacher')).toBe('teacher');
    expect(normRole('counsellor')).toBe('counsellor');
    expect(normRole('owner')).toBe('owner');
  });
});

describe('resolvePerm (fallback-safe)', () => {
  const row: PermRow = { can_view: true, can_create: false, can_edit: true, can_delete: null };

  it('falls back when there is no row', () => {
    expect(resolvePerm(null, 'view', true)).toBe(true);
    expect(resolvePerm(undefined, 'view', false)).toBe(false);
  });

  it('honors an explicit true/false cell', () => {
    expect(resolvePerm(row, 'view', false)).toBe(true);    // can_view true overrides fallback false
    expect(resolvePerm(row, 'create', true)).toBe(false);  // can_create false overrides fallback true
    expect(resolvePerm(row, 'edit', false)).toBe(true);
  });

  it('falls back when the cell is NULL (unset)', () => {
    expect(resolvePerm(row, 'delete', true)).toBe(true);
    expect(resolvePerm(row, 'delete', false)).toBe(false);
  });
});
