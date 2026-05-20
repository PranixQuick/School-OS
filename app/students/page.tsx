'use client';
// app/students/page.tsx
import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import { T } from '@/lib/i18n';
import { useLang } from '@/lib/useLang';

interface Student {
  id: string; name: string; class: string | null; section: string | null;
  roll_number: string | null; admission_number: string | null;
  phone_parent: string | null; parent_name: string | null;
  status: string; is_active: boolean; batch_id: string | null;
  transfer_school: string | null; transfer_date: string | null;
  graduation_year: number | null; created_at: string;
}

const STATUS_BADGE: Record<string, [string, string]> = {
  active: ['#D1FAE5', '#065F46'],
  graduated: ['#E0E7FF', '#3730A3'],
  transferred: ['#DBEAFE', '#1E40AF'],
  withdrawn: ['#FEF9C3', '#92400E'],
  archived: ['#F3F4F6', '#6B7280'],
};

interface ModalProps {
  student: Student;
  action: 'transfer' | 'graduate' | 'withdraw' | 'archive' | 'edit';
  acting: boolean;
  onConfirm: (fields: Record<string, string>) => void;
  onClose: () => void;
}

function ActionModal({ student, action, acting, onConfirm, onClose }: ModalProps) {
  const [fields, setFields] = useState<Record<string, string>>(() => {
    if (action === 'edit') return { name: student.name, class: student.class ?? '', section: student.section ?? '', phone_parent: student.phone_parent ?? '', parent_name: student.parent_name ?? '' } as Record<string, string>;
    if (action === 'graduate') return { graduation_year: String(new Date().getFullYear()) } as Record<string, string>;
    return {} as Record<string, string>;
  });

  const configs: Record<string, { title: string; color: string; fields?: { label: string; key: string; type?: string }[] }> = {
    transfer: { title: `Transfer ${student.name}`, color: '#1D4ED8', fields: [{ label: 'Destination School', key: 'transfer_school' }, { label: 'Transfer Date', key: 'transfer_date', type: 'date' }] },
    graduate: { title: `Graduate ${student.name}`, color: '#065F46', fields: [{ label: 'Graduation Year', key: 'graduation_year', type: 'number' }] },
    withdraw: { title: `Withdraw ${student.name}`, color: '#92400E' },
    archive: { title: `Archive ${student.name}`, color: '#6B7280' },
    edit: { title: `Edit ${student.name}`, color: '#4F46E5', fields: [{ label: 'Name', key: 'name' }, { label: 'Class', key: 'class' }, { label: 'Section', key: 'section' }, { label: 'Parent Phone', key: 'phone_parent' }, { label: 'Parent Name', key: 'parent_name' }] },
  };
  const cfg = configs[action];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginBottom: 12 }}>{cfg.title}</div>
        {cfg.fields && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {cfg.fields.map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>{f.label}</label>
                <input type={f.type ?? 'text'} value={fields[f.key] ?? ''}
                  onChange={e => setFields(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{ width: '100%', height: 38, border: '1px solid #D1D5DB', borderRadius: 8, padding: '0 12px', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            ))}
          </div>
        )}
        {!cfg.fields && action !== 'edit' && (
          <div style={{ background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#92400E' }}>
            {action === 'archive' ? 'This will mark the student as archived. Record will be preserved.' : `This will mark ${student.name} as ${action}. Confirm?`}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onConfirm(fields)} disabled={acting}
            style={{ flex: 1, padding: '10px', background: cfg.color, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            {acting ? 'Processing...' : 'Confirm'}
          </button>
          <button onClick={onClose}
            style={{ flex: 1, padding: '10px', background: '#fff', border: '1px solid #D1D5DB', color: '#374151', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StudentsPage()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
 {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('active');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<'ok' | 'err'>('ok');
  const [selected, setSelected] = useState<Student | null>(null);
  const [actionModal, setActionModal] = useState<'transfer' | 'graduate' | 'withdraw' | 'archive' | 'edit' | null>(null);
  const [acting, setActing] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', class: '', section: '', phone_parent: '', parent_name: '' });
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ status: statusFilter, limit: '500' });
    if (search) params.set('q', search);
    const r = await fetch(`/api/students?${params}`);
    const d = await r.json();
    setStudents(d.students ?? []);
    setLoading(false);
  }, [statusFilter, search]);

  useEffect(() => { load(); }, [statusFilter]);

  function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast(msg); setToastType(type); setTimeout(() => setToast(''), 3500);
  }

  async function doAction(fields: Record<string, string>) {
    if (!selected || !actionModal) return;
    setActing(true);
    const body: Record<string, unknown> = { id: selected.id, action: actionModal, ...fields };
    if (actionModal === 'graduate' && fields.graduation_year) body.graduation_year = Number(fields.graduation_year);
    const r = await fetch('/api/students', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json(); setActing(false);
    if (!r.ok) { showToast(d.error ?? 'Action failed', 'err'); return; }
    showToast(`${selected.name} — ${actionModal} complete`);
    setActionModal(null); setSelected(null); load();
  }

  async function addStudent() {
    if (!addForm.name.trim()) { setAddError('Name required'); return; }
    setAdding(true); setAddError('');
    const r = await fetch('/api/students', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(addForm) });
    const d = await r.json(); setAdding(false);
    if (!r.ok) { setAddError(d.error ?? 'Failed'); return; }
    showToast('Student added'); setShowAdd(false); setAddForm({ name: '', class: '', section: '', phone_parent: '', parent_name: '' }); load();
  }

  const STATUSES = ['active', 'graduated', 'transferred', 'withdrawn', 'archived', 'all'];

  return (
    <Layout title="Students" subtitle={`${students.length} ${statusFilter === 'all' ? 'total' : statusFilter} students`}>
      {toast && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: toastType === 'err' ? '#991B1B' : '#111827', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>{toast}</div>
      )}

      {selected && actionModal && (
        <ActionModal
          student={selected}
          action={actionModal}
          acting={acting}
          onConfirm={doAction}
          onClose={() => { setActionModal(null); setSelected(null); }}
        />
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {STATUSES.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            style={{ padding: '5px 12px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: statusFilter === s ? '#4F46E5' : '#F3F4F6', color: statusFilter === s ? '#fff' : '#374151' }}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()}
          placeholder="Search name..." style={{ flex: 1, minWidth: 180, height: 38, border: '1px solid #D1D5DB', borderRadius: 8, padding: '0 12px', fontSize: 14 }} />
        <button onClick={() => setShowAdd(v => !v)} style={{ padding: '8px 16px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {showAdd ? 'Cancel' : '+ Add Student'}
        </button>
      </div>

      {showAdd && (
        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Add Student</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
            {[['Name *', 'name'], ['Class', 'class'], ['Section', 'section'], ['Parent Phone', 'phone_parent'], ['Parent Name', 'parent_name']].map(([label, key]) => (
              <div key={key}><label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>{label}</label>
                <input value={(addForm as Record<string,string>)[key]} onChange={e => setAddForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ width: '100%', height: 36, border: '1px solid #D1D5DB', borderRadius: 7, padding: '0 10px', fontSize: 13, boxSizing: 'border-box' }} /></div>
            ))}
          </div>
          {addError && <div style={{ color: '#991B1B', fontSize: 12, marginTop: 8 }}>{addError}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={addStudent} disabled={adding} style={{ padding: '8px 14px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {adding ? 'Adding...' : 'Add'}
            </button>
            <button onClick={() => setShowAdd(false)} style={{ padding: '8px 14px', background: '#fff', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>Loading...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {students.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>No {statusFilter === 'all' ? '' : statusFilter} students found.</div>}
          {students.map(s => {
            const [bg, fg] = STATUS_BADGE[s.status] ?? ['#F3F4F6', '#6B7280'];
            return (
              <div key={s.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>
                      {s.class ? `Class ${s.class}` : ''}{s.section ? `-${s.section}` : ''}{s.roll_number ? ` · Roll ${s.roll_number}` : ''}{s.admission_number ? ` · Adm ${s.admission_number}` : ''}
                    </div>
                    {s.parent_name && <div style={{ fontSize: 11, color: '#9CA3AF' }}>Parent: {s.parent_name}{s.phone_parent ? ` · ${s.phone_parent}` : ''}</div>}
                    {s.status === 'transferred' && s.transfer_school && <div style={{ fontSize: 11, color: '#1E40AF' }}>→ {s.transfer_school} ({s.transfer_date})</div>}
                    {s.status === 'graduated' && s.graduation_year && <div style={{ fontSize: 11, color: '#3730A3' }}>Graduated {s.graduation_year}</div>}
                  </div>
                  <span style={{ padding: '3px 9px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: bg, color: fg, marginLeft: 8, flexShrink: 0 }}>
                    {s.status}
                  </span>
                </div>
                {s.status === 'active' && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {[
                      ['Edit', 'edit', '#F3F4F6', '#374151', '#E5E7EB'],
                      ['Transfer', 'transfer', '#EFF6FF', '#1E40AF', '#BFDBFE'],
                      ['Graduate', 'graduate', '#EDE9FE', '#5B21B6', '#DDD6FE'],
                      ['Withdraw', 'withdraw', '#FEF9C3', '#92400E', '#FDE68A'],
                      ['Archive', 'archive', '#F9FAFB', '#6B7280', '#E5E7EB'],
                    ].map(([label, act, bg2, fg2, border]) => (
                      <button key={act} onClick={() => { setSelected(s); setActionModal(act as typeof actionModal); }}
                        style={{ padding: '4px 10px', fontSize: 12, background: bg2, border: `1px solid ${border}`, borderRadius: 6, cursor: 'pointer', color: fg2 }}>
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                {s.status !== 'active' && s.status !== 'graduated' && (
                  <div style={{ marginTop: 8 }}>
                    <button onClick={async () => {
                      const r = await fetch('/api/students', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id, action: 'reactivate' }) });
                      if (r.ok) { showToast(`${s.name} reactivated`); load(); } else showToast('Failed to reactivate', 'err');
                    }} style={{ padding: '4px 10px', fontSize: 12, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 6, cursor: 'pointer', color: '#065F46' }}>Reactivate</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
