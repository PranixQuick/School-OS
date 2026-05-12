import type { NextRequest } from 'next/server';

// Item #1 Track C (OPTION_1_TRACK_C_ITEM_1_TEACHER_DASHBOARD), master decision Q5:
//
// Previously this function returned a DEMO_SCHOOL_ID fallback
// ('00000000-0000-0000-0000-000000000001') when the x-school-id header was
// missing. That was a silent tenant-leak risk — any route that forgot to
// validate a session would receive data scoped to the demo school instead of
// 401-ing out. Master orchestrator categorized this as doctrine-grade DPDP
// exposure and authorized a behavior change: throw on missing header so
// route failures surface loudly while the codebase is still small.
//
// Routes that previously relied on the fallback will now throw a 500. That is
// the intended outcome — those routes need explicit session handling. The
// founder accepted this risk in exchange for closing the silent-leak
// possibility.

export class MissingSchoolIdError extends Error {
  constructor() {
    super(
      'x-school-id header missing — route must be reached through authenticated middleware. ' +
        'If this is a public route, do not call getSchoolId(). If this is a protected route, ' +
        'check that the path is not in middleware.ts PUBLIC_PATHS.'
    );
    this.name = 'MissingSchoolIdError';
  }
}

// Extract school_id from request (set by middleware from session cookie).
// Throws MissingSchoolIdError if the header is absent or empty.
export function getSchoolId(req: NextRequest): string {
  const fromHeader = req.headers.get('x-school-id');
  if (!fromHeader || fromHeader.length === 0) {
    throw new MissingSchoolIdError();
  }
  return fromHeader;
}

// Read user role from middleware-injected header. Returns empty string if
// header is missing (caller decides how to handle — typically by treating
// as unauthenticated). Unlike getSchoolId, missing role is recoverable in
// many cases (e.g., a public route checking "if signed in" without requiring it).
export function getUserRole(req: NextRequest): string {
  return req.headers.get('x-user-role') ?? '';
}
