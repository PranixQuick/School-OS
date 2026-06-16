'use client';

import { useState, useEffect, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { T } from '@/lib/i18n';
import { useLang } from '@/lib/useLang';
import type { Lang } from '@/lib/i18n';

// ─── Email sanitization ────────────────────────────────────────────────────────
// Strips ALL whitespace (mid-string spaces from Samsung keyboard, Gboard autocorrect,
// Telugu IME, mobile autofill injecting spaces around '@').
function sanitizeEmail(raw: string): string {
  return raw
    .replace(/\s+/g, '')       // strip ALL whitespace including mid-string spaces
    .toLowerCase()
    .trim();
}

function QueryReader({
  setEmail, setShowMagicLink,
}: {
  setEmail: (v: string) => void;
  setShowMagicLink: (v: boolean) => void;
}) {
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get('magic') === '1') setShowMagicLink(true);
    const emailParam = searchParams.get('email');
    if (emailParam) setEmail(sanitizeEmail(decodeURIComponent(emailParam)));
  }, [searchParams, setEmail, setShowMagicLink]);
  return null;
}

const LANG_SHORT: Partial<Record<Lang, string>> = {
  en: 'EN', hi: 'हि', te: 'తె', ta: 'த', kn: 'ಕ', mr: 'म', ml: 'മ',
};
const LANG_ORDER: Lang[] = ['te', 'en', 'hi', 'ta', 'kn', 'mr', 'ml'];

