'use client';
// PATH: app/admin/settings/page.tsx
// Batch 2 — Task 3: Admin settings hub.
// Payment Configuration section: Razorpay key ID + secret + online payments toggle.
// GET /api/admin/settings/razorpay on load (masked status).
// POST /api/admin/settings/razorpay on save.

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

// Batch 4A: Inline institution config widget
function InstitutionConfig() {
  const [config, setConfig] = useState<{institution_type:string;ownership_type:string;feature_flags:Record<string,unknown>}|null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string|null>(null);

  useEffect(() => {
    void fetch('/api/admin/institution-config').then(r => r.ok ? r.json() : null)
      .then((d:{institution_type:string;ownership_type:string;feature_flags:Record<string,unknown>}|null) => { if (d) setConfig(d); });
  }, []);

  async function save() {
    if (!config) return;
    setSaving(true); setSaveMsg(null);
    const res = await fetch('/api/admin/institution-config', {
      method: 'PATCH', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ institution_type: config.institution_type, feature_flags_patch: config.feature_flags }),
    });
    setSaveMsg(res.ok ? '✓ Saved' : 'Error saving'); setSaving(false);
    setTimeout(() => setSaveMsg(null), 3000);
  }

  const INSTITUTION_TYPES = [
    {value:'school_k10',label:'School (K-10)'},{value:'school_k12',label:'School (K-12)'},
    {value:'govt_school',label:'Government School'},{value:'govt_aided_school',label:'Govt-Aided School'},
    {value:'junior_college',label:'Junior College'},{value:'degree_college',label:'Degree College'},
    {value:'engineering',label:'Engineering College'},{value:'coaching',label:'Coaching Centre'},
    {value:'anganwadi',label:'Anganwadi'},{value:'vocational',label:'Vocational'},
  ];

  const TOGGLES: {key:string;label:string;desc:string}[] = [
    {key:'fee_module_enabled',label:'Fee Module',desc:'Disable for government institutions with no fee collection'},
    {key:'meal_tracking_enabled',label:'Mid-Day Meal Tracking',desc:'Track daily meal distribution for government schemes'},
    {key:'scholarship_tracking_enabled',label:'Scholarship Tracking',desc:'NSP, state, PM POSHAN and custom scholarships'},
    {key:'rte_mode_enabled',label:'RTE Mode (Phase 4B)',desc:'Right to Education admission workflow — full features in next batch'},
    {key:'online_payment_enabled',label:'Online Payments',desc:'Razorpay fee collection (disable for govt schools)'},
  ];

  if (!config) return null;

  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 16 }}>🏫 Institution Configuration</div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', marginBottom: 5 }}>INSTITUTION TYPE</div>
        <select value={config.institution_type} onChange={e => setConfig(c => c ? {...c, institution_type: e.target.value} : c)}
          style={{ padding: '6px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 12, width: '100%', maxWidth: 280 }}>
          {INSTITUTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', marginBottom: 10 }}>FEATURE TOGGLES</div>
        {TOGGLES.map(t => (
          <div key={t.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '9px 0', borderBottom: '1px solid #F9FAFB' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{t.label}</div>
              <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>{t.desc}</div>
            </div>
            <label style={{ position: 'relative', display: 'inline-block', width: 36, height: 20, flexShrink: 0, marginTop: 1 }}>
              <input type="checkbox" checked={!!(config.feature_flags?.[t.key])}
                onChange={e => setConfig(c => c ? {...c, feature_flags: {...c.feature_flags, [t.key]: e.target.checked}} : c)}
                style={{ opacity: 0, width: 0, height: 0 }} />
              <span style={{ position: 'absolute', inset: 0, background: !!(config.feature_flags?.[t.key]) ? '#4F46E5' : '#D1D5DB', borderRadius: 20, cursor: 'pointer', transition: 'background 0.2s' }}>
                <span style={{ position: 'absolute', left: !!(config.feature_flags?.[t.key]) ? 18 : 2, top: 2, width: 16, height: 16, background: '#fff', borderRadius: '50%', transition: 'left 0.2s' }} />
              </span>
            </label>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button onClick={() => void save()} disabled={saving}
          style={{ padding: '7px 18px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Saving...' : 'Save Institution Settings'}
        </button>
        {saveMsg && <span style={{ fontSize: 11, color: saveMsg.startsWith('✓') ? '#065F46' : '#B91C1C' }}>{saveMsg}</span>}
      </div>
    </div>
  );
}

interface RazorpayStatus {
  key_id_configured: boolean;
  key_id_preview: string | null;
  key_secret_configured: boolean;
  online_payment_enabled: boolean;
  payment_provider: string | null;
  fee_module_enabled: boolean;
}

export default function AdminSettingsPage() {
  const [status, setStatus] = useState<RazorpayStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Form state
  const [keyId, setKeyId] = useState('');
  const [keySecret, setKeySecret] = useState('');
  const [onlineEnabled, setOnlineEnabled] = useState(false);

  useEffect(() => { void loadStatus(); }, []);

  async function loadStatus() {
    setLoading(true);
    const res = await fetch('/api/admin/settings/razorpay');
    if (res.ok) {
      const d: RazorpayStatus = await res.json();
      setStatus(d);
      setOnlineEnabled(d.online_payment_enabled);
    }
    setLoading(false);
  }

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3500);
  }

  async function saveConfig() {
    if (onlineEnabled && (!keyId.trim() || !keySecret.trim())) {
      showToast('Both Key ID and Key Secret required when enabling online payments', false);
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = { online_payment_enabled: onlineEnabled };
      if (keyId.trim()) body.razorpay_key_id = keyId.trim();
      if (keySecret.trim()) body.razorpay_key_secret = keySecret.trim();

      const res = await fetch('/api/admin/settings/razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (res.ok) {
        showToast('Payment configuration saved.');
        setKeyId(''); setKeySecret('');
        void loadStatus();
      } else {
        showToast(d.error ?? 'Save failed', false);
      }
    } finally { setSaving(false); }
  }

  const cardStyle = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 20, marginBottom: 16 };
  const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: 13, boxSizing: 'border-box' as const };
  const labelStyle = { fontSize: 11, fontWeight: 600 as const, color: '#6B7280', marginBottom: 4, display: 'block' as const };

  return (
    <Layout title="Settings" subtitle="School configuration">

      {toast && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, padding: '10px 18px',
          background: toast.ok ? '#065F46' : '#991B1B', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
          {toast.msg}
        </div>
      )}

      {/* Payment Configuration */}
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Payment Configuration</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 20 }}>Configure Razorpay to enable online fee collection from parents.</div>

        {loading ? (
          <div style={{ color: '#6B7280', fontSize: 13 }}>Loading...</div>
        ) : (
          <>
            {/* Current status */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
              <div style={{ padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                background: status?.online_payment_enabled ? '#D1FAE5' : '#FEE2E2',
                color: status?.online_payment_enabled ? '#065F46' : '#991B1B' }}>
                {status?.online_payment_enabled ? '✓ Online payments enabled' : '✗ Online payments disabled'}
              </div>
              {status?.key_id_configured && (
                <div style={{ padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#EFF6FF', color: '#1E40AF' }}>
                  Key ID: {status.key_id_preview}
                </div>
              )}
              {status?.key_secret_configured && (
                <div style={{ padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#F3F4F6', color: '#6B7280' }}>
                  Secret: ••••••••
                </div>
              )}
            </div>

            {/* Online payments toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>Enable Online Payments</span>
              <button onClick={() => setOnlineEnabled(v => !v)}
                style={{ padding: '4px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  background: onlineEnabled ? '#065F46' : '#E5E7EB', color: onlineEnabled ? '#fff' : '#374151' }}>
                {onlineEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Key inputs — always shown so admin can update keys */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>Razorpay Key ID {status?.key_id_configured ? '(leave blank to keep existing)' : '*'}</label>
                <input style={inputStyle} value={keyId} onChange={e => setKeyId(e.target.value)}
                  placeholder={status?.key_id_configured ? `Current: ${status.key_id_preview}` : 'rzp_live_…'} />
              </div>
              <div>
                <label style={labelStyle}>Razorpay Key Secret {status?.key_secret_configured ? '(leave blank to keep existing)' : '*'}</label>
                <input type="password" style={inputStyle} value={keySecret} onChange={e => setKeySecret(e.target.value)}
                  placeholder={status?.key_secret_configured ? '••••••••••••••••' : 'Your Razorpay key secret'} />
              </div>
            </div>

            {onlineEnabled && !keyId.trim() && !status?.key_id_configured && (
              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 7, padding: '8px 12px', fontSize: 12, color: '#92400E', marginBottom: 12 }}>
                ⚠️ Key ID and Key Secret required to enable online payments.
              </div>
            )}

            <button onClick={() => void saveConfig()} disabled={saving}
              style={{ padding: '10px 24px', background: saving ? '#9CA3AF' : '#4F46E5',
                color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {saving ? 'Saving…' : 'Save Configuration'}
            </button>
          </>
        )}
      </div>

      {/* Placeholder for future settings sections */}
      <div style={{ ...cardStyle, opacity: 0.5 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#9CA3AF' }}>School Profile</div>
        <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>Edit school name, address, board and contact details. (Coming soon)</div>
      </div>

      {/* Batch 4A: Institution Configuration */}
      <InstitutionConfig />

    </Layout>
  );
}
