'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
  roles?: string[];
}

const NAV: NavItem[] = [
  { href: '/accounts',                 label: 'Accounts',              icon: '💰', roles: ['owner','admin','accountant'] },
  { href: '/dashboard',                  label: 'Dashboard',            icon: '◈', exact: true },
  { href: '/principal',                  label: 'Principal View',       icon: '📊', roles: ['owner','admin'] },
  { href: '/students',                   label: 'Students',             icon: '👨‍🎓', roles: ['owner','admin','principal','teacher'] },
  { href: '/admissions',                 label: 'New Inquiry',          icon: '✦',  roles: ['owner','admin'] },
  { href: '/admissions/crm',             label: 'Leads CRM',            icon: '◎',  roles: ['owner','admin'] },
  { href: '/admissions/call-analysis',   label: 'Call Analysis',        icon: '📞', roles: ['owner','admin'] },
  { href: '/report-cards',               label: 'Report Cards',         icon: '◷',  roles: ['owner','admin','principal','teacher'] },
  { href: '/teacher-eval',               label: 'Teacher Eval',         icon: '⊕',  roles: ['owner','admin','principal'] },
  { href: '/automation',                 label: 'Automation',           icon: '⚡', roles: ['owner','admin'] },
  { href: '/automation/cron',            label: 'Automation Schedule',  icon: '🤖', roles: ['owner','admin'] },
  { href: '/analytics',                  label: 'Analytics',            icon: '◉',  roles: ['owner','admin','principal'] },
  { href: '/connectors',                 label: 'Data Connectors',      icon: '🔗', roles: ['owner','admin'] },
  { href: '/whatsapp',                   label: 'WhatsApp Bot',         icon: '💬', roles: ['owner','admin'] },
  { href: '/import',                     label: 'CSV Import',           icon: '↑',  roles: ['owner','admin'] },
  { href: '/billing',                    label: 'Billing',              icon: '💳', roles: ['owner'] },
  { href: '/settings',                   label: 'Settings',             icon: '⚙',  roles: ['owner','admin'] },
  { href: '/admin/observability',         label: 'Observability',         icon: '📡', roles: ['owner','admin'] },
  { href: '/admin/report-cards',          label: 'Report Cards',          icon: '📋', roles: ['owner','admin'] },
  { href: '/admin/ptm',                   label: 'PTM Scheduling',         icon: '🤝', roles: ['owner','admin','principal'] },
  { href: '/admin/parents',            label: 'Parent Accounts',        icon: '👨‍👩‍👧', roles: ['owner','admin'] },
  { href: '/admin/ops',               label: 'Ops Console',            icon: '📡', roles: ['owner','admin'] },
  { href: '/admin/meals',              label: 'Meal Attendance',         icon: '🍽', roles: ['owner','admin','teacher'] },
  { href: '/admin/scholarships',        label: 'Scholarships',            icon: '🎓', roles: ['owner','admin'] },
  { href: '/admin/rte',                   label: 'RTE Admissions',          icon: '🏫', roles: ['owner','admin'] },
  { href: '/owner',                       label: 'Owner Dashboard',          icon: '🏢', roles: ['owner'] },
  { href: '/admin/health-incidents',      label: 'Health Incidents',         icon: '🩺', roles: ['owner','admin','principal'] },
  { href: '/admin/sanitary',              label: 'Sanitary Inventory',        icon: '📦', roles: ['owner','admin'] },
  { href: '/admin/transport',             label: 'Transport',                 icon: '🚌', roles: ['owner','admin','principal'] },
  { href: '/admin/regulatory',            label: 'Regulatory',               icon: '📋', roles: ['owner','admin','principal'] },
  { href: '/admin/knowledge',             label: 'Knowledge Base',           icon: '📚', roles: ['owner','admin','principal'] },
  { href: '/admin/conversations',         label: 'Conversations',             icon: '💬', roles: ['owner','admin','principal'] },
  { href: '/admin/nl-ops',                label: 'NL Ops',                   icon: '🤖', roles: ['owner','admin','principal'] },
];

interface LayoutProps { children: ReactNode; title: string; subtitle?: string; actions?: ReactNode; }
interface SessionData { schoolName: string; userEmail: string; userName: string; plan: string; userRole: string; }

const PLAN_COLOR: Record<string, string> = {
  starter: '#6B7280', free: '#6B7280',
  growth: '#4F46E5',  pro: '#4F46E5',
  campus: '#065F46',  enterprise: '#065F46',
};

