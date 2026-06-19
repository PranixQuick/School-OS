'use client';
// components/EntityDetailCard.tsx
// ISS-9 (#9 / P4.4) — Reusable entity detail card.
//
// A presentational modal used for the "click a name -> detail card" pattern
// across stakeholder lists (students, staff, vendors, defaulters, ...).
//
// Role-scoping: the CALLER decides which fields to pass in (using the #6
// permission source / viewer role), so the same component serves every
// stakeholder without baking policy in. Fields may be flagged `sensitive`
// for subtle emphasis, given a `href` (renders as a link), or `mono`.
//
// Closes on Escape and backdrop click. No dependencies beyond React.

import { useEffect } from 'react';

export interface DetailField {
  label: string;
  value: React.ReactNode;
  href?: string;       // render value as a link (e.g. tel:, mailto:)
  sensitive?: boolean; // subtle emphasis for restricted/PII fields
  mono?: boolean;      // monospace value (ids, codes)
}

export interface EntityDetailCardProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badge?: { label: string; bg: string; color: string };
  fields: DetailField[];
  accent?: string;             // header strip / avatar colour
  footer?: React.ReactNode;    // optional action row
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function EntityDetailCard({
  open, onClose, title, subtitle, badge, fields, accent = '#4F46E5', footer,
}: EntityDetailCardProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 460, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 20px', borderBottom: '1px solid #F3F4F6' }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: accent + '1A', color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, flexShrink: 0 }}>
            {initials(title)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
            {subtitle && <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{subtitle}</div>}
          </div>
          {badge && (
            <span style={{ fontSize: 11, fontWeight: 700, background: badge.bg, color: badge.color, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>{badge.label}</span>
          )}
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: 22, lineHeight: 1, color: '#9CA3AF', cursor: 'pointer', padding: 4 }}>×</button>
        </div>

        {/* Fields */}
        <div style={{ padding: '8px 20px 16px' }}>
          {fields.length === 0 ? (
            <div style={{ padding: '16px 0', fontSize: 13, color: '#9CA3AF' }}>No details to show.</div>
          ) : fields.map((f, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '10px 0', borderBottom: i < fields.length - 1 ? '1px solid #F9FAFB' : 'none' }}>
              <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 600, flexShrink: 0 }}>{f.label}</span>
              <span style={{ fontSize: 13, fontWeight: f.sensitive ? 700 : 600, color: f.sensitive ? '#B91C1C' : '#111827', textAlign: 'right', fontFamily: f.mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit', wordBreak: 'break-word' }}>
                {f.href ? <a href={f.href} style={{ color: accent, textDecoration: 'none' }}>{f.value}</a> : (f.value ?? '—')}
              </span>
            </div>
          ))}
        </div>

        {footer && <div style={{ padding: '12px 20px 18px', borderTop: '1px solid #F3F4F6' }}>{footer}</div>}
      </div>
    </div>
  );
}
