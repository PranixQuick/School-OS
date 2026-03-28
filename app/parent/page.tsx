'use client';

import { useState, FormEvent } from 'react';

interface AttendanceSummary { present: number; total: number; percentage: number; }
interface AttRecord { date: string; status: string; }
interface Fee { fee_type: string; amount: number; due_date: string; status: string; paid_date: string | null; }
interface Narrative { term: string; narrative_text: string; status: string; }
interface Student { name: string; class: string; section: string; roll_number: string | null; }

interface PortalData {
  parent: { name: string };
  student: Student;
  attendance: { records: AttRecord[]; summary: AttendanceSummary };
  fees: Fee[];
  narratives: Narrative[];
}

type Screen = 'login' | 'portal';

const STATUS_COLOR: Record<string, string> = {
  present: '#15803D', absent: '#B91C1C', late: '#A16207', excused: '#6B7280',
};

const FEE_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  paid:    { bg: '#DCFCE7', color: '#15803D' },
  pending: { bg: '#FEF9C3', color: '#A16207' },
  overdue: { bg: '#FEE2E2', color: '#B91C1C' },
  waived:  { bg: '#F3F4F6', color: '#6B7280' },
};

export default function ParentPortal() {
  const [screen, setScreen] = useState<Screen>('login');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<PortalData | null>(null);
  const [activeTab, setActiveTab] = useState<'attendance' | 'fees' | 'reports'>('attendance');

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');

    try {
      const res = await fetch('/api/parent/student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin }),
      });
      const d = await res.json() as PortalData & { error?: string };
      if (!res.ok) { setError(d.error ?? 'Login failed'); return; }
      setData(d);
      setScreen('portal');
    } catch { setError('Network error. Please try again.');
    } finally { setLoading(false); }
  }

  const pct = data?.attendance.summary.percentage ?? 0;

  if (screen === 'login') return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 360 }}>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 24, fontWeight: 800, color: '#fff' }}>S</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>Parent Portal</div>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>Suchitra Academy</div>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB', padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Sign in</div>
          <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>Enter your phone number and the PIN sent by the school</div>

          {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#991B1B', marginBottom: 16 }}>{error}</div>}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>PHONE NUMBER</label>
              <input
                required type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                style={{ width: '100%', height: 44, borderRadius: 9, border: '1px solid #D1D5DB', background: '#F9FAFB', fontSize: 15, padding: '0 14px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>4-DIGIT PIN</label>
              <input
                required type="password" maxLength={4} value={pin} onChange={e => setPin(e.target.value)}
                placeholder="••••"
                style={{ width: '100%', height: 44, borderRadius: 9, border: '1px solid #D1D5DB', background: '#F9FAFB', fontSize: 20, padding: '0 14px', outline: 'none', fontFamily: 'inherit', letterSpacing: '0.2em', textAlign: 'center', boxSizing: 'border-box' }}
              />
            </div>
            <button type="submit" disabled={loading} style={{ width: '100%', height: 44, borderRadius: 10, border: 'none', background: loading ? '#818CF8' : '#4F46E5', color: '#fff', fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              {loading ? 'Verifying...' : 'View My Child\'s Report →'}
            </button>
          </form>

          <div style={{ marginTop: 16, padding: '10px 12px', background: '#F9FAFB', borderRadius: 8, fontSize: 12, color: '#6B7280' }}>
            Contact the school office to get your 4-digit PIN: <strong>040-12345678</strong>
          </div>
        </div>
      </div>
    </div>
  );

  if (!data) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#4F46E5', color: '#fff', padding: '20px 16px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 2 }}>SUCHITRA ACADEMY</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{data.student.name}</div>
            <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>Class {data.student.class}-{data.student.section} · Welcome, {data.parent.name}</div>
          </div>
          <button onClick={() => setScreen('login')} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            Logout
          </button>
        </div>

        {/* Quick attendance stat */}
        <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 3 }}>ATTENDANCE (LAST 30 DAYS)</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{pct}%</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, opacity: 0.7 }}>{data.attendance.summary.present}/{data.attendance.summary.total} days</div>
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
              {pct >= 90 ? '✓ Excellent' : pct >= 75 ? '⚠ Needs attention' : '⛔ Low attendance'}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
        {(['attendance', 'fees', 'reports'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ flex: 1, padding: '12px 0', border: 'none', background: 'none', fontSize: 13, fontWeight: activeTab === tab ? 700 : 500, color: activeTab === tab ? '#4F46E5' : '#6B7280', borderBottom: activeTab === tab ? '2px solid #4F46E5' : '2px solid transparent', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize' }}>
            {tab}
          </button>
        ))}
      </div>

      <div style={{ padding: 16 }}>

        {/* Attendance tab */}
        {activeTab === 'attendance' && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Recent Attendance</div>
            {data.attendance.records.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>No attendance records found.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.attendance.records.map((rec, i) => (
                  <div key={i} style={{ background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 14, color: '#374151', fontWeight: 500 }}>
                      {new Date(rec.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: STATUS_COLOR[rec.status] + '18', color: STATUS_COLOR[rec.status] ?? '#6B7280' }}>
                      {rec.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Fees tab */}
        {activeTab === 'fees' && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Fee Details</div>
            {data.fees.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>No fee records found.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.fees.map((fee, i) => {
                  const style = FEE_STATUS_STYLE[fee.status] ?? FEE_STATUS_STYLE.pending;
                  return (
                    <div key={i} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: '14px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', textTransform: 'capitalize' }}>
                          {fee.fee_type.replace('_', ' ')} Fee
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: style.bg, color: style.color }}>
                          {fee.status.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 6 }}>₹{Number(fee.amount).toLocaleString('en-IN')}</div>
                      <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                        Due: {new Date(fee.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                        {fee.paid_date && ` · Paid: ${new Date(fee.paid_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                      </div>
                    </div>
                  );
                })}
                <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                  For fee payment, contact: <strong>040-12345678</strong>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reports tab */}
        {activeTab === 'reports' && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Teacher Remarks</div>
            {data.narratives.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>No reports available yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {data.narratives.map((n, i) => (
                  <div key={i} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{n.term}</div>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#DCFCE7', color: '#15803D' }}>
                        {n.status.toUpperCase()}
                      </span>
                    </div>
                    <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, margin: 0 }}>{n.narrative_text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
