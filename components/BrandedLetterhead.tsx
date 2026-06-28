/* eslint-disable @next/next/no-img-element */
// components/BrandedLetterhead.tsx
// Shared institution letterhead for generated documents (fee receipts, transfer
// certificates, report cards). Driven by the school's branding (logo, colours, tagline,
// contact). Print- and grayscale-safe. Falls back to a neutral header when unset.

import type { CSSProperties } from 'react';

export interface DocBranding {
  name?: string | null;
  address?: string | null;
  logo_url?: string | null;
  seal_url?: string | null;
  signature_url?: string | null;
  tagline?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  website?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  udise_code?: string | null;
}

export function BrandedLetterhead({ b, title, meta, style }: { b: DocBranding; title?: string; meta?: string; style?: CSSProperties }) {
  const primary = b.primary_color || '#111827';
  const contact = [b.contact_phone, b.contact_email, b.website].filter(Boolean).join('  •  ');
  return (
    <div style={{ borderBottom: `3px solid ${primary}`, paddingBottom: 8, marginBottom: 10, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'center', textAlign: 'center' }}>
        {b.logo_url ? <img src={b.logo_url} alt="logo" style={{ height: 56, width: 56, objectFit: 'contain', flexShrink: 0 }} /> : null}
        <div>
          {b.udise_code ? <div style={{ fontSize: 10 }}>UDISE: {b.udise_code}</div> : null}
          <div style={{ fontSize: 18, fontWeight: 'bold', color: primary, textTransform: 'uppercase', letterSpacing: 0.3 }}>{b.name || 'School Name'}</div>
          {b.tagline ? <div style={{ fontSize: 11, fontStyle: 'italic', color: '#444' }}>{b.tagline}</div> : null}
          {b.address ? <div style={{ fontSize: 11 }}>{b.address}</div> : null}
          {contact ? <div style={{ fontSize: 10, color: '#555' }}>{contact}</div> : null}
        </div>
      </div>
      {title ? <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 'bold', marginTop: 8 }}>{title}</div> : null}
      {meta ? <div style={{ textAlign: 'center', fontSize: 11, color: '#555', marginTop: 2 }}>{meta}</div> : null}
    </div>
  );
}

/** Signature line that shows the authorised signatory image when available. */
export function SignatureBlock({ url, label }: { url?: string | null; label: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ borderBottom: '1px solid #000', height: 34, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
        {url ? <img src={url} alt={label} style={{ maxHeight: 30, maxWidth: '95%', objectFit: 'contain' }} /> : null}
      </div>
      <div style={{ fontSize: 11, marginTop: 4 }}>{label}</div>
    </div>
  );
}

/** Faint seal/stamp watermark for the corner of an official document. */
export function SealMark({ url }: { url?: string | null }) {
  if (!url) return null;
  return <img src={url} alt="seal" style={{ position: 'absolute', right: 14, bottom: 40, height: 72, width: 72, objectFit: 'contain', opacity: 0.18, pointerEvents: 'none' }} />;
}