export default function Layout({ children, title, subtitle, actions }: LayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [waOk, setWaOk] = useState<boolean | null>(null);
  const [institutionType, setInstitutionType] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/session').then(r => r.json()).then(d => { if (d.session) setSession(d.session); }).catch(() => {});
    fetch('/api/admin/institution-config').then(r => r.json()).then(d => { if (d.institution_type) setInstitutionType(d.institution_type); }).catch(() => {});
  }, []);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  // C6: WhatsApp health badge — fetch dispatcher status on mount
  useEffect(() => {
    fetch('/api/notifications/health')
      .then(r => r.json())
      .then((d: { dispatcher_mode?: string }) => {
        const mode = d?.dispatcher_mode;
        setWaOk(!!mode && mode !== 'unknown' && mode !== 'dry_run');
      })
      .catch(() => setWaOk(false));
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  function isActive(item: NavItem) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  function canSee(item: NavItem) {
    if (!item.roles) return true;
    if (!item.roles.includes(session?.userRole ?? 'viewer')) return false;
    // G5: institution_type gating
    const t = institutionType;
    if (t) {
      if (item.label === 'RTE Admissions' && !['govt_school','govt_aided_school','welfare_school'].includes(t)) return false;
      if (item.label === 'Meal Attendance' && !['govt_school','welfare_school'].includes(t)) return false;
      if (item.label === 'Sanitary Inventory' && t === 'coaching') return false;
      if (['Leads CRM','Call Analysis'].includes(item.label) && ['govt_school','govt_aided_school'].includes(t)) return false;
      if (item.label === 'Transport' && ['coaching','anganwadi'].includes(t)) return false;
    }
    return true;
  }

  const plan = session?.plan ?? 'free';
  const planColor = PLAN_COLOR[plan] ?? '#6B7280';
  const visibleNav = NAV.filter(canSee);

  function SidebarInner() {
    return (
      <>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">S</div>
          <div>
            <div className="sidebar-logo-text">School OS</div>
            <div className="sidebar-logo-sub">{session?.schoolName ?? 'Loading...'}</div>
          </div>
        </div>

        {session?.plan && (
          <Link href="/billing" style={{ textDecoration: 'none' }}>
            <div style={{ margin: '0 12px 8px', padding: '5px 10px', background: '#F3F4F6', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>Plan</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: planColor, textTransform: 'capitalize' }}>{plan} ↗</span>
            </div>
          </Link>
        )}

        <div style={{ padding: '4px 0', flex: 1, overflowY: 'auto' }}>
          <div className="sidebar-section-label">Platform</div>
          <nav className="sidebar-nav">
            {visibleNav.map(item => (
              <Link key={item.href} href={item.href} className={`sidebar-link${isActive(item) ? ' active' : ''}`}>
                <span className="sidebar-link-icon">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div style={{ padding: '0 12px 8px' }}>
          <div className="sidebar-section-label">System</div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Link href="/whatsapp" style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, fontSize: 14, color: '#9CA3AF', cursor: 'pointer' }}>
                <span className="sidebar-link-icon">◉</span>
                WhatsApp Bot
                {waOk === true && <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, background: '#DCFCE7', color: '#15803D', padding: '2px 7px', borderRadius: 10 }}>LIVE</span>}
                {waOk === false && <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, background: '#FEF3C7', color: '#92400E', padding: '2px 7px', borderRadius: 10 }}>STUB</span>}
              </div>
            </Link>
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{session?.userName?.charAt(0) ?? 'A'}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sidebar-user-name">{session?.userName ?? 'Admin'}</div>
              <div className="sidebar-user-role" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}>
                {session?.userRole ? `${session.userRole} · ` : ''}{session?.userEmail ?? ''}
              </div>
            </div>
          </div>
          <button onClick={handleLogout} style={{ marginTop: 10, width: '100%', height: 32, borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', fontSize: 12, color: '#6B7280', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
            Sign out
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="shell">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 149, display: 'none' }}
          className="mob-overlay"
        />
      )}

      {/* Desktop sidebar */}
      <aside className="sidebar">
        <SidebarInner />
      </aside>

      {/* Mobile slide-in sidebar */}
      <aside className="sidebar mob-sidebar" style={{ transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)' }}>
        <SidebarInner />
      </aside>

      <div className="main-content">
        <header className="topbar">
          {/* Hamburger button — only shown on mobile via CSS */}
          <button
            className="hamburger-btn"
            onClick={() => setSidebarOpen(v => !v)}
            aria-label="Open navigation"
            style={{ display: 'none', width: 36, height: 36, borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 10 }}
          >
            <svg width="18" height="14" fill="none" viewBox="0 0 18 14">
              <rect y="0"  width="18" height="2" rx="1" fill={sidebarOpen ? '#4F46E5' : '#374151'} />
              <rect y="6"  width="18" height="2" rx="1" fill={sidebarOpen ? '#4F46E5' : '#374151'} />
              <rect y="12" width="18" height="2" rx="1" fill={sidebarOpen ? '#4F46E5' : '#374151'} />
            </svg>
          </button>

          <div style={{ flex: 1 }}>
            <div className="topbar-title">{title}</div>
            {subtitle && <div className="topbar-sub">{subtitle}</div>}
          </div>
          <div className="topbar-right">
            <div className="topbar-badge"><div className="topbar-badge-dot" />{waOk === true ? 'All systems live' : waOk === false ? 'Some services degraded' : 'Checking...'}</div>
            {actions}
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .sidebar:not(.mob-sidebar) { display: none !important; }
          .mob-sidebar {
            display: flex !important;
            position: fixed !important;
            top: 0; left: 0; bottom: 0;
            z-index: 150;
            width: 240px !important;
            transition: transform 0.25s ease;
          }
          .mob-overlay { display: block !important; }
          .hamburger-btn { display: flex !important; }
        }
        @media (min-width: 769px) {
          .mob-sidebar { display: none !important; }
          .mob-overlay { display: none !important; }
        }
      `}</style>
    </div>
  );
}
