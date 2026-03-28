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
  roles?: string[]; // undefined = all roles can see
}

const NAV: NavItem[] = [
  { href: '/dashboard',           label: 'Dashboard',       icon: '◈', exact: true },
  { href: '/students',            label: 'Students',         icon: '👨‍🎓' },
  { href: '/admissions',          label: 'New Inquiry',      icon: '✦',  roles: ['owner','admin'] },
  { href: '/admissions/crm',      label: 'Leads CRM',        icon: '◎',  roles: ['owner','admin'] },
  { href: '/report-cards',        label: 'Report Cards',     icon: '◷' },
  { href: '/teacher-eval',        label: 'Teacher Eval',     icon: '⊕' },
  { href: '/automation',          label: 'Automation',       icon: '⚡', roles: ['owner','admin'] },
  { href: '/automation/cron',     label: 'Cron Jobs',        icon: '🤖', roles: ['owner','admin'] },
  { href: '/analytics',           label: 'Analytics',        icon: '◉' },
  { href: '/import',              label: 'CSV Import',       icon: '↑',  roles: ['owner','admin'] },
  { href: '/billing',             label: 'Billing',          icon: '💳', roles: ['owner'] },
  { href: '/settings',            label: 'Settings',         icon: '⚙',  roles: ['owner','admin'] },
];

interface LayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

interface SessionData {
  schoolName: string;
  userEmail: string;
  userName: string;
  plan: string;
  userRole: string;
}

const PLAN_COLOR: Record<string, string> = {
  starter: '#6B7280', free: '#6B7280',
  growth: '#4F46E5',  pro: '#4F46E5',
  campus: '#065F46',  enterprise: '#065F46',
};

export default function Layout({ children, title, subtitle, actions }: LayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);

  useEffect(() => {
    fetch('/api/auth/session')
      .then(r => r.json())
      .then(d => { if (d.session) setSession(d.session); })
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  function isActive(item: NavItem) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  function canSeeItem(item: NavItem): boolean {
    if (!item.roles) return true;
    const role = session?.userRole ?? 'viewer';
    return item.roles.includes(role);
  }

  const plan = session?.plan ?? 'free';
  const planColor = PLAN_COLOR[plan] ?? '#6B7280';
  const visibleNav = NAV.filter(canSeeItem);

  return (
    <div className="shell">
      <aside className="sidebar">
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, fontSize: 14, color: '#9CA3AF' }}>
              <span className="sidebar-link-icon">◉</span>
              WhatsApp Bot
              <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, background: '#DCFCE7', color: '#15803D', padding: '2px 7px', borderRadius: 10 }}>ON</span>
            </div>
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
      </aside>

      <div className="main-content">
        <header className="topbar">
          <div>
            <div className="topbar-title">{title}</div>
            {subtitle && <div className="topbar-sub">{subtitle}</div>}
          </div>
          <div className="topbar-right">
            <div className="topbar-badge"><div className="topbar-badge-dot" />All systems live</div>
            {actions}
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
