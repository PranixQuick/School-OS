'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: '◈', exact: true },
  { href: '/admissions', label: 'New Inquiry', icon: '✦' },
  { href: '/admissions/crm', label: 'Leads CRM', icon: '◎' },
  { href: '/report-cards', label: 'Report Cards', icon: '◷' },
  { href: '/teacher-eval', label: 'Teacher Eval', icon: '⊕' },
];

interface LayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export default function Layout({ children, title, subtitle, actions }: LayoutProps) {
  const pathname = usePathname();

  function isActive(item: NavItem) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  return (
    <div className="shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">S</div>
          <div>
            <div className="sidebar-logo-text">School OS</div>
            <div className="sidebar-logo-sub">Suchitra Academy</div>
          </div>
        </div>

        <div style={{ padding: '8px 0' }}>
          <div className="sidebar-section-label">Platform</div>
          <nav className="sidebar-nav">
            {NAV.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link${isActive(item) ? ' active' : ''}`}
              >
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
            <div className="sidebar-avatar">A</div>
            <div>
              <div className="sidebar-user-name">Admin</div>
              <div className="sidebar-user-role">Administrator</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div>
            <div className="topbar-title">{title}</div>
            {subtitle && <div className="topbar-sub">{subtitle}</div>}
          </div>
          <div className="topbar-right">
            <div className="topbar-badge">
              <div className="topbar-badge-dot" />
              All systems live
            </div>
            {actions}
          </div>
        </header>

        {/* Content */}
        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  );
}
