// app/super-admin/ops-dashboard/page.tsx
// OPS-10: Operational observability dashboard — super-admin only (@pranixailabs.com)
// Reads from obs_* DB views. No AI calls. Auto-refreshes every 60s.
import { requireSuperAdmin } from "@/lib/super-admin-auth";
import { supabaseAdmin } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getHealthSummary() {
  const { data } = await supabaseAdmin.from("obs_health_summary").select("*").order("panel");
  return data ?? [];
}
async function getFailedNotifications() {
  const { data } = await supabaseAdmin.from("obs_failed_notifications").select("*").order("stuck_count", { ascending: false });
  return data ?? [];
}
async function getCronHealth() {
  const { data } = await supabaseAdmin.from("obs_cron_health").select("*").order("health").order("job_name");
  return data ?? [];
}
async function getStaleBriefings() {
  const { data } = await supabaseAdmin.from("obs_stale_briefings").select("*").order("days_stale", { ascending: false, nullsFirst: true });
  return data ?? [];
}
async function getSystemHealth() {
  const { data } = await supabaseAdmin.from("system_health").select("service,status,error_message,last_checked_at").order("service");
  return data ?? [];
}

const HC: Record<string, string> = {
  green:   "bg-green-100 text-green-800 border-green-200",
  yellow:  "bg-yellow-100 text-yellow-800 border-yellow-200",
  red:     "bg-red-100 text-red-800 border-red-200",
  demo:    "bg-gray-100 text-gray-500 border-gray-200",
  ok:      "bg-green-100 text-green-800 border-green-200",
  blocked: "bg-red-100 text-red-800 border-red-200",
  degraded:"bg-yellow-100 text-yellow-800 border-yellow-200",
  unknown: "bg-gray-100 text-gray-500 border-gray-200",
};

export default async function OpsDashboardPage() {
  await requireSuperAdmin();

  const [summary, failedNotifs, cronHealth, staleBriefings, systemHealth] = await Promise.all([
    getHealthSummary(), getFailedNotifications(), getCronHealth(), getStaleBriefings(), getSystemHealth(),
  ]);

  const overallHealth = summary.some((r: any) => r.health === "red") ? "red"
    : summary.some((r: any) => r.health === "yellow") ? "yellow" : "green";

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Operational Health</h1>
          <p className="text-sm text-gray-500 mt-1">
            Super-admin · Auto-refreshes every 60s ·{" "}
            {new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST
          </p>
        </div>
        <span className={`px-4 py-2 rounded-full text-sm font-semibold border ${HC[overallHealth]}`}>
          {overallHealth === "green"
            ? "✅ All systems operational"
            : overallHealth === "yellow"
            ? "⚠️ Degraded"
            : "🔴 Action required"}
        </span>
      </div>

      {/* Summary badges */}
      <div className="grid grid-cols-5 gap-3 mb-8">
        {summary.map((row: any) => (
          <div key={row.panel} className={`rounded-lg border p-3 ${HC[row.health]}`}>
            <div className="text-xs font-medium uppercase tracking-wide opacity-70">
              {row.panel.replace(/_/g, " ")}
            </div>
            <div className="text-2xl font-bold mt-1">{row.metric ?? "—"}</div>
            <div className="text-xs mt-0.5 capitalize">{row.health}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">

        {/* Cron health */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-700 mb-3">Cron Jobs (last 7 days)</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs uppercase">
                <th className="pb-2">Job</th>
                <th>✅</th>
                <th>❌</th>
                <th>Last success</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {cronHealth.map((row: any) => (
                <tr key={row.job_name} className="border-t border-gray-50">
                  <td className="py-1.5 font-mono text-xs">{row.job_name}</td>
                  <td className="text-green-600">{row.successes_7d}</td>
                  <td className="text-red-600">{row.failures_7d}</td>
                  <td className="text-gray-400 text-xs">
                    {row.last_success
                      ? new Date(row.last_success).toLocaleDateString("en-IN")
                      : "never"}
                  </td>
                  <td>
                    <span className={`px-2 py-0.5 rounded text-xs ${HC[row.health]}`}>
                      {row.health}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Stale briefings */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-700 mb-3">Principal Briefings</h2>
          {staleBriefings.map((row: any) => (
            <div key={row.school_id} className="mb-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{row.institution_name}</span>
                <span className={`px-2 py-0.5 rounded text-xs ${HC[row.health]}`}>{row.health}</span>
              </div>
              {row.days_stale != null && (
                <p className="text-xs text-gray-400 mt-0.5">
                  Last: {row.last_briefing_date ?? "never"} ({row.days_stale}d ago)
                  {row.blocked_reason && ` · ${row.blocked_reason}`}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Failed notifications */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-700 mb-3">Failed Notifications</h2>
          {failedNotifs.length === 0 ? (
            <p className="text-sm text-green-600">✅ No stuck notifications</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 text-xs uppercase">
                  <th className="pb-2">Module</th>
                  <th>Stuck</th>
                  <th>&gt;24h</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {failedNotifs.map((row: any) => (
                  <tr key={row.module} className="border-t border-gray-50">
                    <td className="py-1.5 font-mono text-xs">{row.module}</td>
                    <td>{row.stuck_count}</td>
                    <td className={row.older_than_24h > 0 ? "text-red-600 font-semibold" : "text-gray-500"}>
                      {row.older_than_24h}
                    </td>
                    <td>
                      <span className={`px-2 py-0.5 rounded text-xs ${HC[row.health]}`}>
                        {row.health}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* External services */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-700 mb-3">External Services</h2>
          {systemHealth.map((row: any) => (
            <div key={row.service} className="flex items-center justify-between mb-2">
              <div>
                <span className="text-sm font-medium capitalize">
                  {row.service.replace(/_/g, " ")}
                </span>
                {row.error_message && (
                  <p className="text-xs text-gray-400 mt-0.5">{row.error_message}</p>
                )}
              </div>
              <span className={`px-2 py-0.5 rounded text-xs border ${HC[row.status]}`}>
                {row.status}
              </span>
            </div>
          ))}
        </div>

      </div>

      <script dangerouslySetInnerHTML={{ __html: "setTimeout(()=>location.reload(),60000)" }} />
    </div>
  );
}
