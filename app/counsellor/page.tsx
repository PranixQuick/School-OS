'use client';
import { useState, useEffect, useCallback, type ReactNode } from 'react';
import Layout from '@/components/Layout';

interface AtRisk { id: string; student_id: string; name: string; class: string; risk_level: string | null; ai_summary: string | null; attendance_pct: number | null; avg_score: number | null; fee_overdue: boolean | null; }
interface FollowUp { id: string; student_id: string; name: string; class: string; session_date: string; concern: string | null; action_taken: string | null; follow_up_date: string | null; }
interface Sess { id: string; student_id: string; name: string; class: string; session_date: string; concern: string | null; action_taken: string | null; follow_up_date: string | null; follow_up_done: boolean; }
interface DashData { at_risk: AtRisk[]; follow_ups: FollowUp[]; recent_sessions: Sess[]; counts: { at_risk: number; follow_ups: number }; }

const RISK_COLOR: Record<string, string> = { high: '#B91C1C', medium: '#C2410C', low: '#15803D' };

export default function CounsellorPage() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [formFor, setFormFor] = useState<{ id: string; name: string } | null>(null);
  const [concern, setConcern] = useState('');
  const [action, setAction] = useState('');
  const [followDate, setFollowDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/counsellor/dashboard');
      if (r.ok) setData(await r.json() as DashData);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  function showToast(m: string) { setToast(m); setTimeout(() => setToast(''), 3000); }

  function openForm(student_id: string, name: string) {
    setFormFor({ id: student_id, name }); setConcern(''); setAction(''); setFollowDate('');
  }

  async function saveSession() {
    if (!formFor) return;
    if (!concern.trim() && !action.trim()) { showToast('Enter a concern or action'); return; }
    setSaving(true);
    try {
      const r = await fetch('/api/counsellor/sessions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: formFor.id, concern, action_taken: action, follow_up_date: followDate || null }),
      });
      if (r.ok) { showToast('Session logged'); setFormFor(null); void load(); }
      else { const d = await r.json().catch(() => ({})) as { error?: string }; showToast(d.error ?? 'Failed'); }
    } catch { showToast('Network error'); }
    setSaving(false);
  }

  async function markDone(id: string) {
    try {
      const r = await fetch('/api/counsellor/sessions', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, follow_up_done: true }),
      });
      if (r.ok) { showToast('Follow-up marked done'); void load(); } else showToast('Failed');
    } catch { showToast('Network error'); }
  }

  const atRisk = data?.at_risk ?? [];
  const followUps = data?.follow_ups ?? [];
  const recent = data?.recent_sessions ?? [];

  return (
    <Layout title="Counsellor" subtitle="Student wellbeing & support">
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: '#111827', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>{toast}</div>}

      {formFor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 440 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginBottom: 12 }}>Log session: {formFor.name}</div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>Concern discussed</label>
            <textarea value={concern} onChange={e => setConcern(e.target.value)} rows={2} style={{ width: '100%', border: '1px solid #D1D5DB', borderRadius: 7, padding: 8, fontSize: 13, boxSizing: 'border-box', marginBottom: 10, fontFamily: 'inherit' }} />
            <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>Action taken</label>
            <textarea value={action} onChange={e => setAction(e.target.value)} rows={2} style={{ width: '100%', border: '1px solid #D1D5DB', borderRadius: 7, padding: 8, fontSize: 13, boxSizing: 'border-box', marginBottom: 10, fontFamily: 'inherit' }} />
            <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>Follow-up date (optional)</label>
            <input type="date" value={followDate} onChange={e => setFollowDate(e.target.value)} style={{ width: '100%', height: 38, border: '1px solid #D1D5DB', borderRadius: 7, padding: '0 10px', fontSize: 13, boxSizing: 'border-box', marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => void saveSession()} disabled={saving} style={{ padding: '8px 16px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{saving ? 'Saving…' : 'Save'}</button>
              <button onClick={() => setFormFor(null)} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>Loading…</div> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#B91C1C' }}>{atRisk.length}</div>
              <div style={{ fontSize: 12, color: '#7F1D1D' }}>At-risk students</div>
            </div>
            <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#C2410C' }}>{followUps.length}</div>
              <div style={{ fontSize: 12, color: '#9A3412' }}>Open follow-ups</div>
            </div>
          </div>

          <SectionTitle>At-risk students</SectionTitle>
          {atRisk.length === 0 ? <Empty text="No students currently flagged." /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
              {atRisk.map(s => (
                <div key={s.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{s.name}{s.class && <span style={{ fontSize: 12, fontWeight: 500, color: '#6B7280' }}> · {s.class}</span>}</div>
                      {s.ai_summary && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{s.ai_summary}</div>}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                        {s.attendance_pct != null && <Tag>Attendance {Math.round(Number(s.attendance_pct))}%</Tag>}
                        {s.avg_score != null && <Tag>Avg {Math.round(Number(s.avg_score))}%</Tag>}
                        {s.fee_overdue && <Tag>Fee overdue</Tag>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: RISK_COLOR[(s.risk_level ?? '').toLowerCase()] ?? '#6B7280' }}>{s.risk_level ?? '—'}</span>
                      <button onClick={() => openForm(s.student_id, s.name)} style={{ fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 7, border: '1px solid #C7D2FE', background: '#EEF2FF', color: '#4F46E5', cursor: 'pointer' }}>Log session</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <SectionTitle>Follow-ups</SectionTitle>
          {followUps.length === 0 ? <Empty text="No open follow-ups." /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
              {followUps.map(f => (
                <div key={f.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{f.name}{f.class && <span style={{ fontSize: 12, fontWeight: 500, color: '#6B7280' }}> · {f.class}</span>}</div>
                    {f.concern && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{f.concern}</div>}
                    {f.follow_up_date && <div style={{ fontSize: 11, color: '#C2410C', marginTop: 2 }}>Follow-up due {f.follow_up_date}</div>}
                  </div>
                  <button onClick={() => void markDone(f.id)} style={{ fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 7, border: '1px solid #BBF7D0', background: '#F0FDF4', color: '#065F46', cursor: 'pointer', flexShrink: 0 }}>Mark done</button>
                </div>
              ))}
            </div>
          )}

          <SectionTitle>Recent sessions</SectionTitle>
          {recent.length === 0 ? <Empty text="No sessions logged yet." /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recent.map(r => (
                <div key={r.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{r.name}{r.class && <span style={{ fontSize: 12, fontWeight: 500, color: '#6B7280' }}> · {r.class}</span>}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>{r.session_date}</div>
                  </div>
                  {r.concern && <div style={{ fontSize: 12, color: '#374151', marginTop: 3 }}><b>Concern:</b> {r.concern}</div>}
                  {r.action_taken && <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}><b>Action:</b> {r.action_taken}</div>}
                  {r.follow_up_date && <div style={{ fontSize: 11, color: r.follow_up_done ? '#15803D' : '#C2410C', marginTop: 2 }}>{r.follow_up_done ? 'Follow-up done' : `Follow-up due ${r.follow_up_date}`}</div>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Layout>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 8 }}>{children}</div>;
}
function Empty({ text }: { text: string }) {
  return <div style={{ background: '#F9FAFB', border: '1px dashed #E5E7EB', borderRadius: 10, padding: 20, textAlign: 'center', color: '#9CA3AF', fontSize: 13, marginBottom: 22 }}>{text}</div>;
}
function Tag({ children }: { children: ReactNode }) {
  return <span style={{ fontSize: 11, fontWeight: 600, color: '#4B5563', background: '#F3F4F6', borderRadius: 6, padding: '2px 8px' }}>{children}</span>;
}
