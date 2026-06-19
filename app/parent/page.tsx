'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { T, LANG_LABELS, type Lang } from '@/lib/i18n';
import { useLang } from '@/lib/useLang';

interface StudentInfo { name: string; class: string; section: string; roll_number: string | null; admission_number: string | null; }
interface Attendance { present_pct: number; total_days: number; present_days: number; }
interface FeeInfo { pending_amount: number; overdue: boolean; }
interface Notice { id: string; subject?: string; message: string; created_at: string; }
interface ChildSummary { id: string; name: string; class: string; section: string; school_id: string; is_primary: boolean; }
interface DashData {
  student: StudentInfo;
  attendance: Attendance;
  fee: FeeInfo;
  notices: Notice[];
  school_name: string;
  children?: ChildSummary[];
  active_child_id?: string;
}

const ACTION_KEYS: { href: string; icon: string; key: string; bg: string; label?: string }[] = [
  { href: '/parent/attendance', icon: '✅', key: 'attendance', bg: '#F0FDF4' },
  { href: '/parent/homework',   icon: '📚', key: 'homework',   bg: '#FDF4FF' },
  { href: '/parent/fees',       icon: '💳', key: 'fees',       bg: '#FFFBEB' },
  { href: '/parent/marks',       icon: '📊', key: 'marks',       bg: '#F0F9FF' },
  { href: '/parent/report-cards', icon: '📄', key: 'report_cards', bg: '#F0FDF4' },
  { href: '/parent/timetable',  icon: '🗓️', key: 'timetable',  bg: '#EEF2FF' },
  { href: '/parent/notices',    icon: '📢', key: 'announcements', bg: '#F9FAFB' },
  { href: '/parent/events',     icon: '📸', key: 'events',     bg: '#FDF4FF' },
  { href: '/parent/complaints', icon: '📣', key: 'complaints', bg: '#FEF2F2' },
  { href: '/parent/curriculum', icon: '📖', key: 'syllabus', bg: '#EEF2FF', label: 'Syllabus' },
  { href: '/parent/vendors', icon: '🏪', key: 'vendors', bg: '#F0FDF4', label: 'Suppliers' },
  { href: '/parent/health', icon: '🏥', key: 'health', bg: '#FEF2F2', label: 'Health' },
  { href: '/parent/security', icon: '🔑', key: 'change_pin', bg: '#F9FAFB', label: 'Change PIN' },
];

const LANG_SHORT: Partial<Record<Lang, string>> = {
  en: 'EN', hi: 'हि', te: 'తె', ta: 'த', kn: 'ಕ', mr: 'म', ml: 'മ',
};
const LANG_ORDER: Lang[] = ['te', 'en', 'hi', 'ta', 'kn', 'mr', 'ml'];

