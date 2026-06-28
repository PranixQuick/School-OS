'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Layout from '@/components/Layout';
import { T } from '@/lib/i18n';
import { useLang } from '@/lib/useLang';
import { FEE_CATALOG, FEE_GROUPS, feeTypeDef, type FeeTypeDef } from '@/lib/fee-catalog';

interface FeeRecord {
  id: string; students?: { name: string; class: string; section: string } | null;
  fee_type: string; amount: number; original_amount?: number | null; due_date: string;
  status: string; paid_at?: string;
  description?: string | null; discount_amount?: number | null;
  payment_method?: string | null; payment_reference?: string | null;
}

interface StudentLite {
  id: string; name: string; class: string; section: string;
  admission_number?: string; institution_id?: string; institution_name?: string;
}

const STATUS_COLOR: Record<string, string> = { paid: '#15803D', pending: '#A16207', overdue: '#B91C1C', waived: '#6D28D9', partial: '#0E7490', pending_verification: '#A16207' };
const STATUS_BG: Record<string, string> = { paid: '#DCFCE7', pending: '#FEF9C3', overdue: '#FEE2E2', waived: '#EDE9FE', partial: '#CFFAFE', pending_verification: '#FEF9C3' };

// How a fee was settled (institution collects directly — EdProSys never holds funds).
const PAY_METHODS: { key: string; label: string; icon: string; needsRef?: boolean }[] = [
  { key: 'cash', label: 'Cash', icon: '💵' },
  { key: 'upi', label: 'UPI', icon: '📲', needsRef: true },
  { key: 'bank_transfer', label: 'Bank transfer', icon: '🏦', needsRef: true },
  { key: 'cheque', label: 'Cheque / DD', icon: '🧾', needsRef: true },
  { key: 'waiver', label: 'Waiver', icon: '🎟️' },
  { key: 'other', label: 'Other', icon: '➕' },
];
const SETTLED = new Set(['paid', 'waived']);

