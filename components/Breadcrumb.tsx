// components/Breadcrumb.tsx
// Navigation fix HF-10: Auto-breadcrumb from pathname.
// Parses the current URL path into human-readable crumbs.
// Injected into Layout.tsx header row so it appears on every admin page.
// No props required — reads from usePathname().

'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

// Route label overrides — maps path segments to display names
const SEGMENT_LABELS: Record<string, string> = {
  dashboard:            'Dashboard',
  students:             'Students',
  admissions:           'Admissions',
  crm:                  'Leads CRM',
  'call-analysis':      'Call Analysis',
  'report-cards':       'Report Cards',
  'teacher-eval':       'Teacher Eval',
  automation:           'Automation',
  briefing:             'AI Briefing',
  cron:                 'Schedule',
  broadcasts:           'Broadcasts',
  fees:                 'Fee Automation',
  geofence:             'Geofence',
  'lesson-plans-coverage': 'Lesson Coverage',
  promotion:            'Promotion',
  ptm:                  'PTM',
  risk:                 'Risk Flags',
  substitutes:          'Substitutes',
  'teacher-attendance': 'Teacher Attendance',
  analytics:            'Analytics',
  billing:              'Billing',
  connectors:           'Data Connectors',
  import:               'CSV Import',
  settings:             'Settings',
  whatsapp:             'WhatsApp',
  admin:                'Admin',
  complaints:           'Complaints',
  'coaching-tests':     'Tests & Ranks',
  conversations:        'Conversations',
  'data-privacy':       'Data Privacy',
  'health-incidents':   'Health Incidents',
  knowledge:            'Knowledge Base',
  meals:                'Meal Attendance',
  'nl-ops':             'NL Ops',
  observability:        'Observability',
  ops:                  'Ops Console',
  parents:              'Parent Accounts',
  regulatory:           'Regulatory',
  rte:                  'RTE Admissions',
  sanitary:             'Sanitary Inventory',
  scholarships:         'Scholarships',
  timetable:            'Timetable',
  'transfer-certificates': 'Transfer Certificates',
  transport:            'Transport',
  accounts:             'Accounts',
  owner:                'Owner Dashboard',
  principal:            'Principal',
  teacher:              'Teacher',
  'super-admin':        'Super Admin',
  onboarding:           'Setup Wizard',
};

function toLabel(segment: string): string {
  // UUID-like segments → show "Detail"
  if (/^[0-9a-f]{8}-/.test(segment)) return 'Detail';
  return SEGMENT_LABELS[segment] ?? segment
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function Breadcrumb() {
  const pathname = usePathname();

  // Skip breadcrumb for root-level pages
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length <= 1) return null;

  // Build crumb trail
  const crumbs = segments.map((seg, idx) => {
    const href = '/' + segments.slice(0, idx + 1).join('/');
    return { label: toLabel(seg), href };
  });

  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 12,
        color: '#9CA3AF',
        marginBottom: 4,
        flexWrap: 'wrap',
      }}
    >
      <Link
        href="/dashboard"
        style={{ color: '#9CA3AF', textDecoration: 'none' }}
        aria-label="Home"
      >
        ◈
      </Link>
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: '#D1D5DB' }}>›</span>
          {i === crumbs.length - 1 ? (
            <span style={{ color: '#374151', fontWeight: 600 }}>{crumb.label}</span>
          ) : (
            <Link
              href={crumb.href}
              style={{ color: '#6B7280', textDecoration: 'none' }}
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
