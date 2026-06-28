'use client';
// app/admin/settings/branding/page.tsx
// Institution Branding — upload once, applied everywhere.
// Staff upload logo / seal / signature + set colours, tagline, contact + receipt prefix.
// Saved via /api/admin/schools/branding; auto-applied to receipts, transfer certificates
// and report cards.

import { useState, useEffect, useRef, type CSSProperties } from 'react';
import Layout from '@/components/Layout';

interface Branding {
  logo_url?: string | null;
  seal_url?: string | null;
  signature_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  font_family?: string | null;
  tagline?: string | null;
  website?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  receipt_prefix?: string | null;
  name?: string | null;
}

type ImgField = 'logo' | 'seal' | 'signature';

const card: CSSProperties = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 18, marginBottom: 16 };
const lbl: CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280', margin: '10px 0 4px' };
const input: CSSProperties = { width: '100%', padding: '9px 11px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', background: '#F9FAFB' };

export default function BrandingPage() {
  const [b, setB] = useState<Branding>({});
  const [files, setFiles] = useState<{ [k in ImgField]?: File }>({});
  const [previews, setPreviews] = useState<{ [k in ImgField]?: string }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const fileRefs = { logo: useRef<HTMLInputElement>(null), seal: useRef<HTMLInputElement>(null), signature: useRef<HTMLInputElement>(null) };

  useEffect(() => {
    fetch('/api/admin/schools/branding')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.branding) setB(d.branding); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function pickFile(field: ImgField, f: File | null) {
    if (!f) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(f.type)) {
      setToast({ ok: false, msg: 'Use PNG, JPEG, WebP or SVG.' }); return;
    }
    if (f.size > 2 * 1024 * 1024) { setToast({ ok: false, msg: `${field} exceeds 2 MB.` }); return; }
    setFiles(prev => ({ ...prev, [field]: f }));
    setPreviews(prev => ({ ...prev, [field]: URL.createObjectURL(f) }));
  }

  function up(k: keyof Branding, v: string) { setB(prev => ({ ...prev, [k]: v })); }

  async function save() {
    setSaving(true); setToast(null);
    try {
      const fd = new FormData();
      (['logo', 'seal', 'signature'] as ImgField[]).forEach(f => { if (files[f]) fd.append(f, files[f] as File); });
      for (const k of ['primary_color', 'secondary_color', 'font_family', 'tagline', 'website', 'contact_phone', 'contact_email', 'receipt_prefix'] as (keyof Branding)[]) {
        const v = b[k]; if (typeof v === 'string' && v.trim()) fd.append(k, v.trim());
      }
      const r = await fetch('/api/admin/schools/branding', { method: 'POST', body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setToast({ ok: false, msg: d.error ?? 'Could not save branding.' }); return; }
      setToast({ ok: true, msg: '✓ Branding saved — it now applies to all documents.' });
      // refresh canonical urls
      const fresh = await fetch('/api/admin/schools/branding').then(x => x.ok ? x.json() : null).catch(() => null);
      if (fresh?.branding) setB(fresh.branding);
      setFiles({});
    } catch { setToast({ ok: false, msg: 'Network error.' }); }
    finally { setSaving(false); setTimeout(() => setToast(null), 4000); }
  }

  const primary = b.primary_color || '#4F46E5';
  const secondary = b.secondary_color || '#6D28D9';
  const logoSrc = previews.logo || b.logo_url || '';
  const signSrc = previews.signature || b.signature_url || '';
  const sealSrc = previews.seal || b.seal_url || '';

  function ImageField({ field, label, hint }: { field: ImgField; label: string; hint: string }) {
    const src = previews[field] || (b[`${field}_url` as keyof Branding] as string) || '';
    return (
      <div style={{ flex: 1, minWidth: 150 }}>
        <label style={lbl}>{label}</label>
        <div onClick={() => fileRefs[field].current?.click()}
          style={{ height: 88, border: '1.5px dashed #C7D2FE', borderRadius: 10, background: '#F8FAFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' }}>
          {src ? <img src={src} alt={label} style={{ maxHeight: 76, maxWidth: '90%', objectFit: 'contain' }} />
            : <span style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', padding: 6 }}>{hint}<br />Click to upload</span>}
        </div>
        <input ref={fileRefs[field]} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style={{ display: 'none' }}
          onChange={e => pickFile(field, e.target.files?.[0] ?? null)} />
      </div>
    );
  }

  return (
    <Layout title="Institution branding" subtitle="Upload once — applied to receipts, transfer certificates & report cards">
      {toast && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#fff', background: toast.ok ? '#065F46' : '#991B1B' }}>{toast.msg}</div>
      )}

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
      ) : (
        <>
          {/* Live letterhead preview */}
          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <div style={{ height: 6, background: `linear-gradient(90deg, ${primary}, ${secondary})` }} />
            <div style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
              {logoSrc
                ? <img src={logoSrc} alt="logo" style={{ height: 56, width: 56, objectFit: 'contain', flexShrink: 0 }} />
                : <div style={{ height: 56, width: 56, borderRadius: 10, background: primary, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>{(b.name || 'S').slice(0, 1)}</div>}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: primary, textTransform: 'uppercase' }}>{b.name || 'Your School'}</div>
                {b.tagline && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{b.tagline}</div>}
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                  {[b.contact_phone, b.contact_email, b.website].filter(Boolean).join('  ·  ')}
                </div>
              </div>
            </div>
            <div style={{ padding: '0 18px 14px', fontSize: 11, color: '#9CA3AF' }}>↑ Live preview of how your documents’ letterhead will look.</div>
          </div>

          {/* Images */}
          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 4 }}>Logo, seal & signature</div>
            <div style={{ fontSize: 11.5, color: '#9CA3AF', marginBottom: 8 }}>PNG/JPEG/WebP/SVG, up to 2 MB each.</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <ImageField field="logo" label="Logo" hint="Institution logo" />
              <ImageField field="seal" label="Seal / Stamp" hint="Official seal" />
              <ImageField field="signature" label="Signature" hint="Authorised signatory" />
            </div>
          </div>

          {/* Colors + identity */}
          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 6 }}>Colours & identity</div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <div>
                <label style={lbl}>Primary colour</label>
                <input type="color" value={primary} onChange={e => up('primary_color', e.target.value)} style={{ width: 56, height: 38, border: '1px solid #D1D5DB', borderRadius: 8, background: '#fff', cursor: 'pointer' }} />
              </div>
              <div>
                <label style={lbl}>Secondary colour</label>
                <input type="color" value={secondary} onChange={e => up('secondary_color', e.target.value)} style={{ width: 56, height: 38, border: '1px solid #D1D5DB', borderRadius: 8, background: '#fff', cursor: 'pointer' }} />
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label style={lbl}>Tagline (optional)</label>
                <input style={input} value={b.tagline ?? ''} onChange={e => up('tagline', e.target.value)} placeholder="e.g. Excellence in Education since 1998" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
              <div style={{ flex: 1, minWidth: 150 }}>
                <label style={lbl}>Contact phone</label>
                <input style={input} value={b.contact_phone ?? ''} onChange={e => up('contact_phone', e.target.value)} placeholder="+91 …" />
              </div>
              <div style={{ flex: 1, minWidth: 150 }}>
                <label style={lbl}>Contact email</label>
                <input style={input} value={b.contact_email ?? ''} onChange={e => up('contact_email', e.target.value)} placeholder="office@school.edu" />
              </div>
              <div style={{ flex: 1, minWidth: 150 }}>
                <label style={lbl}>Website</label>
                <input style={input} value={b.website ?? ''} onChange={e => up('website', e.target.value)} placeholder="www.school.edu" />
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <label style={lbl}>Receipt prefix</label>
                <input style={input} value={b.receipt_prefix ?? ''} onChange={e => up('receipt_prefix', e.target.value)} placeholder="e.g. SUCH" />
              </div>
            </div>
          </div>

          <button onClick={save} disabled={saving}
            style={{ padding: '11px 26px', background: saving ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 0, borderRadius: 9, fontSize: 14, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving…' : 'Save branding'}
          </button>
          {(sealSrc || signSrc) && (
            <span style={{ marginLeft: 12, fontSize: 11.5, color: '#9CA3AF' }}>
              {signSrc ? 'Signature' : ''}{signSrc && sealSrc ? ' + ' : ''}{sealSrc ? 'seal' : ''} will appear on issued documents.
            </span>
          )}
        </>
      )}
    </Layout>
  );
}
