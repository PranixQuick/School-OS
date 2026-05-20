'use client';
// app/parent/register/page.tsx
// Parent self-registration flow.
// Step 1: Enter mobile number
// Step 2: Enter OTP sent via WhatsApp/SMS
// Step 3: System matches student by phone_parent → creates parent record
// Step 4: Language selection
// Step 5: Redirect to /parent
//
// Uses existing auth system (phone + PIN).
// POSTs to /api/parent/register (new route to be created alongside this).
// Elder-parent friendly: large inputs, big buttons, minimal steps.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { T, LANG_LABELS, type Lang } from '@/lib/i18n';
import { useLang } from '@/lib/useLang';

type Step = 'phone' | 'otp' | 'lang' | 'done';

const LANG_OPTIONS: { lang: Lang; icon: string; native: string }[] = [
  { lang: 'te', icon: '🇮🇳', native: 'తెలుగు' },
  { lang: 'en', icon: '🇬🇧', native: 'English' },
  { lang: 'hi', icon: '🇮🇳', native: 'हिन्दी' },
  { lang: 'ta', icon: '🇮🇳', native: 'தமிழ்' },
  { lang: 'kn', icon: '🇮🇳', native: 'ಕನ್ನಡ' },
  { lang: 'mr', icon: '🇮🇳', native: 'मराठी' },
  { lang: 'ml', icon: '🇮🇳', native: 'മലയാളം' },
];

