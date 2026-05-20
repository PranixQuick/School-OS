'use client';
import Layout from '@/components/Layout';
import Link from 'next/link';
import { T } from '@/lib/i18n';
import { useLang } from '@/lib/useLang';

// Module definitions using i18n keys
const COMING_SOON_MODULES = [
  { titleKey: 'att_analytics',       descKey: 'att_analytics',       eta: 'next_sprint', icon: '📊' },
  { titleKey: 'fee_collection_graph', descKey: 'fee_collection_graph', eta: 'next_sprint', icon: '💰' },
  { titleKey: 'teacher_trends',      descKey: 'teacher_trends',       eta: 'Q3 2026',     icon: '🎙' },
  { titleKey: 'admissions_funnel',   descKey: 'admissions_funnel',    eta: 'Q3 2026',     icon: '📈' },
];

const QUICK_LINKS = [
  { labelKey: 'students',      href: '/students',       icon: '👨‍🎓' },
  { labelKey: 'fee_management', href: '/admin/fees',    icon: '💰' },
  { labelKey: 'admissions',    href: '/admissions/crm', icon: '👥' },
  { labelKey: 'teacher_eval',  href: '/teacher-eval',   icon: '🎙' },
];

export default function AnalyticsPage() {
  const { lang } = useLang();
  return (
    <Layout title={T('analytics', lang as never)} subtitle={T('analytics', lang as never)}>

      {/* Coming soon banner */}
      <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#4338CA', marginBottom: 4 }}>
          {T('analytics_coming_soon', lang as never)}
        </div>
        <div style={{ fontSize: 13, color: '#4338CA' }}>
          {T('analytics_coming_desc', lang as never)}
        </div>
      </div>

      {/* Coming soon module cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 24 }}>
        {COMING_SOON_MODULES.map(m => (
          <div key={m.titleKey} className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{m.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#111827', marginBottom: 4 }}>
              {T(m.titleKey, lang as never)}
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5, marginBottom: 8 }}>
              {T(m.descKey, lang as never)}
            </div>
            <span style={{ padding: '2px 8px', borderRadius: 6, background: '#F3F4F6', color: '#6B7280', fontSize: 11, fontWeight: 600 }}>
              {m.eta === 'next_sprint' ? T('next_sprint', lang as never) : m.eta}
            </span>
          </div>
        ))}
      </div>

      {/* Quick access */}
      <div className="card" style={{ padding: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
          {T('quick_access_reports', lang as never)}
        </div>
        {QUICK_LINKS.map(l => (
          <Link key={l.href} href={l.href}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
              borderBottom: '1px solid #F3F4F6', textDecoration: 'none', color: '#4F46E5' }}>
            <span style={{ fontSize: 16 }}>{l.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{T(l.labelKey, lang as never)}</span>
            <span style={{ marginLeft: 'auto', color: '#9CA3AF' }}>→</span>
          </Link>
        ))}
      </div>
    </Layout>
  );
}