const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', margin: '10px 0 4px' } as const;
const inputStyle = { width: '100%', padding: '9px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const, background: '#F9FAFB' };
const INR = (n: number) => '₹' + (Number(n) || 0).toLocaleString('en-IN');

type TargetMode = 'all' | 'class' | 'section' | 'institution' | 'students';

export default function FeesPage() {
  const { lang } = useLang();
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [viewerRole, setViewerRole] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'overdue' | 'paid'>('all');
  const [search, setSearch] = useState('');
  const [payError, setPayError] = useState('');
  const [stats, setStats] = useState({ total: 0, paid: 0, pending: 0, overdue: 0, collected: 0, outstanding: 0 });

  const todayIso = new Date().toISOString().slice(0, 10);
  const isOwner = viewerRole === 'owner';

  // ── shared student roster (loaded once, used by both Add and Bulk) ──
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const loadStudents = useCallback(async () => {
    if (studentsLoaded) return;
    try {
      const res = await fetch('/api/students');
      if (res.ok) {
        const d = await res.json() as { students?: StudentLite[] };
        setStudents((d.students ?? []).map(s => ({
          id: s.id, name: s.name, class: s.class, section: s.section,
          admission_number: s.admission_number,
          institution_id: s.institution_id, institution_name: s.institution_name,
        })));
        setStudentsLoaded(true);
      }
    } catch { /* roster is optional */ }
  }, [studentsLoaded]);

  // ── single Add Fee ──
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState('');
  const [form, setForm] = useState({ student_id: '', amount: '', due_date: todayIso, fee_type: 'tuition', description: '' });

  // ── Mark paid (record settlement) ──
  const [payFee, setPayFee] = useState<FeeRecord | null>(null);
  const [payMethod, setPayMethod] = useState('cash');
  const [payReference, setPayReference] = useState('');
  const [payDiscount, setPayDiscount] = useState('');
  const [payDiscountReason, setPayDiscountReason] = useState('');
  const [paySaving, setPaySaving] = useState(false);
  const [payModalError, setPayModalError] = useState('');

  // ── Edit (amend) ──
  const [editFee, setEditFee] = useState<FeeRecord | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDue, setEditDue] = useState('');
  const [editType, setEditType] = useState('tuition');
  const [editDesc, setEditDesc] = useState('');
  const [editDiscount, setEditDiscount] = useState('');
  const [editDiscountReason, setEditDiscountReason] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // ── Delete (soft-cancel) ──
  const [deleteFee, setDeleteFee] = useState<FeeRecord | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // ── Bulk Assign ──
  const [showBulk, setShowBulk] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState('');
  const [bulkResult, setBulkResult] = useState<string>('');
  const [bulkFeeType, setBulkFeeType] = useState<string>('exam');
  const [bulkAmount, setBulkAmount] = useState('');
  const [bulkDue, setBulkDue] = useState(todayIso);
  const [bulkDesc, setBulkDesc] = useState('');
  const [mode, setMode] = useState<TargetMode>('all');
  const [pickClass, setPickClass] = useState('');
  const [pickSection, setPickSection] = useState('');
  const [pickInstitution, setPickInstitution] = useState('');
  const [pickStudents, setPickStudents] = useState<Set<string>>(new Set());
  const [studentSearch, setStudentSearch] = useState('');
  const [matched, setMatched] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const loadFees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/fees');
      if (!res.ok) throw new Error('Failed');
      const d = await res.json();
      const list: FeeRecord[] = d.fees ?? [];
      setFees(list);
      if (typeof d.viewer_role === 'string') setViewerRole(d.viewer_role);
      setStats({
        total: list.length,
        paid: list.filter(f => f.status === 'paid' || f.status === 'waived').length,
        pending: list.filter(f => f.status === 'pending').length,
        overdue: list.filter(f => f.status === 'overdue').length,
        collected: list.filter(f => f.status === 'paid').reduce((s, f) => s + (Number(f.amount) || 0), 0),
        outstanding: list.filter(f => !SETTLED.has(f.status)).reduce((s, f) => s + (Number(f.amount) || 0), 0),
      });
    } catch { /* keep empty state */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadFees(); }, [loadFees]);

  // distinct classes / sections / institutions derived from roster
  const classes = useMemo(() => Array.from(new Set(students.map(s => s.class).filter(Boolean))).sort(), [students]);
  const sections = useMemo(() => Array.from(new Set(students.filter(s => !pickClass || s.class === pickClass).map(s => s.section).filter(Boolean))).sort(), [students, pickClass]);
  const institutions = useMemo(() => {
    const m = new Map<string, string>();
    students.forEach(s => { if (s.institution_id) m.set(s.institution_id, s.institution_name || 'Institution'); });
    return Array.from(m, ([id, name]) => ({ id, name }));
  }, [students]);

  // ── single add ──
  async function openAddFee() {
    setAddError('');
    setForm({ student_id: '', amount: '', due_date: todayIso, fee_type: 'tuition', description: '' });
    setShowAdd(true);
    await loadStudents();
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: form.student_id, amount: amountNum, due_date: form.due_date,
          fee_type: form.fee_type, description: form.description || undefined,
        }),
      });
      const d = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) { setAddError(d.error ?? 'Could not create fee.'); return; }
      setShowAdd(false);
      await loadFees();
    } catch { setAddError('Network error. Please try again.'); }
    finally { setSaving(false); }
  }

  // ── mark paid (settlement) ──
  function openMarkPaid(fee: FeeRecord) {
    setPayError(''); setPayModalError('');
    setPayMethod('cash'); setPayReference(''); setPayDiscount(''); setPayDiscountReason('');
    setPayFee(fee);
  }
  async function submitMarkPaid() {
    if (!payFee) return;
    setPayModalError('');
    const isWaiver = payMethod === 'waiver';
    const methodDef = PAY_METHODS.find(m => m.key === payMethod);
    if (methodDef?.needsRef && !payReference.trim()) { setPayModalError(`A reference is required for ${methodDef.label}.`); return; }
    const disc = Number(payDiscount);
    if (isWaiver && !payDiscountReason.trim()) { setPayModalError('A reason is required for a waiver.'); return; }
    if (!isWaiver && payDiscount && (!Number.isFinite(disc) || disc < 0)) { setPayModalError('Discount must be a non-negative number.'); return; }
    if (!isWaiver && disc > 0 && !payDiscountReason.trim()) { setPayModalError('A reason is required when a discount is applied.'); return; }
    setPaySaving(true);
    try {
      const body: Record<string, unknown> = { method: payMethod, reference: payReference.trim() || undefined };
      if (isWaiver) body.discount_reason = payDiscountReason.trim();
      else if (disc > 0) { body.discount_amount = disc; body.discount_reason = payDiscountReason.trim(); }
      const res = await fetch(`/api/admin/fees/${payFee.id}/mark-paid`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) { setPayModalError(d.error ?? 'Could not record this payment.'); return; }
      setPayFee(null);
      await loadFees();
    } catch { setPayModalError('Network error. Please try again.'); }
    finally { setPaySaving(false); }
  }

  // ── edit (amend) ──
  function openEdit(fee: FeeRecord) {
    setEditError('');
    setEditFee(fee);
    setEditAmount(String(fee.original_amount ?? fee.amount ?? ''));
    setEditDue(fee.due_date ?? todayIso);
    setEditType(fee.fee_type ?? 'tuition');
    setEditDesc(fee.description ?? '');
    setEditDiscount(String(fee.discount_amount ?? ''));
    setEditDiscountReason('');
    setEditReason('');
  }
  async function submitEdit() {
    if (!editFee) return;
    setEditError('');
    if (editReason.trim().length < 3) { setEditError('Please state a reason for this change (min 3 characters).'); return; }
    const amt = Number(editAmount);
    if (!Number.isFinite(amt) || amt <= 0) { setEditError('Amount must be greater than 0.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(editDue)) { setEditError('A valid due date is required.'); return; }

    // Only send fields that actually changed.
    const body: Record<string, unknown> = { reason: editReason.trim() };
    if (amt !== Number(editFee.original_amount ?? editFee.amount)) body.amount = amt;
    if (editDue !== editFee.due_date) body.due_date = editDue;
    if (editType !== editFee.fee_type) body.fee_type = editType;
    if ((editDesc || '') !== (editFee.description || '')) body.description = editDesc || null;
    if (isOwner && editDiscount !== '' && Number(editDiscount) !== Number(editFee.discount_amount ?? 0)) {
      const d = Number(editDiscount);
      if (!Number.isFinite(d) || d < 0) { setEditError('Discount must be a non-negative number.'); return; }
      if (d > 0 && editDiscountReason.trim().length < 3) { setEditError('A discount needs its own reason.'); return; }
      body.discount_amount = d;
      body.discount_reason = editDiscountReason.trim() || undefined;
    }
    if (Object.keys(body).length === 1) { setEditError('Nothing has changed.'); return; }

    setEditSaving(true);
    try {
      const res = await fetch(`/api/admin/fees/${editFee.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) { setEditError(d.error ?? 'Could not amend this fee.'); return; }
      setEditFee(null);
      await loadFees();
    } catch { setEditError('Network error. Please try again.'); }
    finally { setEditSaving(false); }
  }

  // ── delete (soft-cancel) ──
  function openDelete(fee: FeeRecord) { setDeleteError(''); setDeleteReason(''); setDeleteFee(fee); }
  async function submitDelete() {
    if (!deleteFee) return;
    setDeleteError('');
    if (deleteReason.trim().length < 3) { setDeleteError('Please state why this fee is being deleted (min 3 characters).'); return; }
    setDeleteSaving(true);
    try {
      const res = await fetch(`/api/admin/fees/${deleteFee.id}`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: deleteReason.trim() }),
      });
      const d = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) { setDeleteError(d.error ?? 'Could not delete this fee.'); return; }
      setDeleteFee(null);
      await loadFees();
    } catch { setDeleteError('Network error. Please try again.'); }
    finally { setDeleteSaving(false); }
  }

  // ── bulk assign ──
  async function openBulk() {
    setBulkError(''); setBulkResult('');
    setBulkFeeType('exam'); setBulkAmount(''); setBulkDue(todayIso); setBulkDesc('');
    setMode('all'); setPickClass(''); setPickSection(''); setPickInstitution(''); setPickStudents(new Set()); setStudentSearch('');
    setMatched(null);
    setShowBulk(true);
    await loadStudents();
  }

  // build the target object from current selection
  const buildTarget = useCallback(() => {
    switch (mode) {
      case 'all': return { mode: 'all' as const };
      case 'class': return { mode: 'class' as const, class: pickClass };
      case 'section': return { mode: 'class' as const, class: pickClass, section: pickSection };
      case 'institution': return { mode: 'institution' as const, institution_id: pickInstitution };
      case 'students': return { mode: 'students' as const, student_ids: Array.from(pickStudents) };
    }
  }, [mode, pickClass, pickSection, pickInstitution, pickStudents]);

  // live preview of how many students the target resolves to
  useEffect(() => {
    if (!showBulk) return;
    if (mode === 'students') { setMatched(pickStudents.size); return; }
    if (mode === 'class' && !pickClass) { setMatched(null); return; }
    if (mode === 'section' && (!pickClass || !pickSection)) { setMatched(null); return; }
    if (mode === 'institution' && !pickInstitution) { setMatched(null); return; }
    const params = new URLSearchParams();
    const t = buildTarget();
    params.set('mode', t.mode);
    if ('class' in t && t.class) params.set('class', t.class);
    if ('section' in t && t.section) params.set('section', t.section);
    if ('institution_id' in t && t.institution_id) params.set('institution_id', t.institution_id);
    setPreviewing(true);
    const ctrl = new AbortController();
    fetch('/api/admin/fees/bulk?' + params.toString(), { signal: ctrl.signal })
      .then(r => r.ok ? r.json() : { matched: null })
      .then(d => setMatched(d.matched))
      .catch(() => { /* aborted */ })
      .finally(() => setPreviewing(false));
    return () => ctrl.abort();
  }, [showBulk, mode, pickClass, pickSection, pickInstitution, pickStudents, buildTarget]);

  async function submitBulk() {
    setBulkError(''); setBulkResult('');
    const amt = Number(bulkAmount);
    if (!Number.isFinite(amt) || amt <= 0) { setBulkError('Amount must be greater than 0.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bulkDue)) { setBulkError('A valid due date is required.'); return; }
    if (mode === 'class' && !pickClass) { setBulkError('Pick a class.'); return; }
    if (mode === 'section' && (!pickClass || !pickSection)) { setBulkError('Pick a class and section.'); return; }
    if (mode === 'institution' && !pickInstitution) { setBulkError('Pick an institution.'); return; }
    if (mode === 'students' && pickStudents.size === 0) { setBulkError('Select at least one student.'); return; }
    setBulkSaving(true);
    try {
      const res = await fetch('/api/admin/fees/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fee_type: bulkFeeType, amount: amt, due_date: bulkDue,
          description: bulkDesc || undefined, target: buildTarget(),
        }),
      });
      const d = await res.json().catch(() => ({})) as { error?: string; created?: number; skipped?: number; matched?: number };
      if (!res.ok) { setBulkError(d.error ?? 'Could not assign fees.'); return; }
      const parts = [`Created ${d.created ?? 0} fee${(d.created ?? 0) === 1 ? '' : 's'}`];
      if (d.skipped) parts.push(`skipped ${d.skipped} duplicate${d.skipped === 1 ? '' : 's'}`);
      setBulkResult(parts.join(' · '));
      await loadFees();
    } catch { setBulkError('Network error. Please try again.'); }
    finally { setBulkSaving(false); }
  }

  const visible = fees.filter(f => {
    if (filter !== 'all' && f.status !== filter) return false;
    if (search && !(f.students?.name ?? '').toLowerCase().includes(search.toLowerCase()) &&
      !(f.students?.class ?? '').includes(search)) return false;
    return true;
  });

  const filteredRoster = students.filter(s =>
    !studentSearch ||
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    `${s.class}${s.section}`.toLowerCase().includes(studentSearch.toLowerCase()) ||
    (s.admission_number ?? '').toLowerCase().includes(studentSearch.toLowerCase()),
  );

  const iconBtn = { padding: '6px 9px', borderRadius: 8, border: '1px solid #E5E7EB', cursor: 'pointer', background: '#fff', fontSize: 12, fontWeight: 600 } as const;

  return (
    <Layout title={T('fee_management', lang)} subtitle="Track collections, send reminders, mark payments"
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => void openBulk()} className="btn btn-sm"
            style={{ background: '#EEF2FF', color: '#4338CA', fontWeight: 700, border: '1px solid #C7D2FE' }}>
            ⚡ Assign to Many
          </button>
          <button onClick={() => void openAddFee()} className="btn btn-primary btn-sm">+ Add Fee</button>
        </div>
      }>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: T('collected_label', lang as never), value: `₹${(stats.collected / 1000).toFixed(1)}K`, color: '#15803D' },
          { label: T('outstanding_label', lang as never), value: `₹${(stats.outstanding / 1000).toFixed(1)}K`, color: '#B91C1C' },
          { label: T('overdue', lang as never), value: stats.overdue, color: '#B91C1C' },
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
        {(['all', 'pending', 'overdue', 'paid'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            style={{
              padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: filter === s ? '#4F46E5' : '#F3F4F6',
              color: filter === s ? '#fff' : '#374151', fontSize: 12, fontWeight: 600,
            }}>
            {[T('all_students', lang as never), T('pending', lang as never), T('overdue', lang as never), T('paid', lang as never)][{ all: 0, pending: 1, overdue: 2, paid: 3 }[s] ?? 0] + ' (' + [stats.total, stats.pending, stats.overdue, stats.paid][{ all: 0, pending: 1, overdue: 2, paid: 3 }[s] ?? 0] + ')'}
          </button>
        ))}
      </div>

      {payError && (
        <div style={{ background: '#FEE2E2', color: '#B91C1C', borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{payError}</div>
      )}

      {/* Fee list */}
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading fees…</div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">💰</div>
          <div className="empty-state-title">{T('no_fees', lang as never)} {filter !== 'all' ? `with status "${filter}"` : ''}</div>
          <div className="empty-state-sub">Use “⚡ Assign to Many” for a class-wide fee, or “+ Add Fee” for one student.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {visible.map((fee, i) => {
            const def = feeTypeDef(fee.fee_type);
            const settled = SETTLED.has(fee.status);
            return (
              <div key={fee.id} style={{
                padding: '12px 16px', borderBottom: i < visible.length - 1 ? '1px solid #F3F4F6' : 'none',
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
              }}>
                <div style={{ fontSize: 20, width: 28, textAlign: 'center', flexShrink: 0 }}>{def.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 2 }}>{fee.students?.name ?? '—'}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>
                    Class {fee.students?.class}{fee.students?.section} · {def.label} · Due {fee.due_date ? new Date(fee.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                    {fee.payment_method ? ` · ${fee.payment_method.replace('_', ' ')}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{INR(fee.amount)}</div>
                  <span style={{
                    display: 'inline-block', marginTop: 3, padding: '2px 8px', borderRadius: 6,
                    background: STATUS_BG[fee.status] ?? '#F3F4F6', color: STATUS_COLOR[fee.status] ?? '#374151',
                    fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                  }}>{fee.status}</span>
                </div>
                {!settled && (
                  <>
                    <button onClick={() => openMarkPaid(fee)}
                      style={{ padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#4F46E5', color: '#fff', fontSize: 12, fontWeight: 600 }}>
                      {T('mark_paid_btn', lang as never)}
                    </button>
                    <button onClick={() => openEdit(fee)} title="Amend this fee" style={iconBtn}>✏️</button>
                    <button onClick={() => openDelete(fee)} title="Delete this fee" style={{ ...iconBtn, color: '#B91C1C', borderColor: '#FECACA' }}>🗑️</button>
                  </>
                )}
                {settled && (
                  <a href={`/admin/fees/receipt/${fee.id}`} target="_blank" rel="noopener noreferrer"
                    style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #E5E7EB', cursor: 'pointer', background: '#fff', color: '#4F46E5', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                    🧾 Receipt
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Mark paid modal ── */}
      {payFee && (
        <div onClick={() => { if (!paySaving) setPayFee(null); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 14, padding: 20, width: '100%', maxWidth: 440, boxShadow: '0 10px 40px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginBottom: 4 }}>Record payment</div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>
              {payFee.students?.name} · {feeTypeDef(payFee.fee_type).label} · {INR(payFee.amount)}
            </div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8 }}>The institution collects the money directly — EdProSys never holds funds. Record how it was received.</div>

            <label style={labelStyle}>How was it paid?</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PAY_METHODS.map(m => {
                const on = payMethod === m.key;
                return (
                  <button key={m.key} onClick={() => setPayMethod(m.key)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: 999, border: on ? '1.5px solid #4F46E5' : '1px solid #E5E7EB', background: on ? '#EEF2FF' : '#fff', color: on ? '#3730A3' : '#374151', fontSize: 12.5, fontWeight: on ? 700 : 500, cursor: 'pointer' }}>
                    <span>{m.icon}</span>{m.label}
                  </button>
                );
              })}
            </div>

            {payMethod !== 'waiver' && payMethod !== 'cash' && (
              <>
                <label style={labelStyle}>Reference {(PAY_METHODS.find(m => m.key === payMethod)?.needsRef) ? '*' : ''}</label>
                <input style={inputStyle} value={payReference} onChange={e => setPayReference(e.target.value)} placeholder="UPI ref / cheque no. / NEFT id" />
              </>
            )}

            {payMethod === 'waiver' ? (
              <>
                <label style={labelStyle}>Reason for waiver *</label>
                <input style={inputStyle} value={payDiscountReason} onChange={e => setPayDiscountReason(e.target.value)} placeholder="e.g. RTE / scholarship / management approval" />
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>The full balance of {INR(payFee.amount)} will be written off.</div>
              </>
            ) : (
              <>
                <label style={labelStyle}>Discount applied (optional, ₹)</label>
                <input type="number" min="0" style={inputStyle} value={payDiscount} onChange={e => setPayDiscount(e.target.value)} placeholder="0" />
                {Number(payDiscount) > 0 && (
                  <>
                    <label style={labelStyle}>Reason for discount *</label>
                    <input style={inputStyle} value={payDiscountReason} onChange={e => setPayDiscountReason(e.target.value)} placeholder="Purpose of the concession" />
                  </>
                )}
              </>
            )}

            {payModalError && <div style={{ color: '#B91C1C', fontSize: 12, marginTop: 10 }}>{payModalError}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setPayFee(null)} disabled={paySaving}
                style={{ flex: 1, height: 42, borderRadius: 9, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 14, fontWeight: 700, cursor: paySaving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={() => void submitMarkPaid()} disabled={paySaving}
                style={{ flex: 1, height: 42, borderRadius: 9, border: 'none', background: paySaving ? '#9CA3AF' : '#4F46E5', color: '#fff', fontSize: 14, fontWeight: 700, cursor: paySaving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {paySaving ? 'Saving…' : payMethod === 'waiver' ? 'Waive fee' : 'Confirm payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit (amend) modal ── */}
      {editFee && (
        <div onClick={() => { if (!editSaving) setEditFee(null); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 14, padding: 20, width: '100%', maxWidth: 440, boxShadow: '0 10px 40px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginBottom: 4 }}>Amend fee</div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>{editFee.students?.name} · Class {editFee.students?.class}{editFee.students?.section}</div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Amount (₹) *</label>
                <input type="number" min="1" step="0.01" value={editAmount} onChange={e => setEditAmount(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Due date *</label>
                <input type="date" value={editDue} onChange={e => setEditDue(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <label style={labelStyle}>Fee type</label>
            <select value={editType} onChange={e => setEditType(e.target.value)} style={inputStyle}>
              {FEE_CATALOG.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
            </select>

            <label style={labelStyle}>Description</label>
            <input value={editDesc} onChange={e => setEditDesc(e.target.value)} style={inputStyle} placeholder="Optional" />

            {isOwner ? (
              <>
                <label style={labelStyle}>Discount (₹) — owner only</label>
                <input type="number" min="0" value={editDiscount} onChange={e => setEditDiscount(e.target.value)} style={inputStyle} placeholder="0" />
                {Number(editDiscount) > 0 && (
                  <>
                    <label style={labelStyle}>Reason for discount *</label>
                    <input value={editDiscountReason} onChange={e => setEditDiscountReason(e.target.value)} style={inputStyle} placeholder="Purpose of the concession" />
                  </>
                )}
              </>
            ) : (
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>Only the owner can apply a discount.</div>
            )}

            <label style={{ ...labelStyle, color: '#B45309' }}>Reason for this change * (recorded in the audit log)</label>
            <input value={editReason} onChange={e => setEditReason(e.target.value)} style={inputStyle} placeholder="e.g. corrected amount after fee-structure update" />

            {editError && <div style={{ color: '#B91C1C', fontSize: 12, marginTop: 10 }}>{editError}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setEditFee(null)} disabled={editSaving}
                style={{ flex: 1, height: 42, borderRadius: 9, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 14, fontWeight: 700, cursor: editSaving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={() => void submitEdit()} disabled={editSaving}
                style={{ flex: 1, height: 42, borderRadius: 9, border: 'none', background: editSaving ? '#9CA3AF' : '#4F46E5', color: '#fff', fontSize: 14, fontWeight: 700, cursor: editSaving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {editSaving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete modal ── */}
      {deleteFee && (
        <div onClick={() => { if (!deleteSaving) setDeleteFee(null); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 14, padding: 20, width: '100%', maxWidth: 400, boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#B91C1C', marginBottom: 4 }}>Delete fee</div>
            <div style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>
              {deleteFee.students?.name} · {feeTypeDef(deleteFee.fee_type).label} · {INR(deleteFee.amount)}
            </div>
            <div style={{ fontSize: 11.5, color: '#9CA3AF', marginBottom: 6 }}>
              This removes the fee from parents and staff. It is kept in the audit log and can be traced.
            </div>
            <label style={{ ...labelStyle, color: '#B45309' }}>Reason for deletion * (recorded in the audit log)</label>
            <input value={deleteReason} onChange={e => setDeleteReason(e.target.value)} style={inputStyle} placeholder="e.g. created by mistake / duplicate" />

            {deleteError && <div style={{ color: '#B91C1C', fontSize: 12, marginTop: 10 }}>{deleteError}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setDeleteFee(null)} disabled={deleteSaving}
                style={{ flex: 1, height: 42, borderRadius: 9, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 14, fontWeight: 700, cursor: deleteSaving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={() => void submitDelete()} disabled={deleteSaving}
                style={{ flex: 1, height: 42, borderRadius: 9, border: 'none', background: deleteSaving ? '#9CA3AF' : '#B91C1C', color: '#fff', fontSize: 14, fontWeight: 700, cursor: deleteSaving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {deleteSaving ? 'Deleting…' : 'Delete fee'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Fee modal (single) ── */}
      {showAdd && (
        <div onClick={() => { if (!saving) setShowAdd(false); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 14, padding: 20, width: '100%', maxWidth: 420, boxShadow: '0 10px 40px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginBottom: 6 }}>Add Fee</div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>Create a fee record for one student.</div>

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
                <input type="number" min="1" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} style={inputStyle} placeholder="0" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Due date *</label>
                <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} style={inputStyle} />
              </div>
            </div>

            <label style={labelStyle}>Fee type</label>
            <select value={form.fee_type} onChange={e => setForm({ ...form, fee_type: e.target.value })} style={inputStyle}>
              {FEE_CATALOG.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
            </select>

            <label style={labelStyle}>Description</label>
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={inputStyle} placeholder="Optional" />

            {addError && <div style={{ color: '#B91C1C', fontSize: 12, marginTop: 10 }}>{addError}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setShowAdd(false)} disabled={saving}
                style={{ flex: 1, height: 42, borderRadius: 9, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={() => void submitFee()} disabled={saving}
                style={{ flex: 1, height: 42, borderRadius: 9, border: 'none', background: saving ? '#9CA3AF' : '#4F46E5', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Saving…' : 'Create Fee'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Assign modal ── */}
      {showBulk && (
        <div onClick={() => { if (!bulkSaving) setShowBulk(false); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 16, padding: 22, width: '100%', maxWidth: 560, boxShadow: '0 10px 40px rgba(0,0,0,0.25)', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#111827' }}>⚡ Assign a fee to many</div>
            <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 4, marginBottom: 14 }}>
              Pick a fee item, set the amount, and choose who pays. Parents see it instantly in their app.
            </div>

            {/* 1. catalogue picker */}
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>1 · Fee item</div>
            {FEE_GROUPS.map(g => {
              const items = FEE_CATALOG.filter(f => f.group === g.id);
              if (items.length === 0) return null;
              return (
                <div key={g.id} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>{g.label}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {items.map((f: FeeTypeDef) => {
                      const on = bulkFeeType === f.key;
                      return (
                        <button key={f.key} onClick={() => setBulkFeeType(f.key)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: 999,
                            border: on ? '1.5px solid #4F46E5' : '1px solid #E5E7EB',
                            background: on ? '#EEF2FF' : '#fff', color: on ? '#3730A3' : '#374151',
                            fontSize: 12.5, fontWeight: on ? 700 : 500, cursor: 'pointer',
                          }}>
                          <span>{f.icon}</span>{f.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* 2. amount + due */}
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', margin: '14px 0 6px' }}>2 · Amount & due date</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Amount per student (₹) *</label>
                <input type="number" min="1" step="0.01" value={bulkAmount} onChange={e => setBulkAmount(e.target.value)} style={inputStyle} placeholder="0" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Due date *</label>
                <input type="date" value={bulkDue} onChange={e => setBulkDue(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <label style={labelStyle}>Note to parents (optional)</label>
            <input value={bulkDesc} onChange={e => setBulkDesc(e.target.value)} style={inputStyle} placeholder="e.g. Term 2 examination fee" />

            {/* 3. target */}
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', margin: '14px 0 6px' }}>3 · Who pays</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {([
                ['all', 'Whole school'],
                ['class', 'A class'],
                ['section', 'A section'],
                ...(institutions.length > 1 ? [['institution', 'An institution'] as [TargetMode, string]] : []),
                ['students', 'Specific students'],
              ] as [TargetMode, string][]).map(([m, label]) => {
                const on = mode === m;
                return (
                  <button key={m} onClick={() => setMode(m)}
                    style={{ padding: '6px 12px', borderRadius: 8, border: on ? '1.5px solid #4F46E5' : '1px solid #E5E7EB', background: on ? '#4F46E5' : '#fff', color: on ? '#fff' : '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    {label}
                  </button>
                );
              })}
            </div>

            {mode === 'class' && (
              <select value={pickClass} onChange={e => setPickClass(e.target.value)} style={inputStyle}>
                <option value="">Select class…</option>
                {classes.map(c => <option key={c} value={c}>Class {c}</option>)}
              </select>
            )}
            {mode === 'section' && (
              <div style={{ display: 'flex', gap: 10 }}>
                <select value={pickClass} onChange={e => { setPickClass(e.target.value); setPickSection(''); }} style={inputStyle}>
                  <option value="">Class…</option>
                  {classes.map(c => <option key={c} value={c}>Class {c}</option>)}
                </select>
                <select value={pickSection} onChange={e => setPickSection(e.target.value)} style={inputStyle} disabled={!pickClass}>
                  <option value="">Section…</option>
                  {sections.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            {mode === 'institution' && (
              <select value={pickInstitution} onChange={e => setPickInstitution(e.target.value)} style={inputStyle}>
                <option value="">Select institution…</option>
                {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            )}
            {mode === 'students' && (
              <div>
                <input value={studentSearch} onChange={e => setStudentSearch(e.target.value)} style={inputStyle} placeholder="Search students…" />
                <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #E5E7EB', borderRadius: 8, marginTop: 6 }}>
                  {filteredRoster.slice(0, 200).map(s => {
                    const on = pickStudents.has(s.id);
                    return (
                      <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', background: on ? '#EEF2FF' : '#fff' }}>
                        <input type="checkbox" checked={on} onChange={() => {
                          setPickStudents(prev => { const n = new Set(prev); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n; });
                        }} />
                        <span style={{ fontSize: 13, color: '#111827' }}>{s.name}</span>
                        <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 'auto' }}>Class {s.class}{s.section}</span>
                      </label>
                    );
                  })}
                  {filteredRoster.length === 0 && <div style={{ padding: 12, fontSize: 12, color: '#9CA3AF' }}>No students match.</div>}
                </div>
              </div>
            )}

            {/* preview + result */}
            <div style={{ marginTop: 14, padding: '11px 14px', borderRadius: 10, background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, color: '#334155' }}>
                {previewing ? 'Counting students…'
                  : matched == null ? 'Choose a target to see how many students.'
                    : <>This will create <b>{matched}</b> fee{matched === 1 ? '' : 's'}{bulkAmount && matched ? <> · total <b>₹{(Number(bulkAmount) * matched).toLocaleString('en-IN')}</b></> : null}.</>}
              </div>
              <div style={{ fontSize: 22 }}>{feeTypeDef(bulkFeeType).icon}</div>
            </div>

            {bulkError && <div style={{ color: '#B91C1C', fontSize: 12, marginTop: 10 }}>{bulkError}</div>}
            {bulkResult && <div style={{ color: '#15803D', fontSize: 13, fontWeight: 700, marginTop: 10 }}>✓ {bulkResult}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setShowBulk(false)} disabled={bulkSaving}
                style={{ flex: 1, height: 44, borderRadius: 10, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 14, fontWeight: 700, cursor: bulkSaving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {bulkResult ? 'Close' : 'Cancel'}
              </button>
              <button onClick={() => void submitBulk()} disabled={bulkSaving || (matched != null && matched === 0)}
                style={{ flex: 2, height: 44, borderRadius: 10, border: 'none', background: bulkSaving ? '#9CA3AF' : '#4F46E5', color: '#fff', fontSize: 14, fontWeight: 800, cursor: bulkSaving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {bulkSaving ? 'Assigning…' : matched ? `Assign to ${matched} student${matched === 1 ? '' : 's'}` : 'Assign fees'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
