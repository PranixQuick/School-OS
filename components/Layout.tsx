'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Role-based navigation — ONLY routes that have actual pages
const NAV_BY_ROLE: Record<string, { group: string; items: { label: string; href: string; icon: string }[] }[]> = {
  admin: [
    { group: 'Overview', items: [
      { label: 'Dashboard', href: '/dashboard', icon: '🏠' },
      { label: 'Admissions', href: '/admissions', icon: '🚀' },
    ]},
    { group: 'School', items: [
      { label: 'Students', href: '/students', icon: '👨‍🎓' },
      { label: 'Staff', href: '/admin/staff', icon: '👥' },
      { label: 'Timetable', href: '/admin/timetable', icon: '🗓' },
    ]},
    { group: 'Finance', items: [
      { label: 'Fees', href: '/admin/fees', icon: '💰' },
    ]},
    { group: 'Communication', items: [
      { label: 'Broadcasts', href: '/admin/broadcasts', icon: '📢' },
      { label: 'WhatsApp Bot', href: '/whatsapp', icon: '💬' },
      { label: 'Parents', href: '/admin/parents', icon: '👨‍👩‍👧' },
    ]},
    { group: 'AI Tools', items: [
      { label: 'Report Cards', href: '/report-cards', icon: '📄' },
      { label: 'Teacher Eval', href: '/teacher-eval', icon: '🎙' },
      { label: 'Analytics', href: '/analytics', icon: '📊' },
    ]},
    { group: 'Records', items: [
      { label: 'Transfer Certs', href: '/admin/transfer-certificates', icon: '📋' },
    ]},
    { group: 'Account', items: [
      { label: 'Settings', href: '/settings', icon: '⚙️' },
    ]},
  ],
  admin_staff: [
    { group: 'Overview', items: [
      { label: 'Dashboard', href: '/dashboard', icon: '🏠' },
    ]},
    { group: 'School', items: [
      { label: 'Students', href: '/students', icon: '👨‍🎓' },
      { label: 'Staff', href: '/admin/staff', icon: '👥' },
    ]},
    { group: 'Finance', items: [
      { label: 'Fees', href: '/admin/fees', icon: '💰' },
    ]},
    { group: 'Communication', items: [
      { label: 'Broadcasts', href: '/admin/broadcasts', icon: '📢' },
      { label: 'Parents', href: '/admin/parents', icon: '👨‍👩‍👧' },
    ]},
    { group: 'Records', items: [
      { label: 'Transfer Certs', href: '/admin/transfer-certificates', icon: '📋' },
    ]},
    { group: 'Account', items: [
      { label: 'Settings', href: '/settings', icon: '⚙️' },
    ]},
  ],
  accountant: [
    { group: 'Finance', items: [
      { label: 'Dashboard', href: '/dashboard', icon: '🏠' },
      { label: 'Fees', href: '/admin/fees', icon: '💰' },
      { label: 'Students', href: '/students', icon: '👨‍🎓' },
    ]},
    { group: 'Account', items: [
      { label: 'Settings', href: '/settings', icon: '⚙️' },
    ]},
  ],
  principal: [
    { group: 'Overview', items: [
      { label: 'Dashboard', href: '/principal', icon: '🏠' },
      { label: 'Students', href: '/students', icon: '👨‍🎓' },
      { label: 'Staff', href: '/admin/staff', icon: '👥' },
    ]},
    { group: 'AI Tools', items: [
      { label: 'Teacher Eval', href: '/teacher-eval', icon: '🎙' },
      { label: 'Report Cards', href: '/report-cards', icon: '📄' },
      { label: 'Analytics', href: '/analytics', icon: '📊' },
    ]},
    { group: 'Account', items: [
      { label: 'Settings', href: '/settings', icon: '⚙️' },
    ]},
  ],
  owner: [
    { group: 'Overview', items: [
      { label: 'Dashboard', href: '/owner', icon: '🏠' },
      { label: 'Students', href: '/students', icon: '👨‍🎓' },
      { label: 'Staff', href: '/admin/staff', icon: '👥' },
    ]},
    { group: 'Finance', items: [
      { label: 'Fees', href: '/admin/fees', icon: '💰' },
    ]},
    { group: 'AI Tools', items: [
      { label: 'Analytics', href: '/analytics', icon: '📊' },
    ]},
    { group: 'Account', items: [
      { label: 'Settings', href: '/settings', icon: '⚙️' },
    ]},
  ],
  teacher: [
    { group: 'My Day', items: [
      { label: 'Dashboard', href: '/teacher', icon: '🏠' },
      { label: 'Check In', href: '/teacher/check-in', icon: '📍' },
    ]},
    { group: 'Classes', items: [
      { label: 'Attendance', href: '/teacher/attendance', icon: '✅' },
      { label: 'Homework', href: '/teacher/homework', icon: '📚' },
      { label: 'Marks', href: '/teacher/marks', icon: '📝' },
      { label: 'Lesson Plans', href: '/teacher/lesson-plans', icon: '📖' },
    ]},
    { group: 'HR', items: [
      { label: 'Leave', href: '/teacher/leave', icon: '🏖' },
    ]},
  ],
  viewer: [
    { group: 'Main', items: [
      { label: 'Dashboard', href: '/dashboard', icon: '🏠' },
    ]},
  ],
  counsellor: [
    { group: 'Main', items: [
      // Counsellor lands on admin dashboard, not teacher portal
      { label: 'Dashboard', href: '/dashboard', icon: '🏠' },
      { label: 'Students', href: '/students', icon: '👨‍🎓' },
    ]},
  ],
};

