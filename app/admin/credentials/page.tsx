'use client';
import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import Link from 'next/link';

interface ClassRow { class: string; total: number; }
interface StudentRow { id: string; name: string; section: string | null; roll_number: string | null; }
interface SendResult {
  students_targeted: number;
  parent_enqueued: number; student_enqueued: number;
  parent_skipped: number; student_skipped: number;
}

type Scope = 'all' | 'class' | 'students';

const card: CSSProperties = { background: '#fff', borderRadius: 14, boxShadow: '0 1px 3px rgba(16,24,40,0.06)', border: '1px solid #EEF0F3' };
const label: CSSProperties = { fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4 };

export default function AdminCredentialsPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [scope, setScope] = useState<Scope>('all');
  const [selectedClass, setSelectedClass] = useState('');
  const [classStudents, setClassStudents] = useState<StudentRow[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [sendParent, setSendParent] = useState(true);
  const [sendStudent, setSendStudent] = useState(false);
  const [regenerate, setRegenerate] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/credentials')
      .then(r => r.ok ? r.json() : { classes: [], total_students: 0 })
      .then(d => { setClasses(d.classes ?? []); setTotalStudents(d.total_students ?? 0); })
      .catch(() => {});
  }, []);

  const loadClassStudents = useCallback((cls: string) => {
    if (!cls) { setClassStudents([]); return; }
    fetch('/api/admin/credentials?class=' + encodeURIComponent(cls))
      .then(r => r.ok ? r.json() : { students: [] })
      .then(d => setClassStudents(d.students ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if ((scope === 'class' || scope === 'students') && selectedClass) loadClassStudents(selectedClass);
  }, [scope, selectedClass, loadClassStudents]);

  const classCount = (cls: string) => classes.find(c => c.class === cls)?.total ?? 0;
  const targetCount =
    scope === 'all' ? totalStudents :
    scope === 'class' ? classCount(selectedClass) :
    picked.size;

  function togglePick(id: string) {
    setPicked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function doSend() {
    setSending(true); setError(null); setResult(null);
    try {
      const payload: Record<string, unknown> = { scope, send_parent: sendParent, send_student: sendStudent, regenerate };
      if (scope === 'class') payload.class = selectedClass;
      if (scope === 'students') payload.student_ids = [...picked];
      const r = await fetch('/api/admin/credentials', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Could not send.'); return; }
      setResult(d as SendResult);
    } catch (e) {
      setError('Error: ' + (e as Error).message);
    } finally {
      setSending(false); setConfirming(false);
    }
  }

  const canSend = targetCount > 0 && (sendParent || sendStudent) &&
    (scope !== 'class' || !!selectedClass) && (scope !== 'students' || picked.size > 0);

  const scopeTab = (val: Scope, text: string) => (
    <button onClick={() => { setScope(val); setResult(null); setError(null); }}
      style={{ flex: 1, padding: '10px 0', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
        color: scope === val ? '#fff' : '#4B5563', background: scope === val ? '#4F46E5' : '#F3F4F6',
        border: 0, borderRadius: 10 }}>
      {text}
    </button>
  );

  const toggle = (on: boolean, set: (v: boolean) => void, title: string, sub: string) => (
    <button onClick={() => set(!on)}
      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
        padding: 12, background: on ? '#EEF2FF' : '#fff', border: `1px solid ${on ? '#C7D2FE' : '#E5E7EB'}`,
        borderRadius: 10, cursor: 'pointer' }}>
      <div style={{ width: 38, height: 22, borderRadius: 99, background: on ? '#4F46E5' : '#D1D5DB', flexShrink: 0, position: 'relative', transition: 'background .15s' }}>
        <div style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: 99, background: '#fff', transition: 'left .15s' }} />
      </div>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#111827' }}>{title}</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{sub}</div>
      </div>
    </button>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#F4F5F7', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <div style={{ background: 'linear-gradient(135deg,#4F46E5 0%,#6D28D9 100%)', padding: '16px 20px 22px' }}>
          <Link href="/admin" style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, textDecoration: 'none', display: 'inline-block', marginBottom: 10 }}>← Admin</Link>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>Send login credentials</div>
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.82)', marginTop: 2 }}>Bulk-send EdProSys login PINs by SMS to parents and students.</div>
        </div>

        <div style={{ padding: 16 }}>
          {/* scope */}
          <div style={{ ...card, padding: 16, marginBottom: 14 }}>
            <div style={label}>Who to send to</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              {scopeTab('all', `Everyone (${totalStudents})`)}
              {scopeTab('class', 'By class')}
              {scopeTab('students', 'Individual')}
            </div>

            {(scope === 'class' || scope === 'students') && (
              <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setPicked(new Set()); }}
                style={{ marginTop: 12, width: '100%', padding: '11px 12px', fontSize: 14, borderRadius: 10, border: '1px solid #D1D5DB', background: '#fff', color: '#111827' }}>
                <option value="">Select a class…</option>
                {classes.map(c => <option key={c.class} value={c.class}>Class {c.class} · {c.total} students</option>)}
              </select>
            )}

            {scope === 'students' && selectedClass && (
              <div style={{ marginTop: 12, maxHeight: 260, overflowY: 'auto', border: '1px solid #EEF0F3', borderRadius: 10 }}>
                {classStudents.length === 0 ? (
                  <div style={{ padding: 16, fontSize: 13, color: '#9CA3AF', textAlign: 'center' }}>No students.</div>
                ) : classStudents.map(s => (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid #F3F4F6', cursor: 'pointer' }}>
                    <input type="checkbox" checked={picked.has(s.id)} onChange={() => togglePick(s.id)} style={{ width: 16, height: 16 }} />
                    <span style={{ fontSize: 13.5, color: '#111827', flex: 1 }}>{s.name}</span>
                    <span style={{ fontSize: 12, color: '#9CA3AF' }}>{[s.section && `Sec ${s.section}`, s.roll_number && `Roll ${s.roll_number}`].filter(Boolean).join(' · ')}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* recipients */}
          <div style={{ ...card, padding: 16, marginBottom: 14 }}>
            <div style={{ ...label, marginBottom: 10 }}>What to send</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {toggle(sendParent, setSendParent, 'Parent logins', 'Phone + PIN, sent to the parent')}
              {toggle(sendStudent, setSendStudent, 'Student logins', "Student PIN, sent to the parent's phone")}
              {toggle(regenerate, setRegenerate, 'Regenerate PIN if needed', 'Issue a fresh PIN where an existing one can’t be read back (already-active logins)')}
            </div>
          </div>

          {error && (
            <div style={{ marginBottom: 14, padding: '11px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}>⚠ {error}</div>
          )}

          {result ? (
            <div style={{ ...card, padding: 18, marginBottom: 14, border: '1px solid #BBF7D0', background: '#F0FDF4' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#15803D' }}>✓ Queued for {result.students_targeted} students</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                {[
                  { k: 'Parent SMS queued', v: result.parent_enqueued },
                  { k: 'Student SMS queued', v: result.student_enqueued },
                  { k: 'Parent skipped', v: result.parent_skipped },
                  { k: 'Student skipped', v: result.student_skipped },
                ].map(x => (
                  <div key={x.k} style={{ background: '#fff', borderRadius: 10, padding: '10px 12px', border: '1px solid #DCFCE7' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>{x.v}</div>
                    <div style={{ fontSize: 11.5, color: '#6B7280' }}>{x.k}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11.5, color: '#15803D', marginTop: 12 }}>
                Delivery runs on the SMS dispatch cron. Skipped = no parent phone, or an active login whose PIN can’t be read back (turn on “Regenerate PIN” to force a reset).
              </div>
              <button onClick={() => setResult(null)} style={{ marginTop: 12, padding: '9px 16px', fontSize: 13, fontWeight: 700, color: '#4F46E5', background: '#fff', border: '1px solid #C7D2FE', borderRadius: 9, cursor: 'pointer' }}>Send another batch</button>
            </div>
          ) : confirming ? (
            <div style={{ ...card, padding: 16, marginBottom: 14, border: '1px solid #FDE68A', background: '#FFFBEB' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#92400E' }}>Send login PINs by SMS?</div>
              <div style={{ fontSize: 12.5, color: '#92400E', marginTop: 4, lineHeight: 1.5 }}>
                {targetCount} students · {[sendParent && 'parent logins', sendStudent && 'student logins'].filter(Boolean).join(' + ')}{regenerate ? ' · regenerate PINs' : ''}. This sends real SMS once the credentials template is live.
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={() => setConfirming(false)} disabled={sending} style={{ flex: 1, padding: '11px 0', fontSize: 13.5, fontWeight: 700, color: '#92400E', background: '#fff', border: '1px solid #FDE68A', borderRadius: 10, cursor: 'pointer' }}>Cancel</button>
                <button onClick={doSend} disabled={sending} style={{ flex: 2, padding: '11px 0', fontSize: 13.5, fontWeight: 800, color: '#fff', background: sending ? '#A5B4FC' : 'linear-gradient(180deg,#6366F1,#4F46E5)', border: 0, borderRadius: 10, cursor: sending ? 'default' : 'pointer' }}>{sending ? 'Sending…' : `Yes, send to ${targetCount}`}</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirming(true)} disabled={!canSend}
              style={{ width: '100%', padding: '14px 0', fontSize: 15, fontWeight: 800, color: '#fff',
                background: canSend ? 'linear-gradient(180deg,#6366F1,#4F46E5)' : '#C7D2FE', border: 0, borderRadius: 12,
                cursor: canSend ? 'pointer' : 'default', boxShadow: canSend ? '0 1px 2px rgba(79,70,229,0.4)' : 'none' }}>
              Send to {targetCount} student{targetCount === 1 ? '' : 's'}
            </button>
          )}

          <div style={{ textAlign: 'center', marginTop: 14, fontSize: 11, color: '#9CA3AF', lineHeight: 1.5 }}>
            🔒 PINs are delivered over DLT-approved transactional SMS. Only owners, principals and admins can send credentials.
          </div>
        </div>
      </div>
    </div>
  );
}
