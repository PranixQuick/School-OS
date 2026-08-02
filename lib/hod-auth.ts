import { getSession } from './auth';

export class HodAuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'HodAuthError';
    this.status = status;
  }
}

export async function requireHodSession(req: any) {
  const session = await getSession(req);
  if (!session) throw new HodAuthError(401, 'Not authenticated');
  if (session.userRole !== 'hod') throw new HodAuthError(403, 'Not an HOD');
  
  const hod_scope = (session as any).hod_scope;
  if (!hod_scope || hod_scope.length === 0)
    throw new HodAuthError(403, 'HOD has no scope assigned');
    
  return {
    userId: session.userId,
    schoolIds: hod_scope.map((s: any) => s.school_id),
    departments: [...new Set(hod_scope.map((s: any) => s.department))],
    scope: hod_scope, // full pairs for fine-grained checks
  };
}
