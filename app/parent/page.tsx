'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { T } from '@/lib/i18n';
import { useLang } from '@/lib/useLang';

interface StudentInfo { name: string; class: string; section: string; roll_number: string | null; admission_number: string | null; }
interface Attendance { present_pct: number; total_days: number; present_days: number; }
interface FeeInfo { pending_amount: number; overdue: boolean; }
interface Notice { id: string; subject: string; message: string; created_at: string; }

// Quick actions — labels come from i18n-parent T() after hydration
const ACTION_KEYS = [
  { href: '/parent/attendance', icon: '✅', key: 'attendance', color: '#16A34A', bg: '#F0FDF4' },
  { href: '/parent/homework',   icon: '📚', key: 'homework',   color: '#9333EA', bg: '#FDF4FF' },
  { href: '/parent/fees',       icon: '💳', key: 'fees',       color: '#D97706', bg: '#FFFBEB' },
  { href: '/parent/marks',      icon: '📊', key: 'reports',    color: '#0284C7', bg: '#F0F9FF' },
  { href: '/parent/timetable',  icon: '🗓️', key: 'timetable',  color: '#4F46E5', bg: '#EEF2FF' },
  { href: '/parent/notices',    icon: '📢', key: 'announcements', color: '#374151', bg: '#F9FAFB' },
  { href: '/parent/events',     icon: '📸', key: 'events',     color: '#9333EA', bg: '#FDF4FF' },
];

