'use client';
import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import { T } from '@/lib/i18n';
import { useLang } from '@/lib/useLang';

interface FeeRecord {
  id: string; students?: { name: string; class: string; section: string } | null;
  fee_type: string; amount: number; due_date: string;
  status: 'paid' | 'pending' | 'overdue'; paid_at?: string;
}

interface StudentLite { id: string; name: string; class: string; section: string; admission_number?: string; }

const STATUS_COLOR = { paid: '#15803D', pending: '#A16207', overdue: '#B91C1C' };
const STATUS_BG = { paid: '#DCFCE7', pending: '#FEF9C3', overdue: '#FEE2E2' };
// Mirrors the fee_type whitelist used by the fee importer; POST /api/admin/fees
// accepts any string and defaults to 'tuition'.
const FEE_TYPES = ['tuition', 'transport', 'hostel', 'exam', 'library', 'lab', 'admission', 'uniform', 'books', 'misc', 'other'];

const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', margin: '10px 0 4px' } as const;
const inputStyle = { width: '100%', padding: '9px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const, background: '#F9FAFB' };

export default function FeesPage() {
  const { lang } = useLang();
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all'|'pending'|'overdue'|'paid'>('all');
  const [search, setSearch] = useState('');
  const [actionId, setActionId] = useState<string|null>(null);
  const [payError, setPayError] = useState('');
  const [stats, setStats] = useState({ total: 0, paid: 0, pending: 0, overdue: 0, collected: 0, outstanding: 0 });

  // ── Add Fee: direct creation via the existing POST /api/admin/fees ──
  const todayIso = new Date().toISOString().slice(0, 10);
  const [showAdd, setShowAdd] = useState(false);
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState('');
  const [form, setForm] = useState({ student_id: '', amount: '', due_date: todayIso, fee_type: 'tuition', description: '' });

  const loadFees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/fees');
      if (!res.ok) throw new Error('Failed');
      const d = await res.json();
      const list: FeeRecord[] = d.fees ?? [];
      setFees(list);
      setStats({
        total: list.length,
        paid: list.filter(f => f.status === 'paid').length,
        pending: list.filter(f => f.status === 'pending').length,
        overdue: list.filter(f => f.status === 'overdue').length,
        collected: list.filter(f => f.status === 'paid').reduce((s, f) => s + f.amount, 0),
        outstanding: list.filter(f => f.status !== 'paid').reduce((s, f) => s + f.amount, 0),
      });
    } catch { /* keep empty state */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadFees(); }, [loadFees]);

  async function openAddFee() {
    setAddError('');
    setForm({ student_id: '', amount: '', due_date: todayIso, fee_type: 'tuition', description: '' });
    setShowAdd(true);
    if (!studentsLoaded) {
      try {
        const res = await fetch('/api/students');
        if (res.ok) {
          const d = await res.json() as { students?: StudentLite[] };
          setStudents((d.students ?? []).map(s => ({
            id: s.id, name: s.name, class: s.class, section: s.section, admission_number: s.admission_number,
          })));
          setStudentsLoaded(true);
        }
      } catch { /* student list optional */ }
    }
  }

  async function submitFee() {
    setAddError('');
    const amountNum = Number(form.amount);
    if (!form.student_id) { setAddError('Select a student.'); return; }
    if (!Number.isFinite(amountNum) || amountNum <= 0) { setAddError('Amount must be greater than 0.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.due_date)) { setAddError('A valid due date is required.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: form.student_id,
          amount: amountNum,
          due_date: form.due_date,
          fee_type: form.fee_type,
          description: form.description || undefined,
        }),
      });
      const d = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) { setAddError(d.error ?? 'Could not create fee.'); return; }
      setShowAdd(false);
      await loadFees();
    } catch { setAddError('Network error. Please try again.'); }
    finally { setSaving(false); }
  }

  async function markPaid(id: string) {
    setPayError('');
    setActionId(id);
    try {
      // Collection uses the dedicated endpoint (cash mode). The collection-level
      // PATCH /api/admin/fees does not exist (GET + POST only) — calling it 405s.
      const res = await fetch(`/api/admin/fees/${id}/mark-paid`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'cash' }),
      });
      const d = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) { setPayError(d.error ?? 'Could not mark this fee paid.'); return; }
      await loadFees();
    } catch { setPayError('Network error. Please try again.'); }
    finally { setActionId(null); }
  }

  const visible = fees.filter(f => {
    if (filter !== 'all' && f.status !== filter) return false;
    if (search && !(f.students?.name ?? '').toLowerCase().includes(search.toLowerCase()) &&
        !(f.students?.class ?? '').includes(search)) return false;
    return true;
  });

  return (
    <Layout title={T('fee_management', lang)} subtitle="Track collections, send reminders, mark payments"
      actions={
        <button onClick={() => void openAddFee()} className="btn btn-primary btn-sm">+ Add Fee</button>
      }>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: T('collected_label', lang as never), value: `₹${(stats.collected/1000).toFixed(1)}K`, color: '#15803D', bg: '#DCFCE7' },
          { label: T('outstanding_label', lang as never), value: `₹${(stats.outstanding/1000).toFixed(1)}K`, color: '#B91C1C', bg: '#FEE2E2' },
          { label: T('overdue', lang as never), value: stats.overdue, color: '#B91C1C', bg: '#FEE2E2' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter + search */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search student or class…" className="input"
          style={{ flex: 1, minWidth: 160, height: 36, fontSize: 13 }} />
        {(['all','pending','overdue','paid'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            style={{ padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: filter === s ? '#4F46E5' : '#F3F4F6',
              color: filter === s ? '#fff' : '#374151', fontSize: 12, fontWeight: 600 }}>
            {[T('all_students', lang as never),T('pending', lang as never),T('overdue', lang as never),T('paid', lang as never)][{all:0,pending:1,overdue:2,paid:3}[s] ?? 0] + ' (' + [stats.total,stats.pending,stats.overdue,stats.paid][{all:0,pending:1,overdue:2,paid:3}[s] ?? 0] + ')'}
          </button>
        ))}
      </div>

      {/* Fee list */}
      {payError && (
        <div style={{ background: '#FEE2E2', color: '#B91C1C', borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
          {payError}
        </div>
      )}
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading fees…</div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">💰</div>
          <div className="empty-state-title">{T('no_fees', lang as never)} {filter !== 'all' ? `with status "${filter}"` : ''}</div>
          <div className="empty-state-sub">Use “+ Add Fee” to create a fee for a student.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {visible.map((fee, i) => (
            <div key={fee.id} style={{
              padding: '12px 16px', borderBottom: i < visible.length-1 ? '1px solid #F3F4F6' : 'none',
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap'
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 2 }}>{fee.students?.name ?? '—'}</div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>
                  Class {fee.students?.class}{fee.students?.section} · {fee.fee_type} · Due {new Date(fee.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>₹{fee.amount.toLocaleString('en-IN')}</div>
                <span style={{ display: 'inline-block', marginTop: 3, padding: '2px 8px', borderRadius: 6,
                  background: STATUS_BG[fee.status], color: STATUS_COLOR[fee.status],
                  fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                  {fee.status}
                </span>
              </div>
              {fee.status !== 'paid' && (
                <button onClick={() => markPaid(fee.id)} disabled={actionId === fee.id}
                  style={{ padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: '#4F46E5', color: '#fff', fontSize: 12, fontWeight: 600,
                    opacity: actionId === fee.id ? 0.6 : 1 }}>
                  {actionId === fee.id ? T('loading', lang as never) : T('mark_paid_btn', lang as never)}
                </button>
              )}
              {fee.status === 'paid' && (
                <a href={`/admin/fees/receipt/${fee.id}`} target="_blank" rel="noopener noreferrer"
                  style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #E5E7EB', cursor: 'pointer',
                    background: '#fff', color: '#4F46E5', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                  🧾 Receipt
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Fee modal — posts to existing POST /api/admin/fees */}
      {showAdd && (
        <div onClick={() => { if (!saving) setShowAdd(false); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 14, padding: 20, width: '100%', maxWidth: 420, boxShadow: '0 10px 40px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginBottom: 6 }}>Add Fee</div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>Create a fee record for a student.</div>

            <label style={labelStyle}>Student *</label>
            <select value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })} style={inputStyle}>
              <option value="">{studentsLoaded ? 'Select a student…' : 'Loading students…'}</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} — Class {s.class}{s.section ? '-' + s.section : ''}{s.admission_number ? ` (${s.admission_number})` : ''}
                </option>
              ))}
            </select>

            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Amount (₹) *</label>
                <input type="number" min="1" step="0.01" value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })} style={inputStyle} placeholder="0" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Due date *</label>
                <input type="date" value={form.due_date}
                  onChange={e => setForm({ ...form, due_date: e.target.value })} style={inputStyle} />
              </div>
            </div>

            <label style={labelStyle}>Fee type</label>
            <select value={form.fee_type} onChange={e => setForm({ ...form, fee_type: e.target.value })} style={inputStyle}>
              {FEE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            <label style={labelStyle}>Description</label>
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              style={inputStyle} placeholder="Optional" />

            {addError && <div style={{ color: '#B91C1C', fontSize: 12, marginTop: 10 }}>{addError}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setShowAdd(false)} disabled={saving}
                style={{ flex: 1, height: 42, borderRadius: 9, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
              <button onClick={() => void submitFee()} disabled={saving}
                style={{ flex: 1, height: 42, borderRadius: 9, border: 'none', background: saving ? '#9CA3AF' : '#4F46E5', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Saving…' : 'Create Fee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
