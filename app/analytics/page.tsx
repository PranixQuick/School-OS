'use client';
import Layout from '@/components/Layout';
import Link from 'next/link';
import { T } from '@/lib/i18n';
import { useLang } from '@/lib/useLang';

const COMING_SOON_MODULES = [
  { title: 'Attendance Analytics', desc: 'Class-wise and student-wise attendance trends over time.', eta: 'Next sprint', icon: '📊' },
  { title: 'Fee Collection Graph', desc: 'Monthly fee collection vs outstanding — visualized.', eta: 'Next sprint', icon: '💰' },
  { title: 'Teacher Performance Trends', desc: 'Evaluation score trends across terms.', eta: 'Q3 2026', icon: '🎙' },
  { title: 'Admissions Funnel', desc: 'Lead → Inquiry → Visit → Admission conversion rates.', eta: 'Q3 2026', icon: '📈' },
];

export default function AnalyticsPage() {
  const { lang } = useLang();
  return (
    <Layout title={T('analytics', lang)} subtitle="School performance data at a glance">
      <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#4338CA', marginBottom: 4 }}>🚧 Analytics Dashboard — Coming Soon</div>
        <div style={{ fontSize: 13, color: '#4338CA' }}>We are building detailed analytics views. In the meantime, use module-specific reports available inside each section.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 24 }}>
        {COMING_SOON_MODULES.map(m => (
          <div key={m.title} className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{m.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#111827', marginBottom: 4 }}>{m.title}</div>
            <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5, marginBottom: 8 }}>{m.desc}</div>
            <span style={{ padding: '2px 8px', borderRadius: 6, background: '#F3F4F6', color: '#6B7280', fontSize: 11, fontWeight: 600 }}>{m.eta}</span>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Quick access to existing reports</div>
        {[
          { label: 'View All Students', href: '/students', icon: '👨‍🎓' },
          { label: 'Fee Management', href: '/admin/fees', icon: '💰' },
          { label: 'Admissions CRM', href: '/admissions/crm', icon: '👥' },
          { label: 'Teacher Evaluations', href: '/teacher-eval', icon: '🎙' },
        ].map(l => (
          <Link key={l.href} href={l.href}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
              borderBottom: '1px solid #F3F4F6', textDecoration: 'none', color: '#4F46E5' }}>
            <span style={{ fontSize: 16 }}>{l.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{l.label}</span>
            <span style={{ marginLeft: 'auto', color: '#9CA3AF' }}>→</span>
          </Link>
        ))}
      </div>
    </Layout>
  );
}
