'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';

const NAV_ITEMS = [
  { href: '/teacher', label: 'Home',       icon: '🏠', exact: true  },
  { href: '/teacher/attendance', label: 'Attendance', icon: '✅' },
  { href: '/teacher/homework',   label: 'Homework',   icon: '📚' },
  { href: '/teacher/marks',      label: 'Marks',      icon: '📊' },
];

const MENU_ITEMS = [
  { href: '/teacher/lesson-plans', label: 'Lesson Plans', icon: '📄' },
  { href: '/teacher/leave',        label: 'Leave',         icon: '📅' },
  { href: '/teacher/check-in',     label: 'Check In',      icon: '📍' },
  { href: '/teacher/proofs',       label: 'Proofs',        icon: '📷' },
];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [schoolName, setSchoolName] = useState('');

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => {
      if (d) {
        setUserName(d.name ?? d.email ?? '');
        setSchoolName(d.school_name ?? '');
      }
    }).catch(() => {});
  }, []);

  const isActive = (href: string, exact = false) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  const handleSignOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        .t-shell { display: flex; flex-direction: column; min-height: 100vh; background: #F9FAFB; }
        .t-header {
          position: sticky; top: 0; z-index: 40;
          background: #fff; border-bottom: 1px solid #E5E7EB;
          padding: 0 16px; height: 52px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .t-header-left { display: flex; align-items: center; gap: 10px; }
        .t-school-name { font-size: 15px; font-weight: 700; color: #111827; }
        .t-user-role { font-size: 11px; color: #6B7280; background: #EEF2FF; padding: 2px 8px; border-radius: 99px; font-weight: 600; }
        .t-menu-btn { background: none; border: 1px solid #E5E7EB; border-radius: 8px; width: 36px; height: 36px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; color: #374151; }
        .t-content { flex: 1; padding: 0 0 80px 0; }
        .t-bottom-nav {
          position: fixed; bottom: 0; left: 0; right: 0; z-index: 50;
          background: #fff; border-top: 1px solid #E5E7EB;
          display: grid; grid-template-columns: repeat(4, 1fr);
          padding: 0 0 env(safe-area-inset-bottom, 8px) 0;
        }
        .t-nav-item {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 8px 4px 6px; gap: 2px; text-decoration: none;
          color: #9CA3AF; font-size: 10px; font-weight: 600; letter-spacing: 0.2px;
          border: none; background: none; cursor: pointer;
        }
        .t-nav-item.active { color: #4F46E5; }
        .t-nav-icon { font-size: 20px; line-height: 1; }
        .t-overlay {
          position: fixed; inset: 0; z-index: 60; background: rgba(0,0,0,0.4);
          display: flex; flex-direction: column;
        }
        .t-drawer {
          background: #fff; padding: 20px 16px 32px;
          border-radius: 0 0 20px 20px;
        }
        .t-drawer-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .t-drawer-title { font-size: 14px; font-weight: 700; color: #111827; }
        .t-close-btn { background: none; border: none; font-size: 22px; cursor: pointer; color: #6B7280; padding: 0; }
        .t-drawer-user { background: #F9FAFB; border-radius: 10px; padding: 12px; margin-bottom: 16px; }
        .t-drawer-user-name { font-size: 14px; font-weight: 700; color: #111827; }
        .t-drawer-user-school { font-size: 12px; color: #6B7280; margin-top: 2px; }
        .t-drawer-item {
          display: flex; align-items: center; gap: 12px; padding: 12px 10px;
          border-radius: 10px; text-decoration: none; color: #374151; font-size: 14px; font-weight: 600;
          margin-bottom: 4px;
        }
        .t-drawer-item.active { background: #EEF2FF; color: #4F46E5; }
        .t-drawer-item:hover { background: #F9FAFB; }
        .t-sign-out {
          margin-top: 12px; padding: 12px 10px; width: 100%; display: flex; align-items: center; gap: 12px;
          border-radius: 10px; border: none; background: #FEF2F2; color: #B91C1C;
          font-size: 14px; font-weight: 700; cursor: pointer;
        }
        @media (min-width: 768px) {
          .t-bottom-nav { display: none; }
          .t-content { padding: 0; }
        }
      `}</style>

      <div className="t-shell">
        <header className="t-header">
          <div className="t-header-left">
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14 }}>T</div>
            <div>
              <div className="t-school-name">{schoolName || 'EdProSys'}</div>
            </div>
            <span className="t-user-role">Teacher</span>
          </div>
          <button className="t-menu-btn" onClick={() => setMenuOpen(true)} aria-label="Menu">☰</button>
        </header>

        <main className="t-content">{children}</main>

        {/* Bottom nav — 4 primary actions */}
        <nav className="t-bottom-nav">
          {NAV_ITEMS.map(item => (
            <Link key={item.href} href={item.href} className={`t-nav-item${isActive(item.href, item.exact) ? ' active' : ''}`}>
              <span className="t-nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Slide-down menu overlay */}
      {menuOpen && (
        <div className="t-overlay" onClick={() => setMenuOpen(false)}>
          <div className="t-drawer" onClick={e => e.stopPropagation()}>
            <div className="t-drawer-header">
              <span className="t-drawer-title">More</span>
              <button className="t-close-btn" onClick={() => setMenuOpen(false)}>×</button>
            </div>
            {userName && (
              <div className="t-drawer-user">
                <div className="t-drawer-user-name">{userName}</div>
                <div className="t-drawer-user-school">{schoolName}</div>
              </div>
            )}
            {MENU_ITEMS.map(item => (
              <Link key={item.href} href={item.href}
                className={`t-drawer-item${isActive(item.href) ? ' active' : ''}`}
                onClick={() => setMenuOpen(false)}>
                <span style={{ fontSize: 18 }}>{item.icon}</span>
                {item.label}
              </Link>
            ))}
            <button className="t-sign-out" onClick={handleSignOut}>
              <span>🚪</span> Sign Out
            </button>
          </div>
        </div>
      )}
    </>
  );
}
