'use client';
// components/TeacherLayout.tsx
// Batch 10 — Teacher-specific shell layout.
// Same visual structure as components/Layout.tsx but with teacher nav items.
// Used by app/teacher/layout.tsx to wrap all /teacher/* pages.

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';

interface TeacherLayoutProps {
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

const TEACHER_NAV = [
  { href: '/teacher',              label: 'Dashboard',    icon: '◈', exact: true },
  { href: '/teacher/attendance',   label: 'Attendance',   icon: '✓' },
  { href: '/teacher/homework',     label: 'Homework',     icon: '📖' },
  { href: '/teacher/marks',        label: 'Marks',        icon: '📊' },
  { href: '/teacher/lesson-plans', label: 'Lesson Plans', icon: '📄' },
  { href: '/teacher/proofs',       label: 'Proofs',       icon: '📷' },
  { href: '/teacher/leave',        label: 'Leave',        icon: '🗓' },
  { href: '/teacher/checkin',      label: 'Check In',     icon: '📍' },
];

export default function TeacherLayout({ children, title, subtitle, actions }: TeacherLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetch('/api/auth/session').then(r => r.json()).then((d: { session?: SessionData }) => {
      if (d.session) setSession(d.session);
    }).catch(() => {});
  }, []);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  return (
    <div className="layout-root">
      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar${sidebarOpen ? ' sidebar-open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">T</div>
          <div>
            <div className="sidebar-logo-text">Teacher</div>
            <div className="sidebar-logo-sub">{session?.schoolName ?? 'EdProSys'}</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {TEACHER_NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link${isActive(item.href, item.exact) ? ' sidebar-link-active' : ''}`}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-label">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-name">{session?.userName ?? '—'}</div>
            <div className="sidebar-user-email">{session?.userEmail ?? ''}</div>
          </div>
          <button className="sidebar-logout" onClick={() => void handleLogout()}>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="main-content">
        <header className="topbar">
          <button
            className="hamburger-btn"
            onClick={() => setSidebarOpen(v => !v)}
            aria-label="Open navigation"
            style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>

          <div className="topbar-title">
            <h1 className="topbar-h1">{title}</h1>
            {subtitle && <p className="topbar-sub">{subtitle}</p>}
          </div>

          {actions && <div className="topbar-actions">{actions}</div>}
        </header>

        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  );
}
