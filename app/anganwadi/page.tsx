'use client';
// Anganwadi Dashboard — "Child Nutrition + ICDS Monitoring Center"
// Institution-specific: ONLY for anganwadi school_mode.
// AWW role-native: SAM risk, vaccine schedule, supplement tracking, beneficiary alerts.
// Telugu-primary UI — real AWW workflows, not generic CRUD.

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';

interface GrowthSummary  { sam: number; mam: number; normal: number; total: number; }
interface VaccineDue     { name: string; count: number; vaccine_name: string; days_overdue: number; }
interface BenefAlert     { name: string; type: string; alert: string; phone: string; }
interface MDMStock       { item_name: string; closing_stock: number; min_threshold: number; shortage_alert: boolean; }
interface SupplementLog  { supplement_type: string; total_today: number; }
interface AnganwadiDash  {
  center_name: string; aww_name: string; total_children: number;
  attendance_today: number; attendance_pct: number;
  growth: GrowthSummary;
  vaccines_due: VaccineDue[];
  beneficiary_alerts: BenefAlert[];
  mdm_stock: MDMStock[];
  supplements_today: SupplementLog[];
  meal_marked_today: boolean;
  icds_report_due: boolean;
}

export default function AnganwadiPage() {
  const [data, setData]     = useState<AnganwadiDash | null>(null);
  const [loading, setLoading] = useState(true);
  const today = new Date().toLocaleDateString('te-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/anganwadi/dashboard');
      if (r.ok) setData(await r.json() as AnganwadiDash);
    } catch {/**/}
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const samCount = data?.growth.sam ?? 0;
  const mamCount = data?.growth.mam ?? 0;
  const vaccinesDue = data?.vaccines_due ?? [];
  const stockAlerts = (data?.mdm_stock ?? []).filter(s => s.shortage_alert);
  const benefAlerts = data?.beneficiary_alerts ?? [];

  // Urgent alerts
  type AlertSev = 'red'|'amber'|'blue';
  const alerts: { icon: string; text: string; href: string; sev: AlertSev }[] = [];
  if (samCount > 0) alerts.push({ icon: '🔴', text: `${samCount} SAM child(ren) — NRC referral required`, href: '/anganwadi/growth', sev: 'red' });
  if (vaccinesDue.length > 0) alerts.push({ icon: '💉', text: `${vaccinesDue.reduce((s,v)=>s+v.count,0)} vaccine(s) overdue`, href: '/anganwadi/immunization', sev: 'red' });
  if (stockAlerts.length > 0) alerts.push({ icon: '⚠️', text: `${stockAlerts.length} MDM item(s) low on stock`, href: '/anganwadi/mdm-stock', sev: 'amber' });
  if (!data?.meal_marked_today) alerts.push({ icon: '🍚', text: 'MDM meal attendance not marked today', href: '/teacher/meal-attendance', sev: 'amber' });
  if (benefAlerts.length > 0) alerts.push({ icon: '🤰', text: `${benefAlerts.length} beneficiary alert(s) need follow-up`, href: '/anganwadi/beneficiaries', sev: 'amber' });
  if (data?.icds_report_due) alerts.push({ icon: '📋', text: 'ICDS monthly report due — generate for CDPO', href: '/anganwadi/reports', sev: 'blue' });

  const SEV = {
    red:   { bg: '#FEF2F2', border: '#FECACA', color: '#B91C1C' },
    amber: { bg: '#FFF7ED', border: '#FED7AA', color: '#C2410C' },
    blue:  { bg: '#EFF6FF', border: '#BFDBFE', color: '#1D4ED8' },
  };

  return (
    <Layout title="అంగన్‌వాడి డాష్‌బోర్డ్" subtitle="ICDS Child Nutrition Monitor">
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        .skel{background:#F3F4F6;border-radius:8px;animation:pulse 1.5s ease-in-out infinite}
        .alert-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border-radius:10px;border:1px solid;margin-bottom:6px;text-decoration:none}
        .action-card{display:block;padding:14px 12px;border-radius:12px;text-decoration:none;background:#fff;border:1px solid #E5E7EB}
      `}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #D97706 0%, #B45309 100%)', borderRadius: 14, padding: '16px 18px', marginBottom: 14, color: '#fff' }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}>అంగన్‌వాడి కేంద్రం</div>
        <div style={{ fontSize: 17, fontWeight: 800 }}>{loading ? '…' : (data?.center_name ?? '—')}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>AWW: {data?.aww_name ?? '—'} · {today}</div>

        {/* Stats strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 14 }}>
          {[
            { v: loading ? '—' : (data?.total_children ?? 0),  l: 'మొత్తం' },
            { v: loading ? '—' : (data?.attendance_today ?? 0), l: 'నేడు వచ్చారు' },
            { v: loading ? '—' : samCount,  l: 'SAM' },
            { v: loading ? '—' : mamCount,  l: 'MAM' },
          ].map(s => (
            <div key={s.l} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 4px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{s.v}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.75)', marginTop: 1 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ALERTS */}
      {alerts.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 8 }}>
            ⚡ వెంటనే చర్య తీసుకోండి
          </div>
          {alerts.map((a, i) => (
            <Link key={i} href={a.href} className="alert-row" style={{ background: SEV[a.sev].bg, borderColor: SEV[a.sev].border, color: SEV[a.sev].color }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{a.icon} {a.text}</span>
              <span style={{ fontSize: 12, fontWeight: 700, flexShrink: 0 }}>→</span>
            </Link>
          ))}
          <div style={{ marginBottom: 14 }} />
        </>
      )}

      {/* GROWTH SUMMARY */}
      {data?.growth && (
        <>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 8 }}>
            📊 పోషకాహార స్థితి
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
            {[
              { label: 'SAM', value: data.growth.sam, bg: '#FEF2F2', color: '#B91C1C', desc: 'తీవ్ర పోషకాహారలోపం' },
              { label: 'MAM', value: data.growth.mam, bg: '#FFF7ED', color: '#D97706', desc: 'మధ్యస్థ లోపం' },
              { label: 'Normal', value: data.growth.normal, bg: '#F0FDF4', color: '#15803D', desc: 'సాధారణ' },
            ].map(g => (
              <Link key={g.label} href="/anganwadi/growth" style={{ textDecoration: 'none', background: g.bg, borderRadius: 12, padding: '12px 10px', textAlign: 'center', display: 'block', border: `1px solid ${g.color}20` }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: g.color }}>{g.value}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: g.color }}>{g.label}</div>
                <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{g.desc}</div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* VACCINES DUE */}
      {vaccinesDue.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 8 }}>
            💉 టీకాలు పెండింగ్
          </div>
          <div style={{ background: '#fff', border: '1px solid #FECACA', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
            {vaccinesDue.slice(0, 5).map((v, i) => (
              <div key={i} style={{ padding: '10px 14px', borderBottom: i < vaccinesDue.length-1 ? '1px solid #FFF5F5' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{v.name}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>{v.vaccine_name}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#B91C1C' }}>{v.days_overdue}d overdue</div>
                  <div style={{ fontSize: 10, color: '#9CA3AF' }}>{v.count} children</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* MDM STOCK */}
      {(data?.mdm_stock?.length ?? 0) > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 8 }}>
            🍚 MDM స్టాక్ స్థితి
          </div>
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
            {data!.mdm_stock.map((item, i) => (
              <div key={i} style={{ padding: '10px 14px', borderBottom: i < data!.mdm_stock.length-1 ? '1px solid #F9FAFB' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{item.item_name}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: item.shortage_alert ? '#B91C1C' : '#15803D', background: item.shortage_alert ? '#FEF2F2' : '#F0FDF4', padding: '3px 10px', borderRadius: 8 }}>
                  {item.closing_stock} {item.shortage_alert ? '⚠️' : ''}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* QUICK ACTIONS */}
      <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 8 }}>
        త్వరిత చర్యలు
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        {[
          { href: '/teacher/attendance',    icon: '✅', label: 'హాజరు నమోదు',       bg: '#F0FDF4', color: '#15803D' },
          { href: '/anganwadi/growth',      icon: '⚖️', label: 'బరువు నమోదు',       bg: '#FFF7ED', color: '#D97706' },
          { href: '/anganwadi/immunization',icon: '💉', label: 'టీకాలు',            bg: '#FEF2F2', color: '#B91C1C' },
          { href: '/anganwadi/nutrition',   icon: '🥚', label: 'పోషకాలు పంపిణీ',    bg: '#FDF4FF', color: '#9333EA' },
          { href: '/teacher/meal-attendance',icon: '🍽️', label: 'భోజన హాజరు',      bg: '#F0FDFA', color: '#0D9488' },
          { href: '/anganwadi/beneficiaries',icon: '🤰', label: 'లబ్ధిదారులు',       bg: '#EFF6FF', color: '#2563EB' },
        ].map(a => (
          <Link key={a.href} href={a.href} className="action-card">
            <div style={{ width: 36, height: 36, borderRadius: 9, background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 8 }}>{a.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: a.color }}>{a.label}</div>
          </Link>
        ))}
      </div>
    </Layout>
  );
}