export default function ParentRegisterPage() {
  const { lang, setLang } = useLang();
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [studentName, setStudentName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionToken, setSessionToken] = useState('');

  const inp = {
    width: '100%', padding: '16px 14px', border: '1.5px solid #D1D5DB',
    borderRadius: 12, fontSize: 18, outline: 'none',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    boxSizing: 'border-box' as const, background: '#FAFAFA',
  };
  const btn = (primary: boolean) => ({
    width: '100%', padding: '16px', border: 'none',
    borderRadius: 12, fontSize: 16, fontWeight: 800 as const, cursor: loading ? 'not-allowed' : 'pointer' as const,
    background: loading ? '#9CA3AF' : primary ? '#4F46E5' : '#F3F4F6',
    color: primary ? '#fff' : '#374151',
    fontFamily: 'inherit',
  });

  async function sendOTP() {
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10) {
      setError(T('required', lang as never)); return;
    }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/parent/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const d = await res.json() as { error?: string; student_name?: string };
      if (!res.ok) { setError(d.error ?? T('error', lang as never)); return; }
      if (d.student_name) setStudentName(d.student_name);
      setStep('otp');
    } catch { setError(T('error', lang as never)); }
    setLoading(false);
  }

  async function verifyOTP() {
    if (otp.length < 4) { setError(T('required', lang as never)); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/parent/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), otp: otp.trim() }),
      });
      const d = await res.json() as { error?: string; token?: string; student_name?: string };
      if (!res.ok) { setError(d.error ?? T('error', lang as never)); return; }
      if (d.student_name) setStudentName(d.student_name);
      if (d.token) setSessionToken(d.token);
      setStep('lang');
    } catch { setError(T('error', lang as never)); }
    setLoading(false);
  }

  function selectLang(l: Lang) {
    setLang(l);
    // Short delay then redirect — gives the user a moment to see the language selected
    setStep('done');
    setTimeout(() => router.push('/parent'), 600);
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px 40px' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Brand header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, background: '#EEF2FF', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 12px' }}>🏫</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#111827' }}>{T('parents', lang as never)}</div>
          <div style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>EdProSys</div>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 28 }}>
          {(['phone', 'otp', 'lang'] as Step[]).map((s, i) => (
            <div key={s} style={{ width: step === s ? 24 : 8, height: 8, borderRadius: 4, background: step === s || ['otp','lang','done'].indexOf(step) > ['phone','otp','lang'].indexOf(s) ? '#4F46E5' : '#E5E7EB', transition: 'width 0.3s' }} />
          ))}
        </div>

        <div style={{ background: '#fff', borderRadius: 20, padding: 28, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>

          {/* Step 1: Phone */}
          {step === 'phone' && (
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 6 }}>
                📱 {T('phone', lang as never)}
              </div>
              <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 20, lineHeight: 1.5 }}>
                {T('parent_phone', lang as never)}
              </div>
              <input
                type="tel" inputMode="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                autoComplete="tel"
                style={{ ...inp, marginBottom: 16 }}
                onKeyDown={e => { if (e.key === 'Enter') void sendOTP(); }}
              />
              {error && <div style={{ marginBottom: 14, padding: '10px 14px', background: '#FEF2F2', borderRadius: 9, fontSize: 14, color: '#B91C1C' }}>{error}</div>}
              <button onClick={() => void sendOTP()} disabled={loading} style={btn(true)}>
                {loading ? T('loading', lang as never) : T('send', lang as never) + ' OTP →'}
              </button>
              <div style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: '#9CA3AF' }}>
                {T('parent_name_label', lang as never)}?
                <a href="/parent/login" style={{ color: '#4F46E5', textDecoration: 'none', marginLeft: 4, fontWeight: 600 }}>
                  {T('sign_out', lang as never)}
                </a>
              </div>
            </div>
          )}

          {/* Step 2: OTP */}
          {step === 'otp' && (
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 6 }}>
                🔐 OTP
              </div>
              <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 8, lineHeight: 1.5 }}>
                WhatsApp: <strong>{phone}</strong>
              </div>
              {studentName && (
                <div style={{ padding: '10px 14px', background: '#F0FDF4', border: '1px solid #D1FAE5', borderRadius: 10, fontSize: 14, color: '#15803D', fontWeight: 600, marginBottom: 14 }}>
                  ✓ {T('student_name', lang as never)}: {studentName}
                </div>
              )}
              <input
                type="number" inputMode="numeric"
                value={otp}
                onChange={e => setOtp(e.target.value.slice(0, 6))}
                placeholder="000000"
                style={{ ...inp, letterSpacing: '0.3em', textAlign: 'center', marginBottom: 16 }}
                onKeyDown={e => { if (e.key === 'Enter') void verifyOTP(); }}
              />
              {error && <div style={{ marginBottom: 14, padding: '10px 14px', background: '#FEF2F2', borderRadius: 9, fontSize: 14, color: '#B91C1C' }}>{error}</div>}
              <button onClick={() => void verifyOTP()} disabled={loading} style={btn(true)}>
                {loading ? T('loading', lang as never) : T('confirm', lang as never) + ' →'}
              </button>
              <button onClick={() => setStep('phone')} style={{ ...btn(false), marginTop: 10 }}>
                ← {T('back', lang as never)}
              </button>
            </div>
          )}

          {/* Step 3: Language */}
          {step === 'lang' && (
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 6 }}>
                🌐 {T('change_language', lang as never)}
              </div>
              <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 20 }}>
                {T('language', lang as never)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {LANG_OPTIONS.map(l => (
                  <button key={l.lang} onClick={() => selectLang(l.lang)}
                    style={{ padding: '16px 18px', border: `2px solid ${lang === l.lang ? '#4F46E5' : '#E5E7EB'}`, borderRadius: 12, background: lang === l.lang ? '#EEF2FF' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, fontSize: 16, fontWeight: 700, color: '#111827', fontFamily: 'inherit' }}>
                    <span style={{ fontSize: 22 }}>{l.icon}</span>
                    <span>{l.native}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 13, color: '#9CA3AF' }}>{LANG_LABELS[l.lang]}</span>
                    {lang === l.lang && <span style={{ color: '#4F46E5' }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Done */}
          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>{T('saved_success', lang as never)}</div>
              <div style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>{T('loading', lang as never)}…</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