export default function LoginPage() {
  const router = useRouter();
  const { lang, setLang } = useLang();
  const [email, setEmailRaw] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkError, setMagicLinkError] = useState('');
  const [emailWarning, setEmailWarning] = useState('');

  // Always sanitize on the way in — catches paste, autofill, keyboard injection
  function setEmail(v: string) {
    const sanitized = sanitizeEmail(v);
    setEmailRaw(sanitized);
    // Warn user if we stripped characters (so they know what happened)
    if (v !== sanitized && v.replace(/\s+/g,'').toLowerCase() === sanitized) {
      setEmailWarning('Spaces removed from email address.');
      setTimeout(() => setEmailWarning(''), 3000);
    } else {
      setEmailWarning('');
    }
  }

  async function handleLogin(e: FormEvent) { e.preventDefault(); }
  async function handleMagicLink() {}

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4FF', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <style>{`*{box-sizing:border-box}
        .lang-btn{border:none;padding:5px 10px;border-radius:6px;font-size:12px;cursor:pointer;font-weight:600;font-family:inherit;background:rgba(255,255,255,0.2);color:#fff}
        .lang-btn.active{background:rgba(255,255,255,0.9);color:#4338CA}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      {/* header removed for reading */}

      <div style={{ padding: '20px 20px 40px', maxWidth: 420, margin: '0 auto' }}>
        <Suspense fallback={null}>
          <QueryReader setEmail={setEmail} setShowMagicLink={setShowMagicLink} />
        </Suspense>

        {/* Quick-access buttons */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <a href="/parent/login" style={{ flex: 1, textAlign: 'center', padding: '12px 8px', background: '#EEF2FF', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#4338CA', textDecoration: 'none', border: '1px solid #C7D2FE' }}>
            🏠 {T('parents', lang as never)}
          </a>
          <a href="/student/login" style={{ flex: 1, textAlign: 'center', padding: '12px 8px', background: '#F0FDF4', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#16A34A', textDecoration: 'none', border: '1px solid #BBF7D0' }}>
            🎓 {T('student_management', lang as never)}
          </a>
        </div>

        {/* Main card */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB', padding: '24px 22px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>

          {!showMagicLink ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
                {T('staff_management', lang as never)} / School Login
              </div>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 20 }}>
                For school owner, admin, principal, teacher accounts
              </div>

              {/* Setup guidance — shown when no auth accounts provisioned */}
              <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 9, padding: '10px 12px', marginBottom: 16, fontSize: 12, color: '#92400E', lineHeight: 1.5 }}>
                <strong>First time?</strong> Check your email for a setup invitation from School OS. Click &quot;Set Password&quot; in that email before logging in here.
                <br />Can&apos;t find it? Use <button type="button" onClick={() => setShowMagicLink(true)} style={{ background: 'none', border: 'none', color: '#4F46E5', cursor: 'pointer', fontWeight: 700, fontSize: 12, padding: 0, fontFamily: 'inherit' }}>Sign in with email link</button> below.
              </div>

              {error && (
                <div role="alert" data-testid="login-error" style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#991B1B', marginBottom: 16 }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin} noValidate>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, letterSpacing: '0.04em' }}>
                    EMAIL ADDRESS
                  </label>
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onPaste={e => {
                      e.preventDefault();
                      const pasted = e.clipboardData.getData('text');
                      setEmail(pasted);
                    }}
                    disabled={loading}
                    style={{ width: '100%', height: 46, borderRadius: 9, border: `1px solid ${emailWarning ? '#FCD34D' : '#D1D5DB'}`, background: loading ? '#F3F4F6' : '#F9FAFB', fontSize: 14, padding: '0 14px', outline: 'none', fontFamily: 'monospace', color: '#111827' }}
                    placeholder="admin@yourschool.edu.in"
                  />
                  {emailWarning && (
                    <div style={{ fontSize: 11, color: '#D97706', marginTop: 3 }}>ℹ {emailWarning}</div>
                  )}
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>
                    Type carefully — no spaces allowed in email
                  </div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, letterSpacing: '0.04em' }}>
                    PASSWORD
                  </label>
                  <input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    disabled={loading}
                    style={{ width: '100%', height: 46, borderRadius: 9, border: '1px solid #D1D5DB', background: loading ? '#F3F4F6' : '#F9FAFB', fontSize: 14, padding: '0 14px', outline: 'none', fontFamily: 'inherit', color: '#111827' }}
                    placeholder="Enter your password"
                  />
                </div>
                <div style={{ textAlign: 'right', marginBottom: 20 }}>
                  <button type="button" onClick={() => setShowMagicLink(true)}
                    style={{ background: 'none', border: 'none', color: '#4F46E5', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: 0, fontWeight: 600 }}>
                    Forgot password? Sign in with email link
                  </button>
                </div>
                <button type="submit" disabled={loading}
                  style={{ width: '100%', height: 48, borderRadius: 10, border: 'none', background: loading ? '#818CF8' : 'linear-gradient(135deg, #4F46E5 0%, #0EA5E9 100%)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {loading ? (
                    <>
                      <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                      Signing in...
                    </>
                  ) : 'Sign In →'}
                </button>
              </form>
            </>
          ) : (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Sign in with email link</div>
              <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 20, lineHeight: 1.6 }}>
                Enter your email and we&apos;ll send you a secure one-click sign-in link.
              </div>
              {!magicLinkSent ? (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, letterSpacing: '0.04em' }}>EMAIL ADDRESS</label>
                    <input
                      type="email" inputMode="email" autoCorrect="off" autoCapitalize="none" spellCheck={false}
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onPaste={e => { e.preventDefault(); setEmail(e.clipboardData.getData('text')); }}
                      style={{ width: '100%', height: 46, borderRadius: 9, border: '1px solid #D1D5DB', background: '#F9FAFB', fontSize: 14, padding: '0 14px', outline: 'none', fontFamily: 'monospace', color: '#111827' }}
                      placeholder="admin@yourschool.edu.in"
                    />
                  </div>
                  {magicLinkError && (
                    <div role="alert" data-testid="magic-link-error" style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#991B1B', marginBottom: 14 }}>{magicLinkError}</div>
                  )}
                  <button type="button" onClick={() => void handleMagicLink()} disabled={magicLinkLoading}
                    style={{ width: '100%', height: 46, borderRadius: 10, border: 'none', background: magicLinkLoading ? '#818CF8' : '#4F46E5', color: '#fff', fontSize: 15, fontWeight: 600, cursor: magicLinkLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
                    {magicLinkLoading ? 'Sending...' : '📧 Send sign-in link'}
                  </button>
                  <button type="button" onClick={() => { setShowMagicLink(false); setMagicLinkError(''); }}
                    style={{ width: '100%', background: 'none', border: 'none', color: '#6B7280', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: '6px 0' }}>
                    ← Back to password sign-in
                  </button>
                </>
              ) : (
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '20px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📧</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#166534', marginBottom: 6 }}>Check your inbox</div>
                  <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                    We sent a sign-in link to <strong>{email}</strong>.
                    <br />Didn&apos;t get it? Check spam or try again.
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#6B7280' }}>
          New school?{' '}
          <a href="/register" style={{ color: '#4F46E5', fontWeight: 600, textDecoration: 'none' }}>Create account →</a>
        </div>
      </div>
    </div>
  );
}
