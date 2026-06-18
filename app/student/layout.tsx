'use client';
// app/student/layout.tsx
// Batch 4D — Student portal layout with nav.
// Reads student_session cookie client-side for name display (no middleware injection).

import { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV_ITEMS = [
  { label: 'Home', href: '/student', icon: '🏠' },
  { label: 'Timetable', href: '/student/timetable', icon: '📅' },
  { label: 'Homework', href: '/student/homework', icon: '📚' },
  { label: 'Attendance', href: '/student/attendance', icon: '✅' },
  { label: 'Marks', href: '/student/marks', icon: '📊' },
];

// Routes where the back affordance is intentionally hidden (tab-root home).
// Mirrors the HOME_ROUTES exclusion in components/Layout.tsx (PR #152): the
// student home is a bottom-nav root, so "back" there would leave the portal.
const HOME_ROUTES = new Set<string>(['/student']);

interface StudentLayoutProps { children: ReactNode; }

export default function StudentLayout({ children }: StudentLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [studentName, setStudentName] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const isLoginPage = pathname === '/student/login';
  const showBack = !HOME_ROUTES.has(pathname);

  useEffect(() => {
    if (isLoginPage) return;
    void fetch('/api/student/profile')
      .then(r => r.ok ? r.json() : null)
      .then((d: { profile?: { name: string; class: string; section: string } } | null) => {
        if (!d?.profile) { router.push('/student/login'); return; }
        setStudentName(d.profile.name);
        setStudentClass(`Class ${d.profile.class}-${d.profile.section}`);
      })
      .catch(() => router.push('/student/login'));
  }, [router, isLoginPage]);

  async function logout() {
    setLoggingOut(true);
    await fetch('/api/student/logout', { method: 'POST' });
    router.push('/student/login');
  }

  // Back navigation: use browser history when available, else fall back to the
  // student home so the control never dead-ends. Additive — does not change
  // the existing bottom-nav links.
  function goBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/student');
  }

  // On the login screen there is no session yet — render the bare page
  // without the portal chrome (header 'Sign out' + bottom nav).
  if (isLoginPage) {
    return <div style={{ minHeight: '100vh', background: '#F8FAFC' }}>{children}</div>;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <header style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {showBack && (
            <button onClick={goBack} aria-label="Back" title="Back"
              style={{ fontSize: 18, lineHeight: 1, color: '#374151', background: 'none', border: '1px solid #E5E7EB', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>
              ←
            </button>
          )}
          <span style={{ fontSize: 22 }}>🎓</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>{studentName || '…'}</div>
            <div style={{ fontSize: 10, color: '#6B7280' }}>{studentClass}</div>
          </div>
        </div>
        <button onClick={() => void logout()} disabled={loggingOut}
          style={{ fontSize: 11, color: '#6B7280', background: 'none', border: '1px solid #E5E7EB', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
          {loggingOut ? '...' : 'Sign out'}
        </button>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, padding: '16px 12px 80px', maxWidth: 720, margin: '0 auto', width: '100%' }}>
        {children}
      </main>

      {/* Bottom nav (mobile-first) */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-around', padding: '8px 0 env(safe-area-inset-bottom,8px)', zIndex: 20 }}>
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, textDecoration: 'none', minWidth: 52 }}>
              <span style={{ fontSize: active ? 22 : 20, filter: active ? 'none' : 'grayscale(0.5) opacity(0.6)' }}>{item.icon}</span>
              <span style={{ fontSize: 9, fontWeight: active ? 700 : 500, color: active ? '#4F46E5' : '#9CA3AF' }}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
