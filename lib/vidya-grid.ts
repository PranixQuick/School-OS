// lib/vidya-grid.ts
// Outbound VidyaGrid enrollment client (School OS → VIDYA GRID, server-to-server).
//
// Contract (proven against PranixQuick/VIDYA-GRID app/api/enroll/route.ts, Phase 4c
// service-token mode + lib/validation.ts enrollSchema):
//   POST {VIDYA_GRID_API_URL}/api/enroll
//   Header: Authorization: Bearer <VIDYA_GRID_SERVICE_KEY>
//   Body:   { student_name, class_level:'9'|'10', language, board, school_id, parent_name, parent_contact, erp_student_id }
//   200:    { success, student_id: <VG user uuid>, erp_student_id (echo), ... }
// School OS stores response.student_id as students.vidya_grid_user_id, keyed by
// erp_student_id = students.id.
//
// NOTE: the single /api/enroll endpoint is rate-limited 30/hr/IP on the VG side.

export interface VgEnrollInput {
  erp_student_id: string;   // School OS students.id (UUID)
  school_id: string;        // VG school id = schools.vidya_grid_school_id
  student_name: string;
  class_level: '9' | '10';
  parent_name: string;
  parent_contact: string;
  board?: string;           // default SCERT-AP
  language?: 'te' | 'en';   // default te
}

export interface VgEnrollResult {
  ok: boolean;
  status: number;
  student_id?: string;      // VG user uuid → students.vidya_grid_user_id
  erp_student_id?: string;  // echoed back by VG
  error?: string;
}

/** Returns whether the outbound enrollment integration is configured. */
export function vidyaGridConfigured(): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!process.env.VIDYA_GRID_API_URL) missing.push('VIDYA_GRID_API_URL');
  if (!process.env.VIDYA_GRID_SERVICE_KEY) missing.push('VIDYA_GRID_SERVICE_KEY');
  return { ok: missing.length === 0, missing };
}

function extractError(data: unknown, status: number): string {
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    const e = o.error;
    if (e && typeof e === 'object') {
      const eo = e as Record<string, unknown>;
      return String(eo.message ?? eo.code ?? `http_${status}`);
    }
    if (typeof e === 'string') return e;
    if (typeof o.message === 'string') return o.message;
  }
  return `http_${status}`;
}

export async function enrollStudentInVidyaGrid(input: VgEnrollInput): Promise<VgEnrollResult> {
  const baseUrl = process.env.VIDYA_GRID_API_URL;
  const serviceKey = process.env.VIDYA_GRID_SERVICE_KEY;
  if (!baseUrl || !serviceKey) {
    return { ok: false, status: 0, error: 'vidya_grid_not_configured' };
  }

  const url = `${baseUrl.replace(/\/+$/, '')}/api/enroll`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        student_name: input.student_name,
        class_level: input.class_level,
        language: input.language ?? 'te',
        board: input.board ?? 'SCERT-AP',
        school_id: input.school_id,
        parent_name: input.parent_name,
        parent_contact: input.parent_contact,
        erp_student_id: input.erp_student_id,
      }),
    });
  } catch (e) {
    return { ok: false, status: 0, error: `network_error: ${String(e)}` };
  }

  let data: unknown = null;
  try { data = await res.json(); } catch { /* non-JSON body */ }

  if (!res.ok) {
    return { ok: false, status: res.status, error: extractError(data, res.status) };
  }

  const studentId = (data && typeof data === 'object')
    ? (data as Record<string, unknown>).student_id
    : undefined;
  if (typeof studentId !== 'string' || !studentId) {
    return { ok: false, status: res.status, error: 'no_student_id_in_response' };
  }

  const echoed = (data as Record<string, unknown>).erp_student_id;
  return {
    ok: true,
    status: res.status,
    student_id: studentId,
    erp_student_id: typeof echoed === 'string' ? echoed : undefined,
  };
}
