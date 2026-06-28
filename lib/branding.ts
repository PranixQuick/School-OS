// lib/branding.ts
// Institution branding — the single source of truth for "upload once, apply everywhere".
// Reads the schools row written by /api/admin/schools/branding and returns a normalized
// object (with safe defaults) for any generated document: fee receipts, transfer
// certificates, report cards, etc.

import { supabaseAdmin } from '@/lib/supabaseClient';

export interface SchoolBranding {
  name: string;
  address: string | null;
  logo_url: string | null;
  seal_url: string | null;
  signature_url: string | null;
  primary_color: string;
  secondary_color: string;
  font_family: string | null;
  tagline: string | null;
  website: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  receipt_prefix: string | null;
}

const DEFAULT_PRIMARY = '#4F46E5';
const DEFAULT_SECONDARY = '#6D28D9';
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

function hex(v: unknown, fallback: string): string {
  return typeof v === 'string' && HEX_RE.test(v) ? v : fallback;
}
function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

const BRANDING_COLUMNS =
  'name, address, logo_url, seal_url, signature_url, primary_color, secondary_color, font_family, tagline, website, contact_phone, contact_email, receipt_prefix';

function normalize(row: Record<string, unknown> | null | undefined): SchoolBranding {
  const s = row ?? {};
  return {
    name: str(s.name) ?? 'Your School',
    address: str(s.address),
    logo_url: str(s.logo_url),
    seal_url: str(s.seal_url),
    signature_url: str(s.signature_url),
    primary_color: hex(s.primary_color, DEFAULT_PRIMARY),
    secondary_color: hex(s.secondary_color, DEFAULT_SECONDARY),
    font_family: str(s.font_family),
    tagline: str(s.tagline),
    website: str(s.website),
    contact_phone: str(s.contact_phone),
    contact_email: str(s.contact_email),
    receipt_prefix: str(s.receipt_prefix),
  };
}

/** Server-side: fetch a school's branding (safe defaults if unset). */
export async function getSchoolBranding(schoolId: string): Promise<SchoolBranding> {
  const { data } = await supabaseAdmin
    .from('schools')
    .select(BRANDING_COLUMNS)
    .eq('id', schoolId)
    .maybeSingle();
  return normalize(data as Record<string, unknown> | null);
}

/** Normalize a partial branding object received from an API into a full SchoolBranding. */
export function brandingFromApi(row: Record<string, unknown> | null | undefined): SchoolBranding {
  return normalize(row);
}
