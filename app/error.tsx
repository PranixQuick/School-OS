'use client';
// app/error.tsx — Next.js App Router global error boundary
// Catches any unhandled client-side exception in the app tree.
// Displays a friendly message instead of blank white screen.

import { useEffect } from 'react';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    // Log to console for debugging — will show in browser devtools
    console.error('[EdProSys] Client error:', error?.message, error?.digest);
  }, [error]);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#F9FAFB', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      padding: 20,
    }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '32px 28px', maxWidth: 400, width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 8 }}>
          Something went wrong
        </div>
        <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 20, lineHeight: 1.6 }}>
          An unexpected error occurred. This has been noted.
          {error?.message ? (
            <span style={{ display: 'block', marginTop: 8, padding: '6px 10px', background: '#FEF2F2', borderRadius: 6, fontSize: 12, color: '#B91C1C', fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {error.message.slice(0, 120)}
            </span>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={reset}
            style={{ padding: '10px 20px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Try again
          </button>
          <a
            href="/dashboard"
            style={{ padding: '10px 20px', background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', display: 'inline-block' }}>
            Go to dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
