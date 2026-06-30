// INFRA-2: Cron Control API v4
// PLATFORM NOTE: Supabase Management API /database/query runs as postgres role.
// postgres cannot write cron.job (requires supabase_admin superuser).
// This is a hard Supabase platform constraint with no workaround via external API.
// This function therefore:
//   - status: works (SELECT on cron.job is permitted)
//   - pause/resume: returns the exact SQL for Supabase Studio (1 action, 10 seconds)
// Once Supabase exposes a dedicated pg_cron management endpoint, update this function.

const DISPATCH_SECRET = Deno.env.get('DISPATCH_SECRET')!;
const MANAGEMENT_API_KEY = Deno.env.get('PRANIX_SUPABASE_MANAGEMENT_KEY');
const PROJECT_REF = 'rqdnxdvuypekpmxbteju';

const ALLOWED_JOBS = [
  'schoolos_notifications_dispatcher',
  'regulatory_scraper',
  'school_health_monitor',
  'schoolos_classroom_proofs_cleanup_hourly',
  'schoolos_consistency_check_daily',
  'schoolos_teacher_geo_pings_cleanup_hourly',
];

Deno.serve(async (req: Request) => {
  const secret = req.headers.get('x-dispatch-secret') ?? req.headers.get('x-cron-secret');
  if (secret !== DISPATCH_SECRET) return json({ error: 'unauthorized' }, 401);
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);

  const body = await req.json().catch(() => ({}));
  const { action, jobname } = body;

  if (!action || !jobname) return json({ error: 'action and jobname required' }, 400);
  if (!['pause','resume','status'].includes(action)) return json({ error: 'action must be pause, resume, or status' }, 400);
  if (!ALLOWED_JOBS.includes(jobname)) return json({ error: 'jobname not in allowed list', allowed: ALLOWED_JOBS }, 400);

  // Status: readable via Management API
  if (action === 'status' && MANAGEMENT_API_KEY) {
    const res = await mgmtQuery(`SELECT jobname, active, schedule FROM cron.job WHERE jobname = '${esc(jobname)}';`);
    return json({ success: true, action, jobname, result: res });
  }

  // Pause/resume: cron.job requires supabase_admin superuser
  // Management API /database/query runs as postgres — insufficient privilege
  // Returning the exact SQL for Supabase Studio (1 dashboard action)
  return json({
    success: false,
    platform_restriction: true,
    message: 'cron.job writes require supabase_admin superuser. Management API runs as postgres. This is a hard Supabase platform constraint. Run the SQL below in Supabase Studio SQL editor (1 action).',
    manual_sql: action === 'pause'
      ? `UPDATE cron.job SET active = false WHERE jobname = '${jobname}';\nSELECT jobname, active FROM cron.job WHERE jobname = '${jobname}';`
      : `UPDATE cron.job SET active = true WHERE jobname = '${jobname}';\nSELECT jobname, active FROM cron.job WHERE jobname = '${jobname}';`,
  }, 200);
});

async function mgmtQuery(query: string) {
  if (!MANAGEMENT_API_KEY) return { error: 'PRANIX_SUPABASE_MANAGEMENT_KEY not set' };
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${MANAGEMENT_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    }
  );
  if (!res.ok) return { error: `HTTP ${res.status}: ${await res.text()}` };
  return res.json().catch(() => ({ error: 'invalid json' }));
}

function esc(s: string) { return s.replace(/'/g, "''"); }
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
