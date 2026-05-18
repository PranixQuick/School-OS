'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface StudentInfo {
  name: string; class: string; section: string;
  roll_number: string | null; admission_number: string | null;
}
interface Attendance { present_pct: number; total_days: number; present_days: number; }
interface FeeInfo { pending_amount: number; overdue: boolean; }
interface Notice { id: string; subject: string; message: string; created_at: string; }

export default function ParentHomePage() {
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

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <style>{`
        * { box-sizing: border-box; }
        .ph-header { background: #4F46E5; padding: 16px 16px 24px; }
        .ph-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .ph-school { font-size: 13px; color: rgba(255,255,255,0.8); font-weight: 600; }
        .ph-logout { background: rgba(255,255,255,0.15); border: none; border-radius: 8px; padding: 6px 12px; font-size: 12px; color: #fff; cursor: pointer; font-weight: 600; }
        .ph-greeting { font-size: 13px; color: rgba(255,255,255,0.8); }
        .ph-body { padding: 16px; margin-top: -12px; }
        .ph-student-card { background: #fff; border-radius: 16px; padding: 18px; margin-bottom: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
        .ph-student-name { font-size: 20px; font-weight: 800; color: #111827; margin-bottom: 4px; }
        .ph-student-class { font-size: 13px; color: #6B7280; }
        .ph-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
        .ph-stat { background: #F9FAFB; border-radius: 12px; padding: 12px; text-align: center; }
        .ph-stat-val { font-size: 22px; font-weight: 800; }
        .ph-stat-label { font-size: 11px; color: #6B7280; margin-top: 2px; }
        .ph-section-title { font-size: 13px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
        .ph-actions { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px; }
        .ph-action { display: block; background: #fff; border-radius: 12px; padding: 14px 8px; text-align: center; text-decoration: none; border: 1px solid #F3F4F6; }
        .ph-action-icon { font-size: 22px; margin-bottom: 4px; }
        .ph-action-label { font-size: 12px; font-weight: 700; color: #374151; }
        .ph-notice { background: #fff; border-radius: 12px; padding: 14px; margin-bottom: 8px; border-left: 3px solid #4F46E5; }
        .ph-notice-subject { font-size: 14px; font-weight: 700; color: #111827; margin-bottom: 4px; }
        .ph-notice-msg { font-size: 13px; color: #6B7280; line-height: 1.4; }
        .ph-notice-date { font-size: 11px; color: #9CA3AF; margin-top: 4px; }
        .ph-empty { text-align: center; padding: 20px; font-size: 13px; color: #9CA3AF; }
        .ph-fee-alert { background: #FEF2F2; border-radius: 12px; padding: 14px; margin-bottom: 16px; border-left: 3px solid #B91C1C; }
        .ph-fee-title { font-size: 14px; font-weight: 700; color: #B91C1C; }
        .ph-fee-amount { font-size: 13px; color: #B91C1C; margin-top: 2px; }
        .skel { background: #F3F4F6; border-radius: 8px; animation: pulse 1.5s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.5} }
      `}</style>

      <div className="ph-header">
        <div className="ph-header-row">
          <div className="ph-school">{loading ? 'Loading…' : schoolName}</div>
          <button className="ph-logout" onClick={handleLogout}>Sign Out</button>
        </div>
        <div className="ph-greeting">Parent Portal</div>
      </div>

      <div className="ph-body">
        {/* Student card */}
        <div className="ph-student-card">
          {loading ? (
            <><div className="skel" style={{ height: 24, width: '60%', marginBottom: 8 }} /><div className="skel" style={{ height: 16, width: '40%' }} /></>
          ) : student ? (
            <>
              <div className="ph-student-name">{student.name}</div>
              <div className="ph-student-class">Class {student.class}-{student.section} {student.roll_number ? `· Roll No. ${student.roll_number}` : ''}</div>
              <div className="ph-stats">
                <div className="ph-stat">
                  <div className="ph-stat-val" style={{ color: attColor }}>{loading ? '—' : `${Math.round(att)}%`}</div>
                  <div className="ph-stat-label">Attendance</div>
                </div>
                <div className="ph-stat">
                  <div className="ph-stat-val" style={{ color: fee?.pending_amount ? '#B91C1C' : '#16A34A' }}>
                    {loading ? '—' : fee?.pending_amount ? `₹${Math.round(fee.pending_amount / 100) * 100 >= 1000 ? (fee.pending_amount / 1000).toFixed(1) + 'K' : fee.pending_amount}` : '✓'}
                  </div>
                  <div className="ph-stat-label">{fee?.pending_amount ? 'Fees Due' : 'Fees Clear'}</div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ color: '#6B7280', fontSize: 14 }}>No student linked to this account.</div>
          )}
        </div>

        {/* Fee alert */}
        {!loading && fee?.pending_amount && fee.pending_amount > 0 && (
          <div className="ph-fee-alert">
            <div className="ph-fee-title">⚠️ Fee Payment Pending</div>
            <div className="ph-fee-amount">₹{fee.pending_amount} outstanding {fee.overdue ? '(overdue)' : ''}</div>
          </div>
        )}

        {/* Quick actions */}
        <div className="ph-section-title">Quick Actions</div>
        <div className="ph-actions">
          <Link href="/parent/attendance" className="ph-action">
            <div className="ph-action-icon">✅</div>
            <div className="ph-action-label">Attendance</div>
          </Link>
          <Link href="/parent/homework" className="ph-action">
            <div className="ph-action-icon">📚</div>
            <div className="ph-action-label">Homework</div>
          </Link>
          <Link href="/parent/fees" className="ph-action">
            <div className="ph-action-icon">💳</div>
            <div className="ph-action-label">Fees</div>
          </Link>
          <Link href="/parent/marks" className="ph-action">
            <div className="ph-action-icon">📊</div>
            <div className="ph-action-label">Marks</div>
          </Link>
          <Link href="/parent/timetable" className="ph-action">
            <div className="ph-action-icon">🗓️</div>
            <div className="ph-action-label">Timetable</div>
          </Link>
          <Link href="/parent/notices" className="ph-action">
            <div className="ph-action-icon">📢</div>
            <div className="ph-action-label">Notices</div>
          </Link>
        </div>

        {/* Notices */}
        <div className="ph-section-title">School Notices</div>
        {loading ? (
          <><div className="skel" style={{ height: 64, marginBottom: 8 }} /><div className="skel" style={{ height: 64 }} /></>
        ) : notices.length === 0 ? (
          <div className="ph-empty">No notices from school.</div>
        ) : notices.slice(0, 5).map(n => (
          <div key={n.id} className="ph-notice">
            <div className="ph-notice-subject">{n.subject}</div>
            <div className="ph-notice-msg">{n.message.slice(0, 100)}{n.message.length > 100 ? '…' : ''}</div>
            <div className="ph-notice-date">{new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
