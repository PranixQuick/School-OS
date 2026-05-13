'use client';

// PATH: app/parent/page.tsx
//
// Parent dashboard: phone+PIN login + 4 tabs (Homework, Announcements, Attendance, Lesson Plans).
// Bare layout (no Layout wrapper) per PRE-FLIGHT-A — consistent with /teacher pattern.
// Single-file with 4 tabs per PRE-FLIGHT-B — mobile-first, fewer route hops.
//
// Phone+PIN stored in component state, NOT localStorage (artifact-style restriction).
// Each tab makes its own API call with phone+pin in body (Item 13 auth model).
//
// Status enums consumed:
//   - homework_submissions.status: pending|submitted|late|graded|missed
//   - lesson_plans.completion_status: planned|in_progress|completed|skipped
//   - attendance.status: present|absent|late|excused

import { useState, useEffect, FormEvent } from 'react';

type Tab = 'homework' | 'announcements' | 'attendance' | 'lesson_plans' | 'fees' | 'ptm';

interface ParentInfo {
  id: string;
  school_id: string;
  name: string;
  phone: string;
  language_pref: string;
}

interface StudentInfo {
  id: string;
  name: string;
  class: string | null;
  section: string | null;
  is_active: boolean;
}

interface HomeworkRow {
  submission_id: string;
  status: string;
  submitted_at: string | null;
  marks_obtained: number | null;
  teacher_remarks: string | null;
  submission_attachments: string[];
  homework: {
    id: string;
    title: string;
    description: string | null;
    due_date: string;
    attachments: string[];
    subject: { id: string; name: string; code: string } | null;
  } | null;
}

interface AnnRow {
  id: string;
  title: string;
  message: string;
  scheduled_at: string;
  sent_at: string | null;
  is_school_wide: boolean;
}

interface AttRow {
  id: string;
  date: string;
  status: string;
  marked_via: string | null;
}

interface LessonPlanRow {
  id: string;
  planned_date: string;
  completion_status: string;
  completed_at: string | null;
  notes: string | null;
  subject: { id: string; name: string; code: string } | null;
}

// Item #2
interface FeeRow {
  id: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  fee_type: string | null;
  description: string | null;
  fee_receipt_number: string | null;
  gst_rate: number | null;
  tax_amount: number | null;
}

const STATUS_BADGE_FEE: Record<string, { bg: string; fg: string; label: string }> = {
  pending:  { bg: '#FEF3C7', fg: '#92400E', label: 'Pending' },
  overdue:  { bg: '#FEE2E2', fg: '#991B1B', label: 'Overdue' },
  paid:     { bg: '#D1FAE5', fg: '#065F46', label: 'Paid' },
  partial:  { bg: '#DBEAFE', fg: '#1E40AF', label: 'Partial' },
  waived:   { bg: '#F3F4F6', fg: '#4B5563', label: 'Waived' },
};

const STATUS_BADGE_HW: Record<string, { bg: string; fg: string; label: string }> = {
  pending: { bg: '#FEF3C7', fg: '#92400E', label: 'Pending' },
  submitted: { bg: '#DBEAFE', fg: '#1E40AF', label: 'Submitted' },
  late: { bg: '#FED7AA', fg: '#9A3412', label: 'Late' },
  graded: { bg: '#D1FAE5', fg: '#065F46', label: 'Graded' },
  missed: { bg: '#FEE2E2', fg: '#991B1B', label: 'Missed' },
};

const STATUS_BADGE_LP: Record<string, { bg: string; fg: string; label: string }> = {
  planned: { bg: '#E0E7FF', fg: '#3730A3', label: 'Planned' },
  in_progress: { bg: '#FEF3C7', fg: '#92400E', label: 'In progress' },
  completed: { bg: '#D1FAE5', fg: '#065F46', label: 'Completed' },
  skipped: { bg: '#F3F4F6', fg: '#4B5563', label: 'Skipped' },
};

