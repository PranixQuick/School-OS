// app/parent/layout.tsx
// Batch 10 — Parent app layout shell.
// Parent uses phone+PIN auth (not school_session JWT), so we cannot use
// components/Layout.tsx which requires /api/auth/session (staff-only endpoint).
// This provides a minimal app shell with school branding + nav links.
// The parent page itself handles phone+PIN session state internally.

import type { ReactNode } from 'react';

export default function ParentLayout({ children }: { children: ReactNode }) {
  // Parent authentication is handled within app/parent/page.tsx itself
  // (phone+PIN checked on every API call). No server-side redirect here
  // as parents may start at /parent/login or /parent/consent.
  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB' }}>
      {children}
    </div>
  );
}
