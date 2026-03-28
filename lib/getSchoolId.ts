import { NextRequest } from 'next/server';

// Demo school ID — used as fallback for backward compatibility during transition
export const DEMO_SCHOOL_ID = '00000000-0000-0000-0000-000000000001';

// Extract school_id from request (set by middleware from session cookie)
// Falls back to demo school for backward compatibility
export function getSchoolId(req: NextRequest): string {
  const fromHeader = req.headers.get('x-school-id');
  if (fromHeader && fromHeader.length > 0) return fromHeader;
  return DEMO_SCHOOL_ID;
}

export function getUserRole(req: NextRequest): string {
  return req.headers.get('x-user-role') ?? 'admin';
}