export default function ParentHomePage() {
  const { lang, setLang } = useLang();
  const router = useRouter();
  const [data, setData]           = useState<DashData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [activeChildId, setActiveChildId] = useState<string | null>(null);

  // Fetch data — optionally for a specific child
  const fetchData = useCallback(async (childId?: string) => {
    setLoading(true);
    try {
      const url = childId
        ? `/api/parent/dashboard?child_id=${childId}`
        : '/api/parent/dashboard';
      const r = await fetch(url);
      if (r.ok) {
        const d = await r.json() as DashData;
        setData(d);
        // On first load, persist active child from API
        if (!childId && d.active_child_id) setActiveChildId(d.active_child_id);
      }
    } catch {/* ignore */}
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 6000);
    void fetchData().finally(() => clearTimeout(t));
    return () => clearTimeout(t);
  }, [fetchData]);

  const handleChildSwitch = (childId: string) => {
    setActiveChildId(childId);
    void fetchData(childId);
  };

  const handleLogout = async () => {
    await fetch('/api/parent/logout', { method: 'POST' }).catch(() => {});
    router.push('/parent/login');
  };

  const student    = data?.student ?? null;
  const attendance = data?.attendance ?? null;
  const fee        = data?.fee ?? null;
  const notices    = data?.notices ?? [];
  const schoolName = data?.school_name ?? '';
  const children   = data?.children ?? [];
  const multiChild = children.length > 1;

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
        .child-tab{border:none;padding:8px 16px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:all 0.15s;white-space:nowrap}
        .child-tab.active{background:#fff;color:#4F46E5;box-shadow:0 2px 8px rgba(79,70,229,0.2)}
        .child-tab.inactive{background:rgba(255,255,255,0.15);color:rgba(255,255,255,0.85)}
      `}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', padding: '16px 16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
            {loading ? '…' : schoolName}
          </div>
          <button onClick={() => void handleLogout()}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
            {T('sign_out', lang as never)}
          </button>
        </div>

        {/* Language strip */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: multiChild ? 14 : 10 }}>
          {LANG_ORDER.map(l => (
            <button key={l} onClick={() => setLang(l)}
              className={`lang-btn${lang === l ? ' active' : ''}`}>
              {LANG_SHORT[l]}
            </button>
          ))}
        </div>

        {/* Multi-child selector — only shown when parent has 2+ children */}
        {multiChild && (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {children.map(child => (
              <button
                key={child.id}
                onClick={() => handleChildSwitch(child.id)}
                className={`child-tab ${activeChildId === child.id ? 'active' : 'inactive'}`}>
                {child.name.split(' ')[0]} {/* First name only for compact tabs */}
                <span style={{ fontSize: 11, opacity: 0.8, marginLeft: 4 }}>
                  Cl.{child.class}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Student name + class */}
        {loading ? (
          <div className="skel" style={{ height: 28, width: '60%', marginTop: 8 }} />
        ) : student ? (
          <div style={{ marginTop: multiChild ? 10 : 6 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>
              {student.name}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
              Class {student.class}-{student.section}
              {student.roll_number ? ` · Roll ${student.roll_number}` : ''}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginTop: 6 }}>
            {T('parents', lang as never)}
          </div>
        )}
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* Attendance + Fee summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {/* Attendance */}
          <div style={{ background: '#fff', borderRadius: 14, padding: 14, border: '1px solid #F3F4F6' }}>
            <div style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600, marginBottom: 6 }}>
              {T('attendance', lang as never)}
            </div>
            {loading ? <div className="skel" style={{ height: 32, marginBottom: 4 }} /> : (
              <>
                <div style={{ fontSize: 28, fontWeight: 800, color: attColor, lineHeight: 1 }}>
                  {att}%
                </div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                  {attendance?.present_days ?? 0}/{attendance?.total_days ?? 0} days
                </div>
              </>
            )}
          </div>
          {/* Fees */}
          <div style={{ background: feeAlert ? '#FFF7ED' : '#fff', borderRadius: 14, padding: 14, border: `1px solid ${feeAlert ? '#FED7AA' : '#F3F4F6'}` }}>
            <div style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600, marginBottom: 6 }}>
              {T('fees', lang as never)}
            </div>
            {loading ? <div className="skel" style={{ height: 32, marginBottom: 4 }} /> : (
              <>
                {feeAlert ? (
                  <>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#D97706', lineHeight: 1 }}>
                      ₹{fee?.pending_amount.toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: 11, color: fee?.overdue ? '#B91C1C' : '#D97706', marginTop: 4, fontWeight: 600 }}>
                      {fee?.overdue ? 'Overdue' : 'Pending'}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#16A34A', lineHeight: 1 }}>✓</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>All clear</div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Quick actions grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 20 }}>
          {ACTION_KEYS.map(a => (
            <Link key={a.href} href={a.href} className="p-action">
              <div style={{ fontSize: 22, marginBottom: 4 }}>{a.icon}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', lineHeight: 1.2 }}>
                {a.label ?? T(a.key as never, lang as never)}
              </div>
            </Link>
          ))}
        </div>

        {/* Notices */}
        {notices.length > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', marginBottom: 10, letterSpacing: '-0.2px' }}>
              📢 {T('announcements', lang as never)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {notices.slice(0, 3).map(n => (
                <div key={n.id} style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', border: '1px solid #F3F4F6' }}>
                  {n.subject && <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 3 }}>{n.subject}</div>}
                  <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>{n.message}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 5 }}>
                    {new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
