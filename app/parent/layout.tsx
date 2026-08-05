'use client';

import { ReactNode, useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import HelpPanel from '@/components/HelpPanel';

interface ParentLayoutProps { children: ReactNode; }

export default function ParentLayout({ children }: ParentLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [brandingLogo, setBrandingLogo] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const isLoginPage = pathname === '/parent/login';

  useEffect(() => {
    if (isLoginPage) return;
    fetch('/api/admin/schools/branding')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.branding?.logo_url) {
          setBrandingLogo(data.branding.logo_url);
        } else {
          setBrandingLogo('/brand/icon.png');
        }
      })
      .catch(() => {
        setBrandingLogo('/brand/icon.png');
      });
  }, [isLoginPage]);

  async function logout() {
    setLoggingOut(true);
    await fetch('/api/parent/logout', { method: 'POST' }).catch(() => {});
    router.push('/parent/login');
    setLoggingOut(false);
  }

  if (isLoginPage) {
    return (
      <div style={{ minHeight: '100vh', background: '#F9FAFB' }}>
        {children}
        <HelpPanel role="parent" />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <header style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '0 16px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {brandingLogo && (
            <img
              src={brandingLogo}
              alt="logo"
              style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 8 }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/brand/icon.png';
              }}
            />
          )}
          <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Parent Portal</span>
        </div>
        <div>
          <button onClick={() => void logout()} disabled={loggingOut}
            style={{ fontSize: 11, color: '#6B7280', background: 'none', border: '1px solid #E5E7EB', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
            {loggingOut ? '...' : 'Sign out'}
          </button>
        </div>
      </header>

      {/* Main content */}
      <main style={{ flex: 1 }}>
        {children}
      </main>
      <HelpPanel role="parent" />
    </div>
  );
}
