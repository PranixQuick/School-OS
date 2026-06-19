'use client';
// app/vendor/page.tsx
// ISS-7 (#7) — Vendor portal dashboard: profile + contract + edit own contact.

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Vendor {
  id: string; name: string; vendor_type: string;
  contact_name: string | null; contact_phone: string | null; contact_email: string | null;
  gst_number: string | null; address: string | null;
  contract_start: string | null; contract_end: string | null; portal_email: string | null;
}

export default function VendorDashboard() {
  const router = useRouter();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState({ contact_name: '', contact_phone: '', contact_email: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/vendor/me')
      .then(r => {
        if (r.status === 401) { router.push('/vendor/login'); return null; }
        return r.ok ? r.json() : null;
      })
      .then((d: { vendor?: Vendor } | null) => {
        if (d?.vendor) {
          setVendor(d.vendor);
          setEdit({ contact_name: d.vendor.contact_name ?? '', contact_phone: d.vendor.contact_phone ?? '', contact_email: d.vendor.contact_email ?? '' });
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function logout() {
    await fetch('/api/vendor/logout', { method: 'POST' }).catch(() => {});
    router.push('/vendor/login');
  }

  async function saveContact() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/vendor/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(edit) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.vendor) { setVendor(d.vendor); setEditing(false); setMsg({ kind: 'ok', text: 'Contact details updated.' }); }
      else setMsg({ kind: 'err', text: d.error ?? 'Could not update.' });
    } catch { setMsg({ kind: 'err', text: 'Network error.' }); }
    setBusy(false);
  }

  const card = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 16, marginBottom: 14 };
  const row = (label: string, value: string | null | undefined) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '1px solid #F3F4F6' }}>
      <span style={{ fontSize: 12, color: '#6B7280' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', textAlign: 'right' }}>{value || '—'}</span>
    </div>
  );
  const inp = { width: '100%', padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' as const, marginTop: 4, outline: 'none' as const };

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#1E40AF,#0EA5E9)', padding: '16px 16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>Vendor Portal</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <a href="/vendor/security" title="Change PIN"
              style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, color: '#fff', fontSize: 12, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' }}>🔑 PIN</a>
            <button onClick={() => void logout()}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>Sign out</button>
          </div>
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginTop: 8 }}>{loading ? '…' : (vendor?.name ?? 'Vendor')}</div>
        {vendor && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2, textTransform: 'capitalize' }}>{vendor.vendor_type}</div>}
      </div>

      <div style={{ padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading…</div>
        ) : !vendor ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Could not load your profile.</div>
        ) : (
          <>
            {msg && (
              <div style={{ marginBottom: 12, fontSize: 13, padding: '8px 12px', borderRadius: 8, background: msg.kind === 'ok' ? '#F0FDF4' : '#FEF2F2', color: msg.kind === 'ok' ? '#065F46' : '#B91C1C' }}>{msg.text}</div>
            )}

            {/* Profile / contract */}
            <div style={card}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 8 }}>Profile</div>
              {row('GST number', vendor.gst_number)}
              {row('Address', vendor.address)}
              {row('Contract start', vendor.contract_start)}
              {row('Contract end', vendor.contract_end)}
              {row('Login email', vendor.portal_email)}
            </div>

            {/* Contact (editable) */}
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>Contact details</div>
                {!editing && (
                  <button onClick={() => { setEditing(true); setMsg(null); }}
                    style={{ background: 'none', border: '1px solid #E5E7EB', color: '#4F46E5', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '4px 10px', cursor: 'pointer' }}>Edit</button>
                )}
              </div>

              {!editing ? (
                <>
                  {row('Contact name', vendor.contact_name)}
                  {row('Phone', vendor.contact_phone)}
                  {row('Email', vendor.contact_email)}
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label style={{ fontSize: 12, color: '#6B7280' }}>Contact name
                    <input style={inp} value={edit.contact_name} onChange={e => setEdit(s => ({ ...s, contact_name: e.target.value }))} />
                  </label>
                  <label style={{ fontSize: 12, color: '#6B7280' }}>Phone
                    <input style={inp} value={edit.contact_phone} onChange={e => setEdit(s => ({ ...s, contact_phone: e.target.value }))} />
                  </label>
                  <label style={{ fontSize: 12, color: '#6B7280' }}>Email
                    <input style={inp} value={edit.contact_email} onChange={e => setEdit(s => ({ ...s, contact_email: e.target.value }))} />
                  </label>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button onClick={() => void saveContact()} disabled={busy}
                      style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: busy ? '#A5B4FC' : '#4F46E5', color: '#fff', fontSize: 14, fontWeight: 700, cursor: busy ? 'default' : 'pointer' }}>{busy ? 'Saving…' : 'Save'}</button>
                    <button onClick={() => { setEditing(false); setEdit({ contact_name: vendor.contact_name ?? '', contact_phone: vendor.contact_phone ?? '', contact_email: vendor.contact_email ?? '' }); setMsg(null); }}
                      style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
