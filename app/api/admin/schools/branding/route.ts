// app/api/admin/schools/branding/route.ts
// Phase D — C5: Institution Branding Profile upload + update
// Handles: multipart/form-data for logo, seal, signature uploads
//          JSON body for color/font/tagline updates
// Auth: requireAdminSession — owner or admin_staff only
// Storage: Supabase bucket 'Institution-Branding' (public read, school-scoped write)
// Bucket reconciled 2026-06-05: renamed from school-branding → Institution-Branding (Option B, founder-created)
// MIME whitelist: image/png, image/jpeg, image/webp, image/svg+xml
// NOTE: founder must also add image/png to Institution-Branding bucket MIME whitelist in Supabase dashboard

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabaseClient';

const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const BUCKET = 'Institution-Branding';

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

type BrandingField = 'logo' | 'seal' | 'signature';

interface BrandingUpdate {
  logo_url?: string;
  seal_url?: string;
  signature_url?: string;
  primary_color?: string;
  secondary_color?: string;
  font_family?: string;
  tagline?: string;
  website?: string;
  contact_phone?: string;
  contact_email?: string;
  receipt_prefix?: string;
}

async function uploadBrandingFile(
  schoolId: string,
  field: BrandingField,
  file: File
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'png';
  const storagePath = `${schoolId}/${field}.${ext}`;
  const bytes = await file.arrayBuffer();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, {
      contentType: file.type,
      upsert: true,
    });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  const { schoolId } = auth;
  const update: BrandingUpdate = {};

  const contentType = req.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();

    // Handle file uploads
    for (const field of ['logo', 'seal', 'signature'] as BrandingField[]) {
      const file = form.get(field);
      if (file instanceof File && file.size > 0) {
        if (!ALLOWED_MIME.includes(file.type)) {
          return NextResponse.json(
            { error: `Invalid file type for ${field}. Allowed: PNG, JPEG, WebP, SVG` },
            { status: 400 }
          );
        }
        if (file.size > MAX_FILE_BYTES) {
          return NextResponse.json(
            { error: `File ${field} exceeds 2 MB limit` },
            { status: 400 }
          );
        }
        const url = await uploadBrandingFile(schoolId, field, file);
        (update as Record<string, string>)[`${field}_url`] = url;
      }
    }

    // Handle scalar fields from form
    for (const key of ['primary_color', 'secondary_color', 'font_family', 'tagline', 'website', 'contact_phone', 'contact_email', 'receipt_prefix']) {
      const val = form.get(key);
      if (typeof val === 'string' && val.trim()) {
        (update as Record<string, string>)[key] = val.trim();
      }
    }
  } else {
    // JSON body
    const body = await req.json().catch(() => ({})) as BrandingUpdate;
    for (const key of ['primary_color', 'secondary_color', 'font_family', 'tagline', 'website', 'contact_phone', 'contact_email', 'receipt_prefix'] as (keyof BrandingUpdate)[]) {
      const val = body[key];
      if (typeof val === 'string' && val.trim()) {
        (update as Record<string, string>)[key] = val.trim();
      }
    }
  }

  // Validate hex colors if provided
  for (const colorKey of ['primary_color', 'secondary_color'] as const) {
    const v = (update as Record<string, string | undefined>)[colorKey];
    if (v && !HEX_RE.test(v)) {
      return NextResponse.json({ error: `${colorKey} must be a valid 6-digit hex color (e.g. #1A5276)` }, { status: 400 });
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid branding fields provided' }, { status: 400 });
  }

  const { error } = await supabase
    .from('schools')
    .update(update)
    .eq('id', schoolId);

  if (error) {
    console.error('[branding] DB update failed:', error.message);
    return NextResponse.json({ error: 'Failed to update branding' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: Object.keys(update) });
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  const { data, error } = await supabase
    .from('schools')
    .select('logo_url, seal_url, signature_url, primary_color, secondary_color, font_family, tagline, website, contact_phone, contact_email, receipt_prefix, name')
    .eq('id', auth.schoolId)
    .single();

  if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ branding: data });
}