// Fallback nav for unknown roles
const DEFAULT_NAV = [
  { group: 'Main', items: [
    { label: 'Dashboard', href: '/dashboard', icon: '🏠' },
    { label: 'Settings', href: '/settings', icon: '⚙️' },
  ]},
];

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function Layout({ children, title, subtitle, actions }: LayoutProps) {
  const pathname = usePathname();
  const [role, setRole] = useState<string>('admin');
  const [userName, setUserName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => {
      if (d) {
        setRole(d.role ?? 'admin');
        setUserName(d.name ?? d.email ?? '');
        setSchoolName(d.school_name ?? '');
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sidebarOpen && sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setSidebarOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [sidebarOpen]);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  const navGroups = NAV_BY_ROLE[role] ?? DEFAULT_NAV;

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  const isActive = (href: string) => pathname === href || (href !== '/dashboard' && href !== '/teacher' && href !== '/principal' && href !== '/owner' && pathname.startsWith(href));

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F9FAFB', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 39, display: 'block' }} />
      )}

      <div ref={sidebarRef} style={{
        width: 240, background: '#fff', borderRight: '1px solid #E5E7EB',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 40,
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.22s ease',
        overflowY: 'auto',
      }}
        className="sidebar-desktop-visible">

        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #F3F4F6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#4F46E5',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 900, color: '#fff', flexShrink: 0 }}>E</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#111827', lineHeight: 1.2 }}>EdProSys</div>
              {schoolName && <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1, lineHeight: 1 }}>{schoolName}</div>}
            </div>
          </div>
          {/* Viewer read-only badge */}
          {role === 'viewer' && (
            <div style={{ marginTop: 8, padding: '3px 8px', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 5, fontSize: 10, fontWeight: 700, color: '#92400E', display: 'inline-block' }}>
              👁 READ ONLY
            </div>
          )}
        </div>

        <nav style={{ flex: 1, padding: '8px 8px 0', overflowY: 'auto' }}>
          {navGroups.map(group => (
            <div key={group.group} style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.08em',
                padding: '8px 10px 4px', textTransform: 'uppercase' }}>
                {group.group}
              </div>
              {group.items.map(item => {
                const active = isActive(item.href);
                return (
                  <Link key={item.href} href={item.href}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 10px', borderRadius: 9, marginBottom: 2,
                      textDecoration: 'none', minHeight: 40,
                      background: active ? '#EEF2FF' : 'transparent',
                      color: active ? '#4F46E5' : '#374151',
                      fontWeight: active ? 700 : 500, fontSize: 13,
                    }}>
                    <span style={{ fontSize: 16, flexShrink: 0, width: 20, textAlign: 'center' }}>{item.icon}</span>
                    <span>{item.label}</span>
                    {active && <span style={{ marginLeft: 'auto', width: 4, height: 4, borderRadius: '50%', background: '#4F46E5' }} />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div style={{ padding: '10px 12px 14px', borderTop: '1px solid #F3F4F6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#EEF2FF', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, color: '#4F46E5', fontSize: 12 }}>
              {userName ? userName[0].toUpperCase() : 'U'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName || 'User'}</div>
              <div style={{ fontSize: 10, color: '#9CA3AF' }}>{role}</div>
            </div>
          </div>
          <button onClick={handleLogout}
            style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #E5E7EB',
              background: '#fff', color: '#6B7280', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              textAlign: 'left' }}>
            Sign out →
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, marginLeft: 0 }}
        className="main-with-sidebar">

        <div style={{
          background: '#fff', borderBottom: '1px solid #E5E7EB',
          padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', gap: 12,
          position: 'sticky', top: 0, zIndex: 30, flexShrink: 0,
        }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="mobile-menu-btn"
            style={{ width: 40, height: 40, borderRadius: 8, border: 'none', background: '#F3F4F6',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              flexShrink: 0, padding: 0, fontSize: 18 }}>
            ☰
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            {title && <div style={{ fontWeight: 800, fontSize: 16, color: '#111827', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>}
            {subtitle && <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>}
          </div>

          {actions && <div style={{ flexShrink: 0 }}>{actions}</div>}
        </div>

        <main style={{ flex: 1, padding: '20px 16px 80px', maxWidth: 1100, width: '100%', boxSizing: 'border-box' }}>
          {children}
        </main>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .sidebar-desktop-visible { transform: translateX(0) !important; }
          .main-with-sidebar { margin-left: 240px !important; }
          .mobile-menu-btn { display: none !important; }
        }
        @media (max-width: 767px) {
          .main-with-sidebar { margin-left: 0 !important; }
        }
      `}</style>
    </div>
  );
}
