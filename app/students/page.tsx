'use client';
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
  active:      ['#D1FAE5', '#065F46'],
  graduated:   ['#E0E7FF', '#3730A3'],
  transferred: ['#DBEAFE', '#1E40AF'],
  withdrawn:   ['#FEF9C3', '#92400E'],
  archived:    ['#F3F4F6', '#6B7280'],
};

interface ModalProps {
  student: Student;
  action: 'transfer' | 'graduate' | 'withdraw' | 'archive' | 'edit';
  acting: boolean;
  lang: string;
  onConfirm: (fields: Record<string, string>) => void;
  onClose: () => void;
}

function ActionModal({ student, action, acting, lang, onConfirm, onClose }: ModalProps) {
  const [fields, setFields] = useState<Record<string, string>>(() => {
    if (action === 'edit') return { name: student.name, class: student.class ?? '', section: student.section ?? '', phone_parent: student.phone_parent ?? '', parent_name: student.parent_name ?? '' } as Record<string, string>;
    if (action === 'graduate') return { graduation_year: String(new Date().getFullYear()) } as Record<string, string>;
    return {} as Record<string, string>;
  });

  const configs: Record<string, { titleKey: string; color: string; fields?: { labelKey: string; key: string; type?: string }[] }> = {
    transfer:  { titleKey: 'transfer_action', color: '#1D4ED8', fields: [{ labelKey: 'destination_school', key: 'transfer_school' }, { labelKey: 'date', key: 'transfer_date', type: 'date' }] },
    graduate:  { titleKey: 'graduate_action', color: '#065F46', fields: [{ labelKey: 'graduation_year_label', key: 'graduation_year', type: 'number' }] },
    withdraw:  { titleKey: 'withdraw_action', color: '#92400E' },
    archive:   { titleKey: 'archive_action',  color: '#6B7280' },
    edit:      { titleKey: 'edit',            color: '#4F46E5', fields: [{ labelKey: 'name', key: 'name' }, { labelKey: 'class_', key: 'class' }, { labelKey: 'section', key: 'section' }, { labelKey: 'parent_phone', key: 'phone_parent' }, { labelKey: 'parent_name_label', key: 'parent_name' }] },
  };
  const cfg = configs[action];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginBottom: 12 }}>
          {T(cfg.titleKey, lang as never)}: {student.name}
        </div>
        {cfg.fields && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {cfg.fields.map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>{T(f.labelKey, lang as never)}</label>
                <input type={f.type ?? 'text'} value={fields[f.key] ?? ''}
                  onChange={e => setFields(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{ width: '100%', height: 38, border: '1px solid #D1D5DB', borderRadius: 8, padding: '0 12px', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            ))}
          </div>
        )}
        {!cfg.fields && action !== 'edit' && (
          <div style={{ background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#92400E' }}>
            {action === 'archive' ? T('archive_action', lang as never) + '?' : T(cfg.titleKey, lang as never) + ' ' + student.name + '?'}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onConfirm(fields)} disabled={acting}
            style={{ flex: 1, padding: '10px', background: cfg.color, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            {acting ? T('processing_', lang as never) : T('confirm', lang as never)}
          </button>
          <button onClick={onClose}
            style={{ flex: 1, padding: '10px', background: '#fff', border: '1px solid #D1D5DB', color: '#374151', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>
            {T('cancel', lang as never)}
          </button>
        </div>
      </div>
    </div>
  );
}

// Gender and category options for Add Student form
const GENDER_OPTIONS = [
  { value: '', label: 'Select Gender / లింగం' },
  { value: 'M', label: 'Male / అబ్బాయి' },
  { value: 'F', label: 'Female / అమ్మాయి' },
  { value: 'O', label: 'Other / ఇతర' },
];
const CATEGORY_OPTIONS = [
  { value: '', label: 'Select Category / వర్గం' },
  { value: 'OC', label: 'OC' },
  { value: 'BC-A', label: 'BC-A' },
  { value: 'BC-B', label: 'BC-B' },
  { value: 'BC-C', label: 'BC-C' },
  { value: 'BC-D', label: 'BC-D' },
  { value: 'BC-E', label: 'BC-E' },
  { value: 'SC', label: 'SC' },
  { value: 'ST', label: 'ST' },
  { value: 'Minority', label: 'Minority' },
];

export default function StudentsPage() {
  const { lang } = useLang();
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
  // Extended form: includes gender + socioeconomic_category for DISE compliance
  const [addForm, setAddForm] = useState({
    name: '', class: '', section: '', phone_parent: '', parent_name: '',
    gender: '', socioeconomic_category: '',
  });
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);
  const [loginBusyId, setLoginBusyId] = useState<string | null>(null);
  const [loginMsg, setLoginMsg] = useState<Record<string, string>>({});
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ status: statusFilter, limit: '500' });
    if (search) params.set('q', search);
    const r = await fetch(`/api/students?${params}`);
    const d = await r.json() as { students?: Student[] };
    setStudents(d.students ?? []);
    setLoading(false);
  }, [statusFilter, search]);

  useEffect(() => { void load(); }, [statusFilter]);

  function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast(msg); setToastType(type); setTimeout(() => setToast(''), 3500);
  }

  async function doAction(fields: Record<string, string>) {
    if (!selected || !actionModal) return;
    setActing(true);
    const body: Record<string, unknown> = { id: selected.id, action: actionModal, ...fields };
    if (actionModal === 'graduate' && fields.graduation_year) body.graduation_year = Number(fields.graduation_year);
    const r = await fetch('/api/students', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json() as { error?: string }; setActing(false);
    if (!r.ok) { showToast(d.error ?? T('error', lang as never), 'err'); return; }
    showToast(selected.name + ' — ' + T(actionModal + '_action', lang as never));
    setActionModal(null); setSelected(null); void load();
  }

  async function addStudent() {
    if (!addForm.name.trim()) { setAddError(T('required', lang as never)); return; }
    setAdding(true); setAddError('');
    // Build body — only include non-empty fields
    const body: Record<string, string> = { name: addForm.name, class: addForm.class, section: addForm.section };
    if (addForm.phone_parent)          body.phone_parent          = addForm.phone_parent;
    if (addForm.parent_name)           body.parent_name           = addForm.parent_name;
    if (addForm.gender)                body.gender                = addForm.gender;
    if (addForm.socioeconomic_category) body.socioeconomic_category = addForm.socioeconomic_category;
    const r = await fetch('/api/students', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json() as { error?: string }; setAdding(false);
    if (!r.ok) { setAddError(d.error ?? T('error', lang as never)); return; }
    showToast(T('students', lang as never) + ' ' + T('saved', lang as never));
    setShowAdd(false);
    setAddForm({ name: '', class: '', section: '', phone_parent: '', parent_name: '', gender: '', socioeconomic_category: '' });
    void load();
  }

  const STATUSES = ['active', 'graduated', 'transferred', 'withdrawn', 'archived', 'all'];
  const STATUS_KEYS: Record<string, string> = { active: 'active', graduated: 'graduated', transferred: 'transferred', withdrawn: 'withdrawn', archived: 'archived', all: 'all_students' };

  const SEL_STYLE = { width: '100%', height: 36, border: '1px solid #D1D5DB', borderRadius: 7, padding: '0 8px', fontSize: 13, boxSizing: 'border-box' as const, background: '#fff' };
  const INP_STYLE = { width: '100%', height: 36, border: '1px solid #D1D5DB', borderRadius: 7, padding: '0 10px', fontSize: 13, boxSizing: 'border-box' as const };
  const LBL_STYLE = { fontSize: 11, fontWeight: 600 as const, color: '#6B7280', display: 'block' as const, marginBottom: 3 };

  return (
    <Layout title={T('students', lang as never)} subtitle={`${students.length} ${statusFilter === 'all' ? T('all_students', lang as never) : T(STATUS_KEYS[statusFilter] ?? statusFilter, lang as never)} ${T('students', lang as never)}`}>
      {toast && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: toastType === 'err' ? '#991B1B' : '#111827', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>{toast}</div>
      )}

      {selected && actionModal && (
        <ActionModal student={selected} action={actionModal} acting={acting} lang={lang}
          onConfirm={doAction} onClose={() => { setActionModal(null); setSelected(null); }} />
      )}

      {/* Status filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {STATUSES.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            style={{ padding: '5px 12px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: statusFilter === s ? '#4F46E5' : '#F3F4F6', color: statusFilter === s ? '#fff' : '#374151' }}>
            {T(STATUS_KEYS[s] ?? s, lang as never)}
          </button>
        ))}
      </div>

      {/* Search + Add */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && void load()}
          placeholder={T('search_students', lang as never)}
          style={{ flex: 1, minWidth: 180, height: 38, border: '1px solid #D1D5DB', borderRadius: 8, padding: '0 12px', fontSize: 14 }} />
        <button onClick={() => setShowAdd(v => !v)} style={{ padding: '8px 16px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {showAdd ? T('cancel', lang as never) : '+ ' + T('add_student', lang as never)}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{T('add_student', lang as never)}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
            {/* Text fields */}
            {([
              { labelKey: 'name', key: 'name' },
              { labelKey: 'class_', key: 'class' },
              { labelKey: 'section', key: 'section' },
              { labelKey: 'parent_phone', key: 'phone_parent' },
              { labelKey: 'parent_name_label', key: 'parent_name' },
            ] as { labelKey: string; key: string }[]).map(f => (
              <div key={f.key}>
                <label style={LBL_STYLE}>{T(f.labelKey, lang as never)}</label>
                <input value={(addForm as Record<string, string>)[f.key]}
                  onChange={e => setAddForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={INP_STYLE} />
              </div>
            ))}
            {/* Gender — required for DISE export */}
            <div>
              <label style={LBL_STYLE}>Gender / లింగం</label>
              <select value={addForm.gender}
                onChange={e => setAddForm(prev => ({ ...prev, gender: e.target.value }))}
                style={SEL_STYLE}>
                {GENDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {/* Socioeconomic Category — required for DISE / scholarship reports */}
            <div>
              <label style={LBL_STYLE}>Category / వర్గం (DISE)</label>
              <select value={addForm.socioeconomic_category}
                onChange={e => setAddForm(prev => ({ ...prev, socioeconomic_category: e.target.value }))}
                style={SEL_STYLE}>
                {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          {addError && <div style={{ color: '#991B1B', fontSize: 12, marginTop: 8 }}>{addError}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={() => void addStudent()} disabled={adding} style={{ padding: '8px 14px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {adding ? T('loading', lang as never) : T('add', lang as never)}
            </button>
            <button onClick={() => setShowAdd(false)} style={{ padding: '8px 14px', background: '#fff', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>{T('cancel', lang as never)}</button>
          </div>
        </div>
      )}

      {/* Student list */}
      {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>{T('loading', lang as never)}</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {students.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>{T('no_students_found', lang as never)}</div>}
          {students.map(s => {
            const [bg, fg] = STATUS_BADGE[s.status] ?? ['#F3F4F6', '#6B7280'];
            return (
              <div key={s.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>
                      {s.class ? `${T('class_', lang as never)} ${s.class}` : ''}{s.section ? `-${s.section}` : ''}{s.roll_number ? ` · Roll ${s.roll_number}` : ''}{s.admission_number ? ` · Adm ${s.admission_number}` : ''}
                    </div>
                    {s.parent_name && <div style={{ fontSize: 11, color: '#9CA3AF' }}>{T('parents', lang as never)}: {s.parent_name}{s.phone_parent ? ` · ${s.phone_parent}` : ''}</div>}
                    {s.status === 'transferred' && s.transfer_school && <div style={{ fontSize: 11, color: '#1E40AF' }}>→ {s.transfer_school} ({s.transfer_date})</div>}
                    {s.status === 'graduated' && s.graduation_year && <div style={{ fontSize: 11, color: '#3730A3' }}>{T('graduated', lang as never)} {s.graduation_year}</div>}
                  </div>
                  <span style={{ padding: '3px 9px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: bg, color: fg, marginLeft: 8, flexShrink: 0 }}>
                    {s.status ? T(STATUS_KEYS[s.status] ?? s.status, lang as never) : '—'}
                  </span>
                </div>
                {s.status === 'active' && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {([
                      ['edit', 'edit', '#F3F4F6', '#374151', '#E5E7EB'],
                      ['transfer_action', 'transfer', '#EFF6FF', '#1E40AF', '#BFDBFE'],
                      ['graduate_action', 'graduate', '#EDE9FE', '#5B21B6', '#DDD6FE'],
                      ['withdraw_action', 'withdraw', '#FEF9C3', '#92400E', '#FDE68A'],
                      ['archive_action', 'archive', '#F9FAFB', '#6B7280', '#E5E7EB'],
                    ] as [string, string, string, string, string][]).map(([labelKey, act, bg2, fg2, border]) => (
                      <button key={act} onClick={() => { setSelected(s); setActionModal(act as typeof actionModal); }}
                        style={{ padding: '4px 10px', fontSize: 12, background: bg2, border: `1px solid ${border}`, borderRadius: 6, cursor: 'pointer', color: fg2 }}>
                        {T(labelKey, lang as never)}
                      </button>
                    ))}
                  </div>
                )}
                {s.status !== 'active' && s.status !== 'graduated' && (
                  <div style={{ marginTop: 8 }}>
                    <button onClick={async () => {
                      const r = await fetch('/api/students', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id, action: 'reactivate' }) });
                      if (r.ok) { showToast(s.name + ' ' + T('reactivate', lang as never)); void load(); } else showToast(T('error', lang as never), 'err');
                    }} style={{ padding: '4px 10px', fontSize: 12, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 6, cursor: 'pointer', color: '#065F46' }}>
                      {T('reactivate', lang as never)}
                    </button>
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
