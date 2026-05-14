'use client';
// app/automation/teacher-attendance/page.tsx
// Batch 3B patch: added offline detection, offline banner, and offline queue fallback.
// When offline: markAttendance queues the record in IndexedDB instead of fetching.
// On reconnect: syncOfflineQueue auto-syncs all pending records.

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';
import { queueTeacherAttendance, syncOfflineQueue, getPendingQueue } from '@/lib/offline-queue';

interface StaffRecord {
  id: string; name: string; role: string; subject: string | null;
  attendance_id: string | null; status: string; check_in_time: string | null; marked_via: string | null;
}

interface AttSummary { present: number; absent: number; late: number; not_marked: number; }

const STATUS_OPTIONS = ['present', 'absent', 'late', 'half_day', 'leave'];

const STATUS_BADGE: Record<string, string> = {
  present: 'badge-done', absent: 'badge-low', late: 'badge-medium',
  half_day: 'badge-medium', leave: 'badge-gray', not_marked: 'badge-gray',
};

const STATUS_COLOR: Record<string, string> = {
  present: '#15803D', absent: '#B91C1C', late: '#A16207',
  half_day: '#A16207', leave: '#6B7280', not_marked: '#9CA3AF',
};

export default function TeacherAttendancePage() {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [summary, setSummary] = useState<AttSummary>({ present: 0, absent: 0, late: 0, not_marked: 0 });
  const [saving, setSaving] = useState<string | null>(null);
  const [bulkMarking, setBulkMarking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingSync, setPendingSync] = useState(0);

  useEffect(() => { void fetchAttendance(); }, [date]);

  // Online/offline event listeners + auto-sync on reconnect
  useEffect(() => {
    const onOnline = async () => {
      setIsOnline(true);
      const { synced } = await syncOfflineQueue();
      if (synced > 0) {
        console.log('[Offline] Synced', synced, 'attendance records');
        void fetchAttendance(); // Refresh view after sync
      }
      const pending = await getPendingQueue();
      setPendingSync(pending.length);
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    void getPendingQueue().then((p) => setPendingSync(p.length));
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  async function fetchAttendance() {
    setLoading(true);
    try {
      const res = await fetch(`/api/teacher-attendance?date=${date}`);
      if (!res.ok) throw new Error('fetch failed');
      const d = await res.json() as { staff?: StaffRecord[]; summary?: AttSummary; error?: string };
      if (d.error) throw new Error(d.error);
      setStaff(d.staff ?? []);
      setSummary(d.summary ?? { present: 0, absent: 0, late: 0, not_marked: 0 });
    } catch (err) {
      console.error('Teacher attendance fetch error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function markAttendance(staffId: string, status: string) {
    setSaving(staffId);
    const now = new Date();
    const checkIn = status === 'present' || status === 'late'
      ? `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:00`
      : undefined;

    try {
      if (!navigator.onLine) throw new Error('offline');
      await fetch('/api/teacher-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: staffId, date, status, check_in_time: checkIn, marked_via: 'portal' }),
      });
      void fetchAttendance();
    } catch {
      // Offline fallback: queue locally, update UI optimistically
      await queueTeacherAttendance({
        staff_id: staffId, date, status, check_in_time: checkIn,
      });
      setPendingSync((p) => p + 1);
      // Optimistic UI update
      setStaff((prev) => prev.map((s) =>
        s.id === staffId ? { ...s, status, check_in_time: checkIn ?? s.check_in_time, marked_via: 'offline' } : s
      ));
      setSummary((prev) => {
        const updated = { ...prev };
        if (prev.not_marked > 0 && status !== 'not_marked') updated.not_marked--;
        if (status === 'present') updated.present++;
        if (status === 'absent') updated.absent++;
        if (status === 'late') updated.late++;
        return updated;
      });
    }
    setSaving(null);
  }

  async function markAllPresent() {
    setBulkMarking(true);
    const notMarked = staff.filter(s => s.status === 'not_marked');
    await Promise.all(notMarked.map(s => markAttendance(s.id, 'present')));
    setBulkMarking(false);
  }

  const presentPct = staff.length > 0 ? Math.round((summary.present / staff.length) * 100) : 0;

  return (
    <Layout
      title="Teacher Attendance"
      subtitle="Daily staff attendance marking"
      actions={
        <Link href="/automation" className="btn btn-ghost btn-sm">← Automation</Link>
      }
    >
      {/* Offline banner */}
      {!isOnline && (
        <div style={{ background: '#FEF9C3', border: '1px solid #FCD34D', color: '#92400E',
          padding: '8px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8, marginBottom: 12 }}>
          ⚠️ You&apos;re offline. Attendance will be saved locally and synced when connection is restored.
        </div>
      )}
      {pendingSync > 0 && isOnline && (
        <div style={{ background: '#EEF2FF', color: '#4338CA', padding: '6px 12px',
          fontSize: 11, fontWeight: 600, borderRadius: 6, marginBottom: 10 }}>
          🔄 {pendingSync} offline record{pendingSync !== 1 ? 's' : ''} syncing…
        </div>
      )}

      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <label className="label">DATE</label>
          <input
            type="date"
            className="input"
            style={{ width: 180, height: 38 }}
            value={date}
            onChange={e => setDate(e.target.value)}
            max={today}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, auto)', gap: 10, marginTop: 20 }}>
          {[
            { l: 'Present', v: summary.present, c: '#15803D', bg: '#DCFCE7' },
            { l: 'Absent', v: summary.absent, c: '#B91C1C', bg: '#FEE2E2' },
            { l: 'Late', v: summary.late, c: '#A16207', bg: '#FEF9C3' },
            { l: 'Unmarked', v: summary.not_marked, c: '#9CA3AF', bg: '#F3F4F6' },
          ].map(k => (
            <div key={k.l} style={{ background: k.bg, borderRadius: 10, padding: '10px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: k.c }}>{k.v}</div>
              <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>{k.l}</div>
            </div>
          ))}
        </div>

        {summary.not_marked > 0 && (
          <button
            onClick={() => void markAllPresent()}
            disabled={bulkMarking}
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 20, background: '#DCFCE7', borderColor: '#BBF7D0', color: '#15803D' }}
          >
            {bulkMarking ? 'Marking...' : `✓ Mark All ${summary.not_marked} Unmarked as Present`}
          </button>
        )}
      </div>

      {staff.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
            <span style={{ fontWeight: 600, color: '#111827' }}>Attendance Rate</span>
            <span style={{ fontWeight: 700, color: presentPct >= 80 ? '#15803D' : presentPct >= 60 ? '#A16207' : '#B91C1C' }}>
              {presentPct}%
            </span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${presentPct}%`,
                background: presentPct >= 80 ? '#22C55E' : presentPct >= 60 ? '#F59E0B' : '#EF4444',
              }}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="card">
          <div className="empty-state">
            <div style={{ width: 24, height: 24, border: '3px solid #E5E7EB', borderTop: '3px solid #4F46E5', borderRadius: '50%', animation: 'os_spin 0.7s linear infinite', marginBottom: 12 }} />
            <div className="empty-state-title">Loading attendance...</div>
          </div>
        </div>
      ) : staff.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">✅</div>
            <div className="empty-state-title">No staff found</div>
            <div className="empty-state-sub">Ensure staff are added in the system.</div>
          </div>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Teacher</th>
                <th>Role / Subject</th>
                <th>Check-in</th>
                <th>Status</th>
                <th>Mark Attendance</th>
              </tr>
            </thead>
            <tbody>
              {staff.map(s => (
                <tr key={s.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#4F46E5' }}>
                        {s.name.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                        {s.marked_via && <div style={{ fontSize: 11, color: '#9CA3AF' }}>via {s.marked_via}</div>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>
                      {s.role.charAt(0).toUpperCase() + s.role.slice(1)}
                    </div>
                    {s.subject && <div style={{ fontSize: 12, color: '#9CA3AF' }}>{s.subject}</div>}
                  </td>
                  <td style={{ fontSize: 13, color: '#374151' }}>{s.check_in_time ?? '—'}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[s.status] ?? 'badge-gray'}`} style={{ fontSize: 11 }}>
                      {s.status === 'not_marked' ? 'NOT MARKED' : s.status.toUpperCase().replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {STATUS_OPTIONS.map(status => (
                        <button
                          key={status}
                          onClick={() => void markAttendance(s.id, status)}
                          disabled={saving === s.id}
                          style={{
                            height: 28, padding: '0 10px', borderRadius: 6,
                            border: `1px solid ${s.status === status ? STATUS_COLOR[status] : '#E5E7EB'}`,
                            background: s.status === status ? STATUS_COLOR[status] + '15' : '#fff',
                            color: s.status === status ? STATUS_COLOR[status] : '#9CA3AF',
                            fontSize: 11, fontWeight: 700, cursor: 'pointer',
                            fontFamily: 'inherit', opacity: saving === s.id ? 0.5 : 1,
                          }}
                        >
                          {status.charAt(0).toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 14, display: 'flex', gap: 14, fontSize: 12, color: '#9CA3AF', flexWrap: 'wrap' }}>
        {STATUS_OPTIONS.map(s => (
          <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              width: 18, height: 18, borderRadius: 4,
              border: '1px solid', borderColor: STATUS_COLOR[s],
              background: STATUS_COLOR[s] + '15',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 10, color: STATUS_COLOR[s],
            }}>
              {s.charAt(0).toUpperCase()}
            </span>
            {s.replace('_', ' ')}
          </span>
        ))}
      </div>
    </Layout>
  );
}