export default function ParentHomePage() {
  const { lang } = useLang();
  const router = useRouter();
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [fee, setFee] = useState<FeeInfo | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [schoolName, setSchoolName] = useState('');
  // lang: read from window.__edprosys_lang (set by Layout language selector) or localStorage
  const [lang, setLang] = useState<Lang>('en');

  // Hydrate language safely after mount — no SSR mismatch
  useEffect(() => {
    try {
      const stored = localStorage.getItem('edprosys_lang') as Lang | null;
      if (stored && ['en','hi','te','ta','kn'].includes(stored)) setLang(stored);
    } catch { /* localStorage unavailable */ }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 6000);
    fetch('/api/parent/dashboard')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setStudent(d.student ?? null);
          setAttendance(d.attendance ?? null);
          setFee(d.fee ?? null);
          setNotices(d.notices ?? []);
          setSchoolName(d.school_name ?? '');
        }
      })
      .catch(() => {})
      .finally(() => { setLoading(false); clearTimeout(t); });
    return () => clearTimeout(t);
  }, []);

  const handleLogout = async () => {
    await fetch('/api/parent/logout', { method: 'POST' }).catch(() => {});
    router.push('/parent/login');
  };

  const att = attendance?.present_pct ?? 0;
  const attColor = att >= 90 ? '#16A34A' : att >= 75 ? '#D97706' : '#B91C1C';
  const feeAlert = fee && fee.pending_amount > 0;

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', paddingBottom: 40 }}>
      <style>{`
        *{box-sizing:border-box}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        .skel{background:#F3F4F6;border-radius:8px;animation:pulse 1.5s ease-in-out infinite}
        .p-action{display:block;background:#fff;border-radius:12px;padding:16px 10px;text-align:center;text-decoration:none;border:1px solid #F3F4F6;transition:transform 0.1s}
        .p-action:active{transform:scale(0.96)}
      `}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', padding: '20px 16px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{loading ? '…' : schoolName}</div>
          <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
            {lang === 'en' ? 'Sign Out' : lang === 'hi' ? 'साइन आउट' : lang === 'te' ? 'సైన్ అవుట్' : lang === 'ta' ? 'வெளியேறு' : 'ಸೈನ್ ಔಟ್'}
          </button>
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
          {lang === 'en' ? 'Parent Portal' : lang === 'hi' ? 'अभिभावक पोर्टल' : lang === 'te' ? 'తల్లిదండ్రుల పోర్టల్' : lang === 'ta' ? 'பெற்றோர் போர்டல்' : 'ಪಾಲಕ ಪೋರ್ಟಲ್'}
        </div>
      </div>

      <div style={{ padding: '0 16px', marginTop: -16 }}>
        {/* Student card */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 20, marginBottom: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
          {loading ? (
            <><div className="skel" style={{ height: 24, width: '60%', marginBottom: 8 }} /><div className="skel" style={{ height: 16, width: '40%' }} /></>
          ) : student ? (
            <>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 4 }}>{student.name}</div>
              <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 14 }}>
                {lang === 'en' ? 'Class' : lang === 'hi' ? 'कक्षा' : lang === 'te' ? 'తరగతి' : lang === 'ta' ? 'வகுப்பு' : 'ತರಗತಿ'} {student.class}-{student.section}{student.roll_number ? ` · Roll No. ${student.roll_number}` : ''}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: '#F9FAFB', borderRadius: 12, padding: '12px 14px', borderLeft: `3px solid ${attColor}` }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: attColor }}>{Math.round(att)}%</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{T('attendance', lang)}</div>
                  {att < 75 && <div style={{ fontSize: 10, color: '#B91C1C', marginTop: 4, fontWeight: 600 }}>
                    {lang === 'en' ? 'Below minimum' : lang === 'hi' ? 'न्यूनतम से कम' : 'Below minimum'}
                  </div>}
                </div>
                <div style={{ background: feeAlert ? '#FEF2F2' : '#F0FDF4', borderRadius: 12, padding: '12px 14px', borderLeft: `3px solid ${feeAlert ? '#B91C1C' : '#16A34A'}` }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: feeAlert ? '#B91C1C' : '#16A34A' }}>
                    {feeAlert ? `₹${fee!.pending_amount >= 1000 ? (fee!.pending_amount / 1000).toFixed(1) + 'K' : fee!.pending_amount}` : '✓'}
                  </div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                    {feeAlert ? T('fees', lang) : (lang === 'en' ? 'Fees paid' : lang === 'hi' ? 'शुल्क भुगतान' : T('fees', lang))}
                  </div>
                  {fee?.overdue && <div style={{ fontSize: 10, color: '#B91C1C', marginTop: 4, fontWeight: 600 }}>OVERDUE</div>}
                </div>
              </div>
            </>
          ) : (
            <div style={{ color: '#6B7280', fontSize: 14 }}>No student linked to this account.</div>
          )}
        </div>

        {/* Fee urgency CTA */}
        {!loading && feeAlert && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '12px 16px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#B91C1C' }}>
                ⚠️ {lang === 'en' ? 'Fee payment pending' : lang === 'hi' ? 'शुल्क भुगतान बाकी' : lang === 'te' ? 'ఫీజు చెల్లింపు పెండింగ్' : 'Fee payment pending'}
              </div>
              <div style={{ fontSize: 12, color: '#B91C1C', marginTop: 2 }}>₹{fee!.pending_amount} outstanding{fee!.overdue ? ' — overdue' : ''}</div>
            </div>
            <Link href="/parent/fees" style={{ padding: '7px 14px', background: '#B91C1C', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>→</Link>
          </div>
        )}

        {/* Quick actions — translated labels */}
        <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
          {lang === 'en' ? 'Quick Actions' : lang === 'hi' ? 'त्वरित क्रियाएं' : lang === 'te' ? 'త్వరిత చర్యలు' : lang === 'ta' ? 'விரைவு செயல்கள்' : 'ತ್ವರಿತ ಕ್ರಮಗಳು'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 20 }}>
          {ACTION_KEYS.slice(0, 4).map(a => (
            <Link key={a.href} href={a.href} className="p-action">
              <div style={{ width: 36, height: 36, borderRadius: 10, background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, margin: '0 auto 6px' }}>{a.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>{L(a.key, lang)}</div>
            </Link>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
          {ACTION_KEYS.slice(4).map(a => (
            <Link key={a.href} href={a.href} className="p-action">
              <div style={{ width: 36, height: 36, borderRadius: 10, background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, margin: '0 auto 6px' }}>{a.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>{L(a.key, lang)}</div>
            </Link>
          ))}
        </div>

        {/* School notices */}
        <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
          {T('announcements', lang)}
        </div>
        {loading ? (
          <><div className="skel" style={{ height: 64, marginBottom: 8, borderRadius: 12 }} /><div className="skel" style={{ height: 64, borderRadius: 12 }} /></>
        ) : notices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: '#9CA3AF', fontSize: 13 }}>
            {lang === 'en' ? 'No notices from school.' : lang === 'hi' ? 'स्कूल से कोई सूचना नहीं।' : 'No notices from school.'}
          </div>
        ) : notices.slice(0, 5).map(n => (
          <div key={n.id} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', marginBottom: 8, borderLeft: '3px solid #4F46E5' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{n.subject}</div>
            <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.4 }}>{n.message.slice(0, 120)}{n.message.length > 120 ? '…' : ''}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>{new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
