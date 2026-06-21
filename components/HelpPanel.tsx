'use client';
// components/HelpPanel.tsx
// ISS — per-role in-app help. A self-contained floating "?" button that opens a
// drawer explaining the current role's dashboard in plain language.
//
// Self-managing: owns its open/close state; closes on Escape and backdrop click.
// Additive — drop <HelpPanel role={effectiveRole} /> into Layout; nothing else
// depends on it. Content comes from lib/help-content (English-first; i18n later).

import { useEffect, useState } from 'react';
import { getRoleHelp } from '@/lib/help-content';

export default function HelpPanel({ role }: { role: string }) {
  const [open, setOpen] = useState(false);
  const help = getRoleHelp(role);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      {/* Floating help button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Help"
        title="Help"
        style={{
          position: 'fixed', right: 16, bottom: 16, zIndex: 60,
          width: 44, height: 44, borderRadius: '50%', border: 'none',
          background: '#4F46E5', color: '#fff', fontSize: 22, fontWeight: 700,
          cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
        }}
      >
        ?
      </button>

      {!open ? null : (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(17,24,39,0.45)',
            display: 'flex', justifyContent: 'flex-end',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Help: ${help.label}`}
            style={{
              width: 'min(420px, 92vw)', height: '100%', background: '#fff',
              boxShadow: '-8px 0 24px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{ padding: '16px 18px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#4F46E5', textTransform: 'uppercase', letterSpacing: 0.5 }}>Help</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#111827', marginTop: 2 }}>{help.label}</div>
                <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{help.intro}</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', fontSize: 18, color: '#374151', cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {/* Sections */}
            <div style={{ padding: '8px 18px 24px', overflowY: 'auto' }}>
              {help.sections.map((s, i) => (
                <div key={i} style={{ padding: '14px 0', borderBottom: i < help.sections.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{s.title}</div>
                  <div style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.5 }}>{s.body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
