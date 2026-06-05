'use client';
// app/admin/settings/branding/page.tsx
// Phase D — C5: Institution Branding Profile admin UI
// Allows admin to upload logo, seal, signature; set colors, font, tagline

import { useState, useEffect, useRef } from 'react';
import Layout from '@/components/Layout';

interface BrandingData {
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
  name?: string;
}

const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', margin: '10px 0 4px' } as const;
const inputStyle = { width: '100%', padding: '9px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const, background: '#F9FAFB' };

function FileUploadBox({
  label, currentUrl, fieldName, accept, onFileSelect
}: {
  label: string; currentUrl?: string | null; fieldName: string; accept?: string;
  onFileSelect: (name: string, file: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {currentUrl ? (
          <img src={currentUrl} alt={label} style={{ width: 56, height: 56, objectFit: 'contain', border: '1px solid #E5E7EB', borderRadius: 8 }} />
        ) : (
          <div style={{ width: 56, height: 56, background: '#F3F4F6', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🏫</div>
        )}
        <div>
          <button type="button" onClick={() => ref.current?.click()}
            style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {currentUrl ? 'Replace' : 'Upload'}
          </button>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>PNG, JPEG, WebP, SVG · max 2 MB</div>
        </div>
      </div>
      <input ref={ref} type="file" accept={accept ?? 'image/*'} style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFileSelect(fieldName, f); }} />
    </div>
  );
}

export default function BrandingPage() {
  const [branding, setBranding] = useState<BrandingData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({});
  const [form, setForm] = useState<BrandingData>({});

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/schools/branding');
        if (res.ok) {
          const d = await res.json() as { branding: BrandingData };
          setBranding(d.branding ?? {});
          setForm(d.branding ?? {});
        }
      } catch { /* keep empty */ }
      setLoading(false);
    })();
  }, []);

  function handleFile(name: string, file: File) {
    setPendingFiles(p => ({ ...p, [name]: file }));
  }

  async function save() {
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const fd = new FormData();
      // Attach any pending file uploads
      for (const [name, file] of Object.entries(pendingFiles)) {
        fd.append(name, file);
      }
      // Attach scalar fields
      for (const key of ['primary_color','secondary_color','font_family','tagline','website','contact_phone','contact_email','receipt_prefix'] as const) {
        const v = form[key];
        if (v) fd.append(key, v);
      }

      const res = await fetch('/api/admin/schools/branding', {
        method: 'POST',
        body: fd,
      });
      const d = await res.json().catch(() => ({})) as { error?: string; updated?: string[] };
      if (!res.ok) { setError(d.error ?? 'Save failed'); return; }
      setSuccess(`Saved: ${(d.updated ?? []).join(', ')}`);
      setPendingFiles({});
      // Refresh
      const r2 = await fetch('/api/admin/schools/branding');
      if (r2.ok) { const d2 = await r2.json() as { branding: BrandingData }; setBranding(d2.branding ?? {}); }
    } catch { setError('Network error'); }
    finally { setSaving(false); }
  }

  if (loading) return <Layout title="Institution Branding"><div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div></Layout>;

  return (
    <Layout title="Institution Branding" subtitle="Logo, seal, signature, colors, and document identity">
      <div style={{ maxWidth: 680 }}>

        {/* File uploads */}
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 16 }}>Images</div>
          <FileUploadBox label="School Logo" currentUrl={branding.logo_url} fieldName="logo" onFileSelect={handleFile} />
          <FileUploadBox label="Official Seal" currentUrl={branding.seal_url} fieldName="seal" onFileSelect={handleFile} />
          <FileUploadBox label="Principal / Registrar Signature" currentUrl={branding.signature_url} fieldName="signature" onFileSelect={handleFile} />
        </div>

        {/* Scalar fields */}
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 4 }}>Document Identity</div>

          <label style={labelStyle}>Tagline</label>
          <input style={inputStyle} value={form.tagline ?? ''}
            onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))}
            placeholder="e.g. Nurturing Excellence Since 1984" />

          <label style={labelStyle}>Receipt Prefix</label>
          <input style={inputStyle} value={form.receipt_prefix ?? ''}
            onChange={e => setForm(f => ({ ...f, receipt_prefix: e.target.value }))}
            placeholder="e.g. ZPHS-PDL" />

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Contact Phone</label>
              <input style={inputStyle} value={form.contact_phone ?? ''}
                onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))}
                placeholder="+91 94000 00000" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Contact Email</label>
              <input style={inputStyle} value={form.contact_email ?? ''}
                onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
                placeholder="office@school.edu" />
            </div>
          </div>

          <label style={labelStyle}>Website</label>
          <input style={inputStyle} value={form.website ?? ''}
            onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
            placeholder="https://school.edu" />
        </div>

        {/* Colors */}
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 4 }}>Brand Colors</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Primary Color</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={form.primary_color ?? '#1A5276'}
                  onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
                  style={{ width: 40, height: 40, border: 'none', cursor: 'pointer', borderRadius: 6 }} />
                <input style={{ ...inputStyle, flex: 1 }} value={form.primary_color ?? ''}
                  onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
                  placeholder="#1A5276" />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Secondary Color</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={form.secondary_color ?? '#2E86C1'}
                  onChange={e => setForm(f => ({ ...f, secondary_color: e.target.value }))}
                  style={{ width: 40, height: 40, border: 'none', cursor: 'pointer', borderRadius: 6 }} />
                <input style={{ ...inputStyle, flex: 1 }} value={form.secondary_color ?? ''}
                  onChange={e => setForm(f => ({ ...f, secondary_color: e.target.value }))}
                  placeholder="#2E86C1" />
              </div>
            </div>
          </div>

          <label style={labelStyle}>Font Family (for PDFs)</label>
          <select style={inputStyle} value={form.font_family ?? 'Helvetica'}
            onChange={e => setForm(f => ({ ...f, font_family: e.target.value }))}>
            <option value="Helvetica">Helvetica (Default)</option>
            <option value="Times-Roman">Times Roman</option>
            <option value="Courier">Courier</option>
            <option value="NotoSans">Noto Sans (Telugu/Hindi)</option>
          </select>
        </div>

        {error && <div style={{ color: '#B91C1C', fontSize: 13, marginBottom: 12, padding: '10px 14px', background: '#FEE2E2', borderRadius: 8 }}>{error}</div>}
        {success && <div style={{ color: '#15803D', fontSize: 13, marginBottom: 12, padding: '10px 14px', background: '#DCFCE7', borderRadius: 8 }}>✓ {success}</div>}

        <button onClick={() => void save()} disabled={saving}
          style={{ height: 44, padding: '0 24px', borderRadius: 9, border: 'none', background: saving ? '#9CA3AF' : '#4F46E5', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
          {saving ? 'Saving…' : 'Save Branding'}
        </button>
      </div>
    </Layout>
  );
}