const STATUS_BADGE_ATT: Record<string, { bg: string; fg: string; label: string }> = {
  present: { bg: '#D1FAE5', fg: '#065F46', label: 'Present' },
  absent: { bg: '#FEE2E2', fg: '#991B1B', label: 'Absent' },
  late: { bg: '#FED7AA', fg: '#9A3412', label: 'Late' },
  excused: { bg: '#E0E7FF', fg: '#3730A3', label: 'Excused' },
};

function fmtDate(s: string): string {
  return new Date(s + (s.length === 10 ? 'T00:00:00+05:30' : '')).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
  });
}

function fmtDateTime(s: string): string {
  return new Date(s).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
  });
}

export default function ParentPage() {
  // Auth state
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);
  // Item #2 — fees tab state
  const [fees, setFees] = useState<FeeRow[]>([]);
  const [feeSummary, setFeeSummary] = useState<Record<string, number>>({});
  const [feeTotalDue, setFeeTotalDue] = useState(0);
  const [feeTotalPaid, setFeeTotalPaid] = useState(0);
  const [feesLoading, setFeesLoading] = useState(false);
  const [feeFilter, setFeeFilter] = useState<string>('all');
  // Batch 7: PTM state
  const [ptmSlots, setPtmSlots] = useState<{id:string;slot_time:string;slot_date:string;parent_confirmed:boolean;staff_name:string;session_title:string}[]>([]);
  const [ptmLoading, setPtmLoading] = useState(false);
  // Item #13 PR #2 — payment action state
  const [onlineEnabled, setOnlineEnabled] = useState(false);
  const [proofFormFeeId, setProofFormFeeId] = useState<string | null>(null);
  const [proofRef, setProofRef] = useState('');
  const [proofScreenshotDataUrl, setProofScreenshotDataUrl] = useState<string | null>(null);
  const [proofScreenshotName, setProofScreenshotName] = useState('');
  const [proofSubmitting, setProofSubmitting] = useState(false);
  const [proofError, setProofError] = useState('');
  const [payingFeeId, setPayingFeeId] = useState<string | null>(null);
  const [rzpLoaded, setRzpLoaded] = useState(false);
  const [feeActionToast, setFeeActionToast] = useState('');
  const [parent, setParent] = useState<ParentInfo | null>(null);
  const [student, setStudent] = useState<StudentInfo | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>('homework');

  // Data state per tab
  const [homework, setHomework] = useState<HomeworkRow[]>([]);
  const [hwSummary, setHwSummary] = useState({ pending: 0, submitted: 0, late: 0, graded: 0, missed: 0 });
  const [hwLoading, setHwLoading] = useState(false);

  const [announcements, setAnnouncements] = useState<AnnRow[]>([]);
  const [annLoading, setAnnLoading] = useState(false);

  const [attendance, setAttendance] = useState<AttRow[]>([]);
  const [attSummary, setAttSummary] = useState({ present: 0, absent: 0, late: 0, excused: 0 });
  const [attPresentPct, setAttPresentPct] = useState<number | null>(null);
  const [attLoading, setAttLoading] = useState(false);
  const [attDays, setAttDays] = useState(30);

  const [lessonPlans, setLessonPlans] = useState<LessonPlanRow[]>([]);
  const [lpWeekStart, setLpWeekStart] = useState('');
  const [lpWeekEnd, setLpWeekEnd] = useState('');
  const [lpMessage, setLpMessage] = useState('');
  const [lpLoading, setLpLoading] = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setAuthError('');
    if (!phone || !pin) {
      setAuthError('Phone and PIN required');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/parent/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin }),
      });
      const d = await res.json();
      if (!res.ok) {
        setAuthError(d.error ?? 'Login failed');
        return;
      }
      setParent(d.parent);
      setStudent(d.student);
      // Auto-load homework tab.
      void loadHomework();
    } catch {
      setAuthError('Network error');
    } finally {
      setLoading(false);
    }
  }

  async function loadHomework() {
    setHwLoading(true);
    try {
      const res = await fetch('/api/parent/homework', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin }),
      });
      const d = await res.json();
      if (res.ok) {
        setHomework(d.homework ?? []);
        setHwSummary(d.summary ?? { pending: 0, submitted: 0, late: 0, graded: 0, missed: 0 });
      }
    } finally {
      setHwLoading(false);
    }
  }

  async function loadAnnouncements() {
    setAnnLoading(true);
    try {
      const res = await fetch('/api/parent/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin }),
      });
      const d = await res.json();
      if (res.ok) setAnnouncements(d.announcements ?? []);
    } finally {
      setAnnLoading(false);
    }
  }

  async function loadAttendance(days: number) {
    setAttLoading(true);
    try {
      const res = await fetch('/api/parent/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin, days }),
      });
      const d = await res.json();
      if (res.ok) {
        setAttendance(d.attendance ?? []);
        setAttSummary(d.summary ?? { present: 0, absent: 0, late: 0, excused: 0 });
        setAttPresentPct(d.present_pct);
      }
    } finally {
      setAttLoading(false);
    }
  }

  async function loadLessonPlans() {
    setLpLoading(true);
    try {
      const res = await fetch('/api/parent/lesson-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin }),
      });
      const d = await res.json();
      if (res.ok) {
        setLessonPlans(d.plans ?? []);
        setLpWeekStart(d.week_start ?? '');
        setLpWeekEnd(d.week_end ?? '');
        setLpMessage(d.message ?? '');
      }
    } finally {
      setLpLoading(false);
    }
  }

  // Auto-load tab when switched.
  useEffect(() => {
    if (!parent) return;
    if (activeTab === 'homework' && homework.length === 0 && !hwLoading) void loadHomework();
    if (activeTab === 'announcements' && announcements.length === 0 && !annLoading) void loadAnnouncements();
    if (activeTab === 'attendance' && attendance.length === 0 && !attLoading) void loadAttendance(attDays);
    if (activeTab === 'lesson_plans' && lessonPlans.length === 0 && !lpLoading) void loadLessonPlans();
    if (activeTab === 'fees' && fees.length === 0 && !feesLoading) void loadFees(feeFilter);
    if (activeTab === 'ptm' && ptmSlots.length === 0 && !ptmLoading) void loadPtm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, parent]);

  // Item #2
  async function loadFees(statusFilter?: string) {
    setFeesLoading(true);
    try {
      const res = await fetch('/api/parent/fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin, status: statusFilter && statusFilter !== 'all' ? statusFilter : undefined }),
      });
      const d = await res.json();
      if (res.ok) {
        setFees(d.fees ?? []);
        setFeeSummary(d.summary ?? {});
        setFeeTotalDue(d.total_due ?? 0);
        setFeeTotalPaid(d.total_paid ?? 0);
        setOnlineEnabled(!!d.online_payment_enabled);
      }
    } finally {
      setFeesLoading(false);
    }
  }

  // Batch 7: PTM
  async function loadPtm() {
    if (!parent) return;
    setPtmLoading(true);
    try {
      const res = await fetch(`/api/parent/ptm?phone=${encodeURIComponent(phone)}&pin=${encodeURIComponent(pin)}`);
      const d = await res.json();
      if (res.ok) setPtmSlots(d.slots ?? []);
    } catch { /* ignore */ }
    setPtmLoading(false);
  }

  async function confirmPtmSlot(slotId: string) {
    const res = await fetch(`/api/parent/ptm/${slotId}/confirm`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, pin }),
    });
    if (res.ok) setPtmSlots(prev => prev.map(s => s.id === slotId ? { ...s, parent_confirmed: true } : s));
  }

  // Item #13 PR #2 — payment action functions
  function loadRazorpayScript() {
    if (rzpLoaded || document.querySelector('script[src*="razorpay"]')) { setRzpLoaded(true); return; }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => setRzpLoaded(true);
    document.head.appendChild(s);
  }

  async function submitProof(feeId: string) {
    if (!proofRef.trim()) { setProofError('Transaction reference is required'); return; }
    setProofSubmitting(true); setProofError('');
    const res = await fetch(`/api/parent/fees/${feeId}/submit-payment-proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, pin, payment_reference: proofRef.trim(), screenshot_data_url: proofScreenshotDataUrl ?? undefined }),
    });
    const d = await res.json();
    setProofSubmitting(false);
    if (!res.ok) { setProofError(d.error ?? 'Submission failed'); return; }
    setProofFormFeeId(null); setProofRef(''); setProofScreenshotDataUrl(null); setProofScreenshotName('');
    setFeeActionToast('Payment proof submitted — pending admin review');
    setTimeout(() => setFeeActionToast(''), 4000);
    void loadFees(feeFilter);
  }

  async function payOnline(feeId: string, amount: number) {
    setPayingFeeId(feeId);
    loadRazorpayScript();
    try {
      const orderRes = await fetch('/api/parent/fees/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin, fee_id: feeId }),
      });
      const order = await orderRes.json();
      if (!orderRes.ok) { setFeeActionToast(order.error ?? 'Could not create payment order'); setTimeout(() => setFeeActionToast(''), 4000); setPayingFeeId(null); return; }
      const rzp = new (window as unknown as { Razorpay: new (opts: Record<string, unknown>) => { open(): void } }).Razorpay({
        key: order.key_id,
        amount: order.amount_paise,
        currency: order.currency,
        order_id: order.order_id,
        name: 'School Fees',
        description: 'Fee payment',
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          const confRes = await fetch('/api/parent/fees/confirm-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, pin, fee_id: feeId, ...response }),
          });
          const conf = await confRes.json();
          setPayingFeeId(null);
          if (conf.success) { setFeeActionToast('Payment successful! Receipt: ' + conf.receipt_number); setTimeout(() => setFeeActionToast(''), 5000); void loadFees(feeFilter); }
          else { setFeeActionToast(conf.error ?? 'Payment failed'); setTimeout(() => setFeeActionToast(''), 4000); }
        },
        modal: { ondismiss: () => setPayingFeeId(null) },
      });
      rzp.open();
    } catch { setPayingFeeId(null); setFeeActionToast('Payment error — please try again'); setTimeout(() => setFeeActionToast(''), 4000); }
  }

  // === LOGIN SCREEN ===
  if (!parent || !student) {
    return (
      <div style={{ minHeight: '100vh', background: '#F9FAFB', padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 400, background: '#fff', borderRadius: 16, padding: 28, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 6, color: '#111827' }}>Parent Portal</div>
          <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 24 }}>Log in to see your child&apos;s school activity</div>
          <form onSubmit={handleLogin}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Phone</label>
            <input
              type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="+91 ..."
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 14, marginBottom: 16, boxSizing: 'border-box' }}
            />
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>PIN</label>
            <input
              type="password" inputMode="numeric" value={pin} onChange={e => setPin(e.target.value)}
              placeholder="4-digit PIN"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 14, marginBottom: 16, boxSizing: 'border-box' }}
            />
            {authError && (
              <div style={{ padding: '10px 12px', background: '#FEE2E2', color: '#991B1B', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                {authError}
              </div>
            )}
            <button
              type="submit" disabled={loading}
              style={{ width: '100%', padding: '12px 16px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
            >
              {loading ? 'Logging in...' : 'Log in'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // === MAIN APP ===
  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB' }}>
      {/* Item #13 fee action toast */}
      {feeActionToast ? (
        <div style={{ position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: '#111827', color: '#fff', padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', whiteSpace: 'nowrap' }}>
          {feeActionToast}
        </div>
      ) : null}

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ fontSize: 11, color: '#6B7280' }}>Parent of</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{student.name}</div>
        <div style={{ fontSize: 11, color: '#6B7280' }}>
          Class {student.class}-{student.section} · {parent.name}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #E5E7EB', position: 'sticky', top: 64, zIndex: 9, overflowX: 'auto' }}>
        {([
          { key: 'homework' as Tab, label: '📚 Homework' },
          { key: 'announcements' as Tab, label: '📢 News' },
          { key: 'attendance' as Tab, label: '✓ Attendance' },
          { key: 'lesson_plans' as Tab, label: '📅 Plans' },
          { key: 'fees' as Tab, label: '₹ Fees' },
          { key: 'ptm' as Tab, label: '🤝 PTM' },
        ]).map(t => (
          <button
            key={t.key} onClick={() => setActiveTab(t.key)}
            style={{
              flex: 1, minWidth: 90,
              padding: '12px 8px',
              background: 'transparent', border: 'none',
              borderBottom: activeTab === t.key ? '2px solid #4F46E5' : '2px solid transparent',
              color: activeTab === t.key ? '#4F46E5' : '#6B7280',
              fontSize: 13, fontWeight: activeTab === t.key ? 700 : 500,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ padding: 16 }}>
        {/* === HOMEWORK TAB === */}
        {activeTab === 'homework' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 16 }}>
              {(Object.entries(STATUS_BADGE_HW) as [string, typeof STATUS_BADGE_HW[string]][]).map(([k, b]) => (
                <div key={k} style={{ background: b.bg, padding: '8px 4px', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: b.fg }}>{(hwSummary as Record<string, number>)[k] ?? 0}</div>
                  <div style={{ fontSize: 9, color: b.fg, marginTop: 2 }}>{b.label}</div>
                </div>
              ))}
            </div>

            {hwLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#6B7280', fontSize: 13 }}>Loading...</div>
            ) : homework.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📚</div>
                <div style={{ fontSize: 14, color: '#6B7280' }}>No homework yet</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {homework.map(row => {
                  const hw = row.homework!;
                  const badge = STATUS_BADGE_HW[row.status];
                  return (
                    <div key={row.submission_id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', flex: 1, marginRight: 8 }}>{hw.title}</div>
                        <span style={{ background: badge.bg, color: badge.fg, padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600 }}>{badge.label}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6 }}>
                        Due {fmtDate(hw.due_date)}{hw.subject ? ` · ${hw.subject.name}` : ''}
                      </div>
                      {hw.description && (
                        <div style={{ fontSize: 12, color: '#374151', marginBottom: 6 }}>{hw.description}</div>
                      )}
                      {row.status === 'graded' && row.marks_obtained !== null && (
                        <div style={{ fontSize: 12, color: '#065F46', fontWeight: 600 }}>
                          Marks: {row.marks_obtained}
                        </div>
                      )}
                      {row.teacher_remarks && (
                        <div style={{ fontSize: 11, color: '#6B7280', fontStyle: 'italic', marginTop: 4 }}>
                          Teacher: {row.teacher_remarks}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* === ANNOUNCEMENTS TAB === */}
        {activeTab === 'announcements' && (
          <>
            {annLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#6B7280', fontSize: 13 }}>Loading...</div>
            ) : announcements.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📢</div>
                <div style={{ fontSize: 14, color: '#6B7280' }}>No announcements yet</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {announcements.map(a => (
                  <div key={a.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{a.title}</div>
                      {a.is_school_wide && (
                        <span style={{ background: '#E0E7FF', color: '#3730A3', padding: '2px 6px', borderRadius: 4, fontSize: 10 }}>School-wide</span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 8 }}>{fmtDateTime(a.scheduled_at)}</div>
                    <div style={{ fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap' }}>{a.message}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* === ATTENDANCE TAB === */}
        {activeTab === 'attendance' && (
          <>
            <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#6B7280' }}>Attendance rate (last {attDays} days)</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: attPresentPct === null ? '#9CA3AF' : attPresentPct >= 90 ? '#065F46' : attPresentPct >= 75 ? '#92400E' : '#991B1B' }}>
                    {attPresentPct === null ? '—' : `${attPresentPct}%`}
                  </div>
                </div>
                <select
                  value={attDays}
                  onChange={e => { const d = Number(e.target.value); setAttDays(d); void loadAttendance(d); }}
                  style={{ padding: '6px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13, background: '#fff' }}
                >
                  <option value={7}>Last 7 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={60}>Last 60 days</option>
                  <option value={90}>Last 90 days</option>
                  <option value={180}>Last 6 months</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {(Object.entries(STATUS_BADGE_ATT) as [string, typeof STATUS_BADGE_ATT[string]][]).map(([k, b]) => (
                  <div key={k} style={{ background: b.bg, padding: '8px 4px', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: b.fg }}>{(attSummary as Record<string, number>)[k] ?? 0}</div>
                    <div style={{ fontSize: 9, color: b.fg, marginTop: 2 }}>{b.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {attLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#6B7280', fontSize: 13 }}>Loading...</div>
            ) : attendance.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>✓</div>
                <div style={{ fontSize: 14, color: '#6B7280' }}>No attendance records in this range</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {attendance.map(r => {
                  const badge = STATUS_BADGE_ATT[r.status];
                  return (
                    <div key={r.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 13, color: '#111827' }}>{fmtDate(r.date)}</div>
                      <span style={{ background: badge.bg, color: badge.fg, padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{badge.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* === LESSON PLANS TAB === */}
        {activeTab === 'lesson_plans' && (
          <>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
              Week of {lpWeekStart ? fmtDate(lpWeekStart) : '...'} – {lpWeekEnd ? fmtDate(lpWeekEnd) : '...'}
            </div>

            {lpLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#6B7280', fontSize: 13 }}>Loading...</div>
            ) : lessonPlans.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📅</div>
                <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 6 }}>No lesson plans this week</div>
                {lpMessage && <div style={{ fontSize: 11, color: '#9CA3AF' }}>{lpMessage}</div>}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {lessonPlans.map(p => {
                  const badge = STATUS_BADGE_LP[p.completion_status];
                  return (
                    <div key={p.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                          {p.subject ? p.subject.name : 'Subject TBD'}
                        </div>
                        <span style={{ background: badge.bg, color: badge.fg, padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600 }}>{badge.label}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#6B7280', marginBottom: p.notes ? 6 : 0 }}>{fmtDate(p.planned_date)}</div>
                      {p.notes && (
                        <div style={{ fontSize: 12, color: '#374151' }}>{p.notes}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
        {/* === FEES TAB === */}
        {activeTab === 'fees' && (
          <>
            {/* Summary strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
              {(['pending','overdue','paid'] as const).map(s => {
                const b = STATUS_BADGE_FEE[s];
                return (
                  <div key={s} style={{ background: b.bg, padding: '10px 4px', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: b.fg }}>{feeSummary[s] ?? 0}</div>
                    <div style={{ fontSize: 9, color: b.fg, marginTop: 2 }}>{b.label}</div>
                  </div>
                );
              })}
            </div>
            {/* Totals row */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <div style={{ flex: 1, background: '#FEE2E2', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: '#991B1B', fontWeight: 600 }}>AMOUNT DUE</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#991B1B' }}>₹{Math.round(feeTotalDue).toLocaleString('en-IN')}</div>
              </div>
              <div style={{ flex: 1, background: '#D1FAE5', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: '#065F46', fontWeight: 600 }}>TOTAL PAID</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#065F46' }}>₹{Math.round(feeTotalPaid).toLocaleString('en-IN')}</div>
              </div>
            </div>
            {/* Filter pills */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', paddingBottom: 4 }}>
              {['all','pending','overdue','paid','partial','waived'].map(s => (
                <button key={s} onClick={() => { setFeeFilter(s); setFees([]); void loadFees(s); }}
                  style={{ padding: '4px 12px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 600,
                    background: feeFilter === s ? '#4F46E5' : '#F3F4F6',
                    color: feeFilter === s ? '#fff' : '#374151', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            {feesLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#6B7280', fontSize: 13 }}>Loading...</div>
            ) : fees.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>₹</div>
                <div style={{ fontSize: 14, color: '#6B7280' }}>No fee records{feeFilter !== 'all' ? ' for ' + feeFilter + ' status' : ''}</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {fees.map(f => {
                  const b = STATUS_BADGE_FEE[f.status] ?? STATUS_BADGE_FEE['pending'];
                  const isPaid = f.status === 'paid' || f.status === 'partial';
                  const totalAmt = Number(f.amount ?? 0) + Number(f.tax_amount ?? 0);
                  return (
                    <div key={f.id} style={{ background: '#fff', borderRadius: 10, padding: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: '3px solid ' + b.bg }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{f.fee_type ? f.fee_type.charAt(0).toUpperCase() + f.fee_type.slice(1) : 'Fee'}</div>
                          {f.description && <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>{f.description}</div>}
                        </div>
                        <span style={{ background: b.bg, color: b.fg, padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{b.label}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div>
                          <div style={{ fontSize: 11, color: '#6B7280' }}>Due: {f.due_date}</div>
                          {isPaid && f.paid_date && <div style={{ fontSize: 11, color: '#065F46' }}>Paid: {f.paid_date}</div>}
                          {f.gst_rate != null && <div style={{ fontSize: 10, color: '#9CA3AF' }}>GST {f.gst_rate}%{f.tax_amount != null ? ' = ₹' + Number(f.tax_amount).toLocaleString('en-IN') : ''}</div>}
                          {f.fee_receipt_number && <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>Receipt: {f.fee_receipt_number}</div>}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: isPaid ? '#065F46' : '#111827' }}>₹{Math.round(totalAmt).toLocaleString('en-IN')}</div>
                          {f.tax_amount != null && f.tax_amount > 0 && <div style={{ fontSize: 9, color: '#9CA3AF' }}>incl. tax</div>}
                        </div>
                      </div>

                      {/* Action buttons — Item #13 PR #2 */}
                      {(f.status === 'pending' || f.status === 'overdue') && (
                        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {onlineEnabled && (
                            <button
                              onClick={() => { void payOnline(f.id, Number(f.amount)); }}
                              disabled={payingFeeId === f.id}
                              style={{ flex: '0 0 auto', padding: '8px 16px', background: payingFeeId === f.id ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: payingFeeId === f.id ? 'not-allowed' : 'pointer' }}>
                              {payingFeeId === f.id ? 'Processing...' : 'Pay Now'}
                            </button>
                          )}
                          <button
                            onClick={() => { setProofFormFeeId(proofFormFeeId === f.id ? null : f.id); setProofRef(''); setProofScreenshotDataUrl(null); setProofScreenshotName(''); setProofError(''); }}
                            style={{ flex: '0 0 auto', padding: '8px 16px', background: proofFormFeeId === f.id ? '#F3F4F6' : '#fff', color: '#374151', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            {proofFormFeeId === f.id ? 'Cancel' : 'I Have Paid'}
                          </button>
                        </div>
                      )}

                      {f.status === 'pending_verification' && (
                        <div style={{ marginTop: 8, background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: 6, padding: '6px 10px', fontSize: 11, fontWeight: 600, color: '#713F12' }}>
                          ⏳ Verification Pending — admin reviewing your payment
                        </div>
                      )}

                      {/* Inline I Have Paid form */}
                      {proofFormFeeId === f.id && (
                        <div style={{ marginTop: 10, background: '#F9FAFB', borderRadius: 8, padding: 12, border: '1px solid #E5E7EB' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Submit Payment Proof</div>
                          <div style={{ marginBottom: 8 }}>
                            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>TRANSACTION REFERENCE *</label>
                            <input value={proofRef} onChange={e => setProofRef(e.target.value)}
                              placeholder="UPI transaction ID / cheque number"
                              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, boxSizing: 'border-box' as const }} />
                          </div>
                          <div style={{ marginBottom: 8 }}>
                            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>SCREENSHOT <span style={{ fontWeight: 400, color: '#6B7280' }}>(optional)</span></label>
                            <input type="file" accept="image/*"
                              onChange={e => {
                                const file = e.target.files?.[0];
                                if (!file) { setProofScreenshotDataUrl(null); setProofScreenshotName(''); return; }
                                setProofScreenshotName(file.name);
                                const reader = new FileReader();
                                reader.onload = () => setProofScreenshotDataUrl(reader.result as string);
                                reader.readAsDataURL(file);
                              }}
                              style={{ width: '100%', fontSize: 12 }} />
                            {proofScreenshotName && <div style={{ fontSize: 10, color: '#6B7280', marginTop: 3 }}>Selected: {proofScreenshotName}</div>}
                          </div>
                          {proofError && <div style={{ fontSize: 11, color: '#991B1B', marginBottom: 6 }}>{proofError}</div>}
                          <button onClick={() => void submitProof(f.id)} disabled={proofSubmitting}
                            style={{ width: '100%', padding: '9px', background: proofSubmitting ? '#9CA3AF' : '#065F46', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: proofSubmitting ? 'not-allowed' : 'pointer' }}>
                            {proofSubmitting ? 'Submitting...' : 'Submit Proof'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
