'use client';
// PATH: app/parent/consent/page.tsx
// Item #3 DPDP Compliance — PR #2
// Parent consent management: four toggles, append-only record, permanent audit trail.
// Auth: phone+PIN passed in query params (same as all other parent pages).

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

interface ConsentEntry {
  consent_type: string;
  status: 'granted' | 'withdrawn' | null;
  updated_at: string | null;
}

const CONSENT_CONFIG: { type: string; label: string; description: string; withdrawable: boolean }[] = [
  {
    type: 'data_processing',
    label: 'Data Processing',
    description: 'Required for school operations (attendance, fees, progress). Cannot be withdrawn.',
    withdrawable: false,
  },
  {
    type: 'whatsapp_communication',
    label: 'WhatsApp Notifications',
    description: 'Receive updates about attendance, fees, and announcements via WhatsApp.',
    withdrawable: true,
  },
  {
    type: 'data_retention',
    label: 'Data Retention',
    description: 'Required to maintain academic records as per regulatory requirements. Cannot be withdrawn.',
    withdrawable: false,
  },
  {
    type: 'third_party_sharing',
    label: 'Third Party Sharing',
    description: 'Allows sharing anonymized data with approved educational partners for analytics.',
    withdrawable: true,
  },
];

export default function ParentConsentPage() {
  const searchParams = useSearchParams();
  const phone = searchParams.get('phone') ?? '';
  const pin   = searchParams.get('pin')   ?? '';

  const [consents, setConsents] = useState<Record<string, ConsentEntry>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!phone || !pin) { setLoading(false); return; }
    void load();
  }, [phone, pin]);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/parent/consent?phone=${encodeURIComponent(phone)}&pin=${encodeURIComponent(pin)}`);
    if (res.ok) {
      const d = await res.json();
      const map: Record<string, ConsentEntry> = {};
      for (const c of (d.consents ?? [])) {
        map[c.consent_type] = {
          consent_type: c.consent_type,
          status: c.status,
          updated_at: c.withdrawn_at ?? c.granted_at ?? c.created_at ?? null,
        };
      }
      setConsents(map);
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Failed to load consent status');
    }
    setLoading(false);
  }

  async function toggleConsent(type: string, currentStatus: string | null) {
    const newStatus = currentStatus === 'granted' ? 'withdrawn' : 'granted';
    setSaving(type);
    try {
      const res = await fetch('/api/parent/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone, pin,
          consents: [{ consent_type: type, status: newStatus }],
        }),
      });
      const d = await res.json();
      if (res.ok && d.recorded > 0) {
        setConsents(prev => ({
          ...prev,
          [type]: { consent_type: type, status: newStatus as 'granted' | 'withdrawn', updated_at: new Date().toISOString() },
        }));
        setToast(newStatus === 'granted' ? 'Consent granted' : 'Consent withdrawn');
        setTimeout(() => setToast(null), 2500);
      } else {
        setError(d.errors?.[0] ?? d.error ?? 'Failed to update');
      }
    } finally { setSaving(null); }
  }

  if (!phone || !pin) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#991B1B', fontSize: 13 }}>
        Session expired. Please log in again.
      </div>
    );
  }

  const cardStyle = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 16, marginBottom: 12 };

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', padding: '20px 16px' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        {toast && (
          <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, padding: '8px 16px',
            background: '#065F46', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
            {toast}
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4F46E5', letterSpacing: 1, marginBottom: 4 }}>DPDP COMPLIANCE</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>Data & Privacy Settings</div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 6 }}>Your consent history is kept as a permanent record.</div>
        </div>

        {error && <div style={{ ...cardStyle, background: '#FEF2F2', borderColor: '#FCA5A5', color: '#991B1B', fontSize: 12 }}>{error}</div>}

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6B7280', fontSize: 13 }}>Loading...</div>
        ) : (
          CONSENT_CONFIG.map(cfg => {
            const current = consents[cfg.type];
            const isGranted = current?.status === 'granted';
            const isSaving = saving === cfg.type;

            return (
              <div key={cfg.type} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{cfg.label}</span>
                      {!cfg.withdrawable && (
                        <span style={{ fontSize: 9, background: '#F3F4F6', color: '#6B7280', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>REQUIRED</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>{cfg.description}</div>
                    {current?.updated_at && (
                      <div style={{ fontSize: 10, color: current.status === 'granted' ? '#065F46' : '#9CA3AF', marginTop: 6 }}>
                        {current.status === 'granted' ? '✓ Granted' : '✗ Withdrawn'} — {new Date(current.updated_at).toLocaleDateString('en-IN')}
                      </div>
                    )}
                    {!current && (
                      <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 6 }}>Not yet recorded</div>
                    )}
                  </div>

                  {cfg.withdrawable ? (
                    <button
                      onClick={() => void toggleConsent(cfg.type, current?.status ?? null)}
                      disabled={isSaving}
                      style={{
                        flexShrink: 0,
                        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: isSaving ? 'wait' : 'pointer',
                        background: isGranted ? '#065F46' : '#D1D5DB',
                        position: 'relative', transition: 'background 0.2s',
                        opacity: isSaving ? 0.6 : 1,
                      }}>
                      <span style={{
                        position: 'absolute', top: 3, left: isGranted ? 23 : 3,
                        width: 18, height: 18, borderRadius: '50%', background: '#fff',
                        transition: 'left 0.15s',
                      }} />
                    </button>
                  ) : (
                    <div style={{ flexShrink: 0, fontSize: 18 }} title="Required — cannot be withdrawn">🔒</div>
                  )}
                </div>
              </div>
            );
          })
        )}

        <div style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 8, lineHeight: 1.6 }}>
          As per the Digital Personal Data Protection Act (DPDP) 2023,<br />
          your consent preferences are recorded and cannot be retroactively deleted.
        </div>
      </div>
    </div>
  );
}
