'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { T, LANG_LABELS, type Lang } from '@/lib/i18n';
import { useLang } from '@/lib/useLang';

interface StudentInfo { name: string; class: string; section: string; roll_number: string | null; admission_number: string | null; }
interface Attendance { present_pct: number; total_days: number; present_days: number; }
interface FeeInfo { pending_amount: number; overdue: boolean; }
interface Notice { id: string; subject: string; message: string; created_at: string; }

const ACTION_KEYS = [
  { href: '/parent/attendance', icon: '✅', key: 'attendance', bg: '#F0FDF4' },
  { href: '/parent/homework',   icon: '📚', key: 'homework',   bg: '#FDF4FF' },
  { href: '/parent/fees',       icon: '💳', key: 'fees',       bg: '#FFFBEB' },
  { href: '/parent/marks',      icon: '📊', key: 'reports',    bg: '#F0F9FF' },
  { href: '/parent/timetable',  icon: '🗓️', key: 'timetable',  bg: '#EEF2FF' },
  { href: '/parent/notices',    icon: '📢', key: 'announcements', bg: '#F9FAFB' },
  { href: '/parent/events',     icon: '📸', key: 'events',     bg: '#FDF4FF' },
];

// Compact language labels for the switcher strip
const LANG_SHORT: Partial<Record<Lang, string>> = {
  en: 'EN', hi: 'हि', te: 'తె', ta: 'த', kn: 'ಕ', mr: 'म', ml: 'മ',
};
const LANG_ORDER: Lang[] = ['te', 'en', 'hi', 'ta', 'kn', 'mr', 'ml'];

export default function ParentHomePage() {
  const { lang, setLang } = useLang();
  const router = useRouter();
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [fee, setFee] = useState<FeeInfo | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [schoolName, setSchoolName] = useState('');

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
        .lang-btn{background:rgba(255,255,255,0.15);border:none;color:#fff;padding:4px 9px;border-radius:6px;font-size:13px;cursor:pointer;font-weight:600;font-family:inherit}
        .lang-btn.active{background:rgba(255,255,255,0.9);color:#4F46E5}
      `}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', padding: '16px 16px 24px' }}>
        {/* Top row: school name + sign out */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
            {loading ? '…' : schoolName}
          </div>
          <button onClick={handleLogout}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
            {T('sign_out', lang)}
          </button>
        </div>

        {/* Language selector strip — visible to ALL parent portal visitors */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {LANG_ORDER.map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`lang-btn${lang === l ? ' active' : ''}`}
              title={LANG_LABELS[l]}
              aria-label={LANG_LABELS[l]}
            >
              {LANG_SHORT[l]}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>
          {T('parents', lang)}
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
              <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 14 }}>
                {T('class_', lang)} {student.class}-{student.section}
                {student.roll_number ? ` · Roll ${student.roll_number}` : ''}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: '#F9FAFB', borderRadius: 12, padding: '14px', borderLeft: `3px solid ${attColor}` }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: attColor }}>{Math.round(att)}%</div>
                  <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>{T('attendance', lang)}</div>
                  {att < 75 && <div style={{ fontSize: 12, color: '#B91C1C', marginTop: 4, fontWeight: 600 }}>⚠ {T('overdue', lang)}</div>}
                </div>
                <div style={{ background: feeAlert ? '#FEF2F2' : '#F0FDF4', borderRadius: 12, padding: '14px', borderLeft: `3px solid ${feeAlert ? '#B91C1C' : '#16A34A'}` }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: feeAlert ? '#B91C1C' : '#16A34A' }}>
                    {feeAlert ? `₹${fee!.pending_amount >= 1000 ? (fee!.pending_amount / 1000).toFixed(1) + 'K' : fee!.pending_amount}` : '✓'}
                  </div>
                  <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>
                    {feeAlert ? T('fees', lang) : T('paid', lang)}
                  </div>
                  {fee?.overdue && <div style={{ fontSize: 12, color: '#B91C1C', marginTop: 4, fontWeight: 600 }}>{T('overdue', lang)}</div>}
                </div>
              </div>
            </>
          ) : (
            <div style={{ color: '#6B7280', fontSize: 14 }}>{T('no_records', lang)}</div>
          )}
        </div>

        {/* Fee urgency CTA */}
        {!loading && feeAlert && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '14px 16px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#B91C1C' }}>⚠️ {T('fees', lang)} {T('pending', lang)}</div>
              <div style={{ fontSize: 13, color: '#B91C1C', marginTop: 2 }}>
                ₹{fee!.pending_amount} {T('outstanding', lang)}{fee!.overdue ? ' — ' + T('overdue', lang) : ''}
              </div>
            </div>
            <Link href="/parent/fees" style={{ padding: '9px 16px', background: '#B91C1C', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
              →
            </Link>
          </div>
        )}

        {/* Quick actions */}
        <div style={{ fontSize: 13, fontWeight: 700, color: '#6B7280', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>
          {T('actions', lang)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 8 }}>
          {ACTION_KEYS.slice(0, 4).map(a => (
            <Link key={a.href} href={a.href} className="p-action">
              <div style={{ width: 40, height: 40, borderRadius: 10, background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, margin: '0 auto 8px' }}>{a.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{T(a.key, lang)}</div>
            </Link>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 22 }}>
          {ACTION_KEYS.slice(4).map(a => (
            <Link key={a.href} href={a.href} className="p-action">
              <div style={{ width: 40, height: 40, borderRadius: 10, background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, margin: '0 auto 8px' }}>{a.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{T(a.key, lang)}</div>
            </Link>
          ))}
        </div>

        {/* Notices */}
        <div style={{ fontSize: 13, fontWeight: 700, color: '#6B7280', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>
          {T('announcements', lang)}
        </div>
        {loading ? (
          <><div className="skel" style={{ height: 70, marginBottom: 8, borderRadius: 12 }} /><div className="skel" style={{ height: 70, borderRadius: 12 }} /></>
        ) : notices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: '#9CA3AF', fontSize: 14 }}>{T('no_records', lang)}</div>
        ) : notices.slice(0, 5).map(n => (
          <div key={n.id} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', marginBottom: 8, borderLeft: '3px solid #4F46E5' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 5 }}>{n.subject}</div>
            <div style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.5 }}>
              {n.message.slice(0, 140)}{n.message.length > 140 ? '…' : ''}
            </div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 6 }}>
              {new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
