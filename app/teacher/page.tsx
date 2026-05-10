'use client';

import { useState, FormEvent } from 'react';

interface ClassInfo { id: string; grade_level: string; section: string; }
interface SubjectInfo { id: string; code: string; name: string; }
interface ScheduleEntry {
  id: string;
  period: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  classes: ClassInfo | null;
  subjects: SubjectInfo | null;
}
interface Teacher {
  id: string;
  school_id: string;
  name: string;
  role: string;
  subject: string | null;
}
interface Student {
  id: string;
  name: string;
  roll_number: string | null;
  admission_number: string | null;
  todays_status: string | null;
}
interface ClassDetails { id: string; grade_level: string; section: string; }
interface CheckinResult { inside: boolean; polygon_active: boolean; late_event_logged: boolean; at: number; }

type Screen = 'login' | 'schedule' | 'mark_attendance';
type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

const STATUS_COLOR: Record<string, string> = {
  present: '#15803D',
  absent:  '#B91C1C',
  late:    '#A16207',
  excused: '#6B7280',
};

const STATUS_BG: Record<AttendanceStatus, { bg: string; color: string; border: string }> = {
  present: { bg: '#DCFCE7', color: '#15803D', border: '#86EFAC' },
  absent:  { bg: '#FEE2E2', color: '#B91C1C', border: '#FCA5A5' },
  late:    { bg: '#FEF9C3', color: '#A16207', border: '#FDE047' },
  excused: { bg: '#F3F4F6', color: '#6B7280', border: '#D1D5DB' },
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function TeacherPortal() {
  const [screen, setScreen] = useState<Screen>('login');

  // Auth credentials kept in component state. Re-sent on every API call (no session).
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [dayOfWeek, setDayOfWeek] = useState<number | null>(null);

  // Mark-attendance screen state
  const [activeClass, setActiveClass] = useState<ClassDetails | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  const [savingMarks, setSavingMarks] = useState(false);
  const [markedToast, setMarkedToast] = useState('');

  // Geo check-in state (Item 10)
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkinResult, setCheckinResult] = useState<CheckinResult | null>(null);
  const [checkinError, setCheckinError] = useState('');

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/teacher/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? 'Login failed');
        return;
      }
      setTeacher(d.teacher);
      setSchedule(d.schedule ?? []);
      setDayOfWeek(d.day_of_week);
      setScreen('schedule');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function refreshSchedule() {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/teacher/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? 'Failed to refresh schedule');
        return;
      }
      setSchedule(d.schedule ?? []);
      setDayOfWeek(d.day_of_week);
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  }

  async function openClass(entry: ScheduleEntry) {
    if (!entry.classes) return;
    const classInfo = entry.classes;
    setLoading(true); setError(''); setMarkedToast('');
    try {
      const res = await fetch('/api/teacher/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin, class_id: classInfo.id }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? 'Failed to load students');
        return;
      }
      setActiveClass(d.class);
      setStudents(d.students ?? []);
      // Pre-fill marks from today's existing attendance, otherwise default to 'present'.
      const initial: Record<string, AttendanceStatus> = {};
      for (const s of d.students ?? []) {
        initial[s.id] = (s.todays_status as AttendanceStatus) ?? 'present';
      }
      setMarks(initial);
      setScreen('mark_attendance');
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  }

  async function submitMarks() {
    if (!activeClass) return;
    setSavingMarks(true); setError(''); setMarkedToast('');
    try {
      const payload = {
        phone, pin,
        class_id: activeClass.id,
        marks: students.map(s => ({ student_id: s.id, status: marks[s.id] ?? 'present' })),
      };
      const res = await fetch('/api/teacher/attendance/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? 'Failed to save attendance');
        return;
      }
      setMarkedToast(`Saved ${d.marked_count} students for today`);
      // Update todays_status in students so re-entry shows the saved values.
      setStudents(prev => prev.map(s => ({ ...s, todays_status: marks[s.id] ?? 'present' })));
    } catch {
      setError('Network error.');
    } finally {
      setSavingMarks(false);
    }
  }

  // Item 10: geo check-in. Calls navigator.geolocation, POSTs to /api/teacher/checkin.
  // Phone+PIN re-auth (mirrors other teacher routes). school_id derived server-side.
  async function handleCheckin() {
    setCheckingIn(true); setCheckinError(''); setCheckinResult(null);
    if (!navigator.geolocation) {
      setCheckinError('Geolocation not supported on this device.');
      setCheckingIn(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch('/api/teacher/checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone, pin,
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy_m: pos.coords.accuracy,
            }),
          });
          const d = await res.json();
          if (!res.ok) {
            setCheckinError(d.error ?? 'Check-in failed');
          } else {
            setCheckinResult({
              inside: !!d.inside,
              polygon_active: !!d.polygon_active,
              late_event_logged: !!d.late_event_logged,
              at: Date.now(),
            });
          }
        } catch {
          setCheckinError('Network error.');
        } finally {
          setCheckingIn(false);
        }
      },
      (err) => {
        setCheckinError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied. Enable it in browser settings.'
            : err.code === err.POSITION_UNAVAILABLE
            ? 'Location unavailable. Try moving outdoors.'
            : err.code === err.TIMEOUT
            ? 'Location request timed out. Try again.'
            : 'Could not get location.'
        );
        setCheckingIn(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  function handleLogout() {
    setTeacher(null); setSchedule([]); setDayOfWeek(null);
    setPhone(''); setPin(''); setError(''); setMarkedToast('');
    setActiveClass(null); setStudents([]); setMarks({});
    setScreen('login');
  }

  function fmtTime(t: string) {
    // t is HH:MM:SS — show HH:MM only.
    return t?.slice(0, 5) ?? '';
  }

  // ─── LOGIN SCREEN ─────────────────────────────────────────────────────────
  if (screen === 'login') return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#111827', marginBottom: 4 }}>Teacher Portal</div>
          <div style={{ fontSize: 14, color: '#6B7280' }}>Sign in to view today&apos;s schedule</div>
        </div>

        <form onSubmit={handleLogin} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 24 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Phone number</label>
          <input
            type="tel" required value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="10-digit mobile number"
            style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', fontSize: 15, border: '1px solid #D1D5DB', borderRadius: 8, marginBottom: 16, outline: 'none' }}
          />

          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>PIN</label>
          <input
            type="password" inputMode="numeric" required value={pin} onChange={e => setPin(e.target.value)}
            placeholder="Your access PIN"
            style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', fontSize: 15, border: '1px solid #D1D5DB', borderRadius: 8, marginBottom: 20, outline: 'none' }}
          />

          {error && (
            <div style={{ background: '#FEE2E2', color: '#B91C1C', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>
          )}

          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: '12px', fontSize: 15, fontWeight: 600, color: '#fff', background: loading ? '#9CA3AF' : '#111827', border: 'none', borderRadius: 8, cursor: loading ? 'default' : 'pointer' }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: '#9CA3AF' }}>
          Forgot your PIN? Contact your school administrator.
        </div>
      </div>
    </div>
  );

  // ─── SCHEDULE SCREEN ─────────────────────────────────────────────────────
  if (screen === 'schedule' && teacher) return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', paddingBottom: 32 }}>
      <div style={{ background: '#111827', color: '#fff', padding: '20px 16px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, opacity: 0.7 }}>Welcome,</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{teacher.name}</div>
            {teacher.subject && <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{teacher.subject}</div>}
          </div>
          <button onClick={handleLogout}
            style={{ padding: '8px 14px', fontSize: 13, fontWeight: 600, background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, cursor: 'pointer' }}>
            Sign out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Today&apos;s schedule</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>
              {dayOfWeek !== null ? DAY_NAMES[dayOfWeek] : ''}
            </div>
          </div>
          <button onClick={refreshSchedule} disabled={loading}
            style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#374151', background: '#fff', border: '1px solid #D1D5DB', borderRadius: 6, cursor: loading ? 'default' : 'pointer' }}>
            {loading ? '…' : 'Refresh'}
          </button>
        </div>

        {/* Item 10: geo check-in card */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 2 }}>Geo check-in</div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>
                {checkinResult
                  ? (checkinResult.inside
                      ? '✓ Checked in (inside school zone)'
                      : checkinResult.polygon_active
                        ? (checkinResult.late_event_logged
                            ? '⚠ Outside school zone — late event logged'
                            : '⚠ Outside school zone')
                        : 'Checked in (no geofence defined for school)')
                  : 'Tap to share your location and confirm presence at school.'}
              </div>
            </div>
            <button onClick={handleCheckin} disabled={checkingIn}
              style={{ padding: '10px 16px', fontSize: 13, fontWeight: 700, color: '#fff', background: checkingIn ? '#9CA3AF' : '#15803D', border: 'none', borderRadius: 8, cursor: checkingIn ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
              {checkingIn ? 'Locating…' : 'Check in'}
            </button>
          </div>
          {checkinError && (
            <div style={{ background: '#FEE2E2', color: '#B91C1C', padding: '8px 10px', borderRadius: 6, fontSize: 12, marginTop: 10 }}>{checkinError}</div>
          )}
        </div>

        {error && (
          <div style={{ background: '#FEE2E2', color: '#B91C1C', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>
        )}

        {schedule.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>
            No classes scheduled for today.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {schedule.map(entry => (
              <button key={entry.id} onClick={() => openClass(entry)} disabled={!entry.classes}
                style={{ textAlign: 'left', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 16px', cursor: entry.classes ? 'pointer' : 'default', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', marginBottom: 2 }}>
                    PERIOD {entry.period} · {fmtTime(entry.start_time)}–{fmtTime(entry.end_time)}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
                    {entry.classes ? `Class ${entry.classes.grade_level}-${entry.classes.section}` : 'Unassigned class'}
                  </div>
                  {entry.subjects && (
                    <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
                      {entry.subjects.name} ({entry.subjects.code})
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 18, color: '#9CA3AF' }}>›</div>
              </button>
            ))}
          </div>
        )}

        <div style={{ marginTop: 20, fontSize: 11, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.6 }}>
          Tap a class to mark today&apos;s attendance.<br/>
          Attendance is recorded per day, not per period.
        </div>
      </div>
    </div>
  );

  // ─── MARK ATTENDANCE SCREEN ──────────────────────────────────────────────
  if (screen === 'mark_attendance' && activeClass) {
    const counts = students.reduce<Record<AttendanceStatus, number>>((acc, s) => {
      const m = marks[s.id] ?? 'present';
      acc[m] = (acc[m] ?? 0) + 1;
      return acc;
    }, { present: 0, absent: 0, late: 0, excused: 0 });

    return (
      <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', paddingBottom: 100 }}>
        <div style={{ background: '#111827', color: '#fff', padding: '14px 16px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => { setScreen('schedule'); setError(''); setMarkedToast(''); }}
              style={{ padding: '6px 10px', fontSize: 13, background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, cursor: 'pointer' }}>
              ← Back
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, opacity: 0.7 }}>Today&apos;s attendance</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Class {activeClass.grade_level}-{activeClass.section}</div>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {(['present', 'absent', 'late', 'excused'] as AttendanceStatus[]).map(s => (
              <div key={s} style={{ flex: 1, minWidth: 70, textAlign: 'center', background: STATUS_BG[s].bg, color: STATUS_BG[s].color, padding: '8px 4px', borderRadius: 8, border: `1px solid ${STATUS_BG[s].border}` }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{counts[s]}</div>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s}</div>
              </div>
            ))}
          </div>

          {error && (
            <div style={{ background: '#FEE2E2', color: '#B91C1C', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{error}</div>
          )}
          {markedToast && (
            <div style={{ background: '#DCFCE7', color: '#15803D', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{markedToast}</div>
          )}

          {students.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>
              No students in this class.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {students.map(student => {
                const current = marks[student.id] ?? 'present';
                return (
                  <div key={student.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{student.name}</div>
                      {student.roll_number && (
                        <div style={{ fontSize: 11, color: '#6B7280' }}>Roll {student.roll_number}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['present', 'absent', 'late', 'excused'] as AttendanceStatus[]).map(s => (
                        <button key={s}
                          onClick={() => setMarks(prev => ({ ...prev, [student.id]: s }))}
                          style={{
                            flex: 1, padding: '8px 4px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3,
                            background: current === s ? STATUS_BG[s].bg : '#F9FAFB',
                            color: current === s ? STATUS_BG[s].color : '#9CA3AF',
                            border: `1px solid ${current === s ? STATUS_BG[s].border : '#E5E7EB'}`,
                            borderRadius: 6, cursor: 'pointer',
                          }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {students.length > 0 && (
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #E5E7EB', padding: 12 }}>
            <div style={{ maxWidth: 720, margin: '0 auto' }}>
              <button onClick={submitMarks} disabled={savingMarks}
                style={{ width: '100%', padding: '14px', fontSize: 15, fontWeight: 700, color: '#fff', background: savingMarks ? '#9CA3AF' : STATUS_COLOR.present, border: 'none', borderRadius: 10, cursor: savingMarks ? 'default' : 'pointer' }}>
                {savingMarks ? 'Saving…' : `Save attendance (${students.length} students)`}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
