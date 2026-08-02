'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav
      ref={headerRef}
      style={{
        padding: '0 16px',
        height: 60,
        display: 'flex',
        alignItems: 'center',
        borderBottom: '1px solid #F3F4F6',
        position: 'sticky',
        top: 0,
        background: '#fff',
        zIndex: 50,
      }}
    >
      {/* Brand logo + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, minWidth: 0, flexShrink: 1 }}>
        <img
          src="/brand/icon.png"
          alt="EdProSys logo"
          width={isMobile ? 32 : 48}
          height={isMobile ? 32 : 30}
          style={{
            width: isMobile ? 32 : 48,
            height: isMobile ? 32 : 30,
            objectFit: 'contain',
            objectPosition: 'center',
            display: 'block',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontWeight: 800,
            fontSize: 17,
            color: '#111827',
            letterSpacing: '-0.3px',
            whiteSpace: 'nowrap',
            flexShrink: isMobile ? 0 : 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          EdProSys
        </span>
      </div>

      {/* Desktop view */}
      {!isMobile && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', flexShrink: 0 }}>
          <Link
            href="/login"
            style={{
              padding: '7px 14px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: '#374151',
              textDecoration: 'none',
              background: '#F3F4F6',
            }}
          >
            Sign In
          </Link>
          <Link
            href="/register"
            style={{
              padding: '7px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              textDecoration: 'none',
              background: '#4F46E5',
            }}
          >
            Get Started Free →
          </Link>
        </div>
      )}

      {/* Mobile view hamburger */}
      {isMobile && (
        <button
          onClick={() => setMobileOpen(o => !o)}
          style={{
            marginLeft: 'auto',
            width: 44,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            color: '#111827',
          }}
          aria-label="Menu"
        >
          <Menu style={{ width: 24, height: 24 }} />
        </button>
      )}

      {/* Mobile dropdown panel */}
      {isMobile && mobileOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: '#fff',
            borderBottom: '1px solid #F3F4F6',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            zIndex: 100,
          }}
        >
          <Link
            href="/login"
            onClick={() => setMobileOpen(false)}
            style={{
              textAlign: 'center',
              padding: '10px 0',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              color: '#374151',
              textDecoration: 'none',
              background: '#F3F4F6',
              display: 'block',
            }}
          >
            Sign In
          </Link>
          <Link
            href="/register"
            onClick={() => setMobileOpen(false)}
            style={{
              textAlign: 'center',
              padding: '12px 0',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              color: '#fff',
              textDecoration: 'none',
              background: '#4F46E5',
              display: 'block',
            }}
          >
            Get Started Free →
          </Link>
        </div>
      )}
    </nav>
  );
}
