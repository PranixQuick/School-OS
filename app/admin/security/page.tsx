'use client';
// app/admin/security/page.tsx
// Admin security dashboard — P2 Security Phase.
// Shows: login health, blocked IPs, top threat IPs, failed login trend.
// Accessible only to admin/owner role.

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface ThreatIP { ip: string; total_failures: number; last_attempt: string; threat_level: string; distinct_accounts_tried: number; }
interface AuthHealth { successes_24h: number; failures_24h: number; success_rate_pct: number; }
interface SecurityData {
  auth_health: AuthHealth;
  blocked_ips_total: number;
  top_threats: ThreatIP[];
  failures_last_hour: number;
  generated_at: string;
}

const LEVEL_COLOR: Record<string, string> = {
  CRITICAL: '#B91C1C', HIGH: '#D97706', MEDIUM: '#D97706', LOW: '#6B7280',
};
const LEVEL_BG: Record<string, string> = {
  CRITICAL: '#FEF2F2', HIGH: '#FFF7ED', MEDIUM: '#FFFBEB', LOW: '#F9FAFB',
};

export default function SecurityDashboardPage() {
  const [data, setData]     = useState<SecurityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const r = await fetch('/api/admin/security/analytics');
      if (r.ok) { const d = await r.json() as SecurityData; setData(d); }
    } catch {/* ignore */}
    setLoading(false); setRefreshing(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const health = data?.auth_health;
  const healthColor = (health?.success_rate_pct ?? 100) >= 95 ? '#15803D'
    : (health?.success_rate_pct ?? 100) >= 80 ? '#D97706' : '#B91C1C';

  return (
    <Layout title="Security Dashboard" subtitle="Auth analytics + threat monitoring">
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading security data…</div>
      ) : (
        <>
          {/* KPI tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Login Success Rate', value: `${health?.success_rate_pct ?? 0}%`, color: healthColor, bg: '#F9FAFB', sub: 'Last 24h' },
              { label: 'Failed Logins', value: health?.failures_24h ?? 0, color: (health?.failures_24h ?? 0) > 20 ? '#B91C1C' : '#374151', bg: '#F9FAFB', sub: 'Last 24h' },
              { label: 'Blocked IPs', value: data?.blocked_ips_total ?? 0, color: '#4F46E5', bg: '#EEF2FF', sub: 'Total permanent' },
              { label: 'Attacks (1h)', value: data?.failures_last_hour ?? 0, color: (data?.failures_last_hour ?? 0) > 5 ? '#B91C1C' : '#374151', bg: '#F9FAFB', sub: 'Last hour' },
            ].map(t => (
              <div key={t.label} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, marginBottom: 4 }}>{t.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: t.color }}>{t.value}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{t.sub}</div>
              </div>
            ))}
          </div>

          {/* Progressive delay guidance */}
          <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 12, padding: '12px 14px', marginBottom: 16, fontSize: 13, color: '#4338CA' }}>
            <strong>Progressive Delay Policy (Active):</strong> After 5 failed logins from an IP in 10 min → 429 rate limit. After 20 in 5 min → auto-reviewed for blocking. IPs in blocked_ips table → permanently blocked at API level.
          </div>

          {/* Top Threat IPs */}
          {(data?.top_threats ?? []).length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 10, letterSpacing: '-0.2px' }}>
                🔴 Top Threat IPs (Last 7 Days)
              </div>
              <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
                {(data?.top_threats ?? []).map((t, i) => (
                  <div key={t.ip} style={{ padding: '10px 14px', borderBottom: i < (data?.top_threats.length ?? 0)-1 ? '1px solid #F3F4F6' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', fontFamily: 'monospace' }}>{t.ip}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                        {t.total_failures} attempts | {t.distinct_accounts_tried} accounts targeted |{' '}
                        Last: {new Date(t.last_attempt).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <span style={{ padding: '3px 10px', borderRadius: 8, background: LEVEL_BG[t.threat_level] ?? '#F9FAFB', color: LEVEL_COLOR[t.threat_level] ?? '#374151', fontSize: 12, fontWeight: 700 }}>
                      {t.threat_level}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {(data?.top_threats ?? []).length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: '#15803D', background: '#F0FDF4', borderRadius: 12, fontSize: 14, fontWeight: 600 }}>
              ✅ No active threats detected in the last 7 days
            </div>
          )}

          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <button onClick={() => void load(true)} disabled={refreshing}
              style={{ flex: 1, height: 44, borderRadius: 10, border: 'none', background: '#4F46E5', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {refreshing ? '⟳ Refreshing…' : '🔄 Refresh'}
            </button>
          </div>

          {data?.generated_at && (
            <div style={{ textAlign: 'center', fontSize: 11, color: '#9CA3AF', marginTop: 10 }}>
              Data as of: {new Date(data.generated_at).toLocaleString('en-IN')}
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
