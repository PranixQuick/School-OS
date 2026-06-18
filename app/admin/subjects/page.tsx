'use client';
// app/admin/subjects/page.tsx
// ISS-3 (#3) — Admin subjects management: list / add / change-kind / delete,
// plus "add from template" prefill backed by period_templates.

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface Subject { id: string; code: string; name: string; subject_kind: string; board_alignment: string | null }
interface Template { id: string; kind: string; default_name: string; default_minutes: number | null; sort_order: number }

const KINDS = ['academic', 'lab', 'sports', 'activity', 'seminar', 'library', 'break', 'remedial'];
const KIND_COLOR: Record<string, string> = {
  academic: '#4F46E5', lab: '#0EA5E9', sports: '#16A34A', activity: '#D97706',
  seminar: '#7C3AED', library: '#0891B2', break: '#6B7280', remedial: '#B91C1C',
};

export default function AdminSubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ code: '', name: '', subject_kind: 'academic' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const loadSubjects = useCallback(async () => {
    const r = await fetch('/api/admin/subjects');
    if (r.ok) { const d = await r.json(); setSubjects(d.subjects ?? []); }
  }, []);

  useEffect(() => {
    Promise.all([
      loadSubjects(),
      fetch('/api/admin/period-templates').then(r => r.ok ? r.json() : { templates: [] }).then(d => setTemplates(d.templates ?? [])).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [loadSubjects]);

  async function addSubject() {
    if (!form.code.trim() || !form.name.trim()) { setMsg({ kind: 'err', text: 'Code and name are required.' }); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/admin/subjects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const d = await r.json();
      if (r.ok) { setForm({ code: '', name: '', subject_kind: 'academic' }); setMsg({ kind: 'ok', text: `Added "${d.subject?.name}".` }); await loadSubjects(); }
      else setMsg({ kind: 'err', text: d.error ?? 'Could not add subject.' });
    } catch { setMsg({ kind: 'err', text: 'Network error.' }); }
    finally { setBusy(false); }
  }

  async function changeKind(id: string, subject_kind: string) {
    setMsg(null);
    const r = await fetch('/api/admin/subjects', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, subject_kind }) });
    if (r.ok) { setSubjects(prev => prev.map(s => s.id === id ? { ...s, subject_kind } : s)); }
    else { const d = await r.json().catch(() => ({})); setMsg({ kind: 'err', text: d.error ?? 'Could not update.' }); }
  }

  async function deleteSubject(id: string, name: string) {
    if (!confirm(`Delete subject "${name}"?`)) return;
    setMsg(null);
    const r = await fetch(`/api/admin/subjects?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (r.ok) { setSubjects(prev => prev.filter(s => s.id !== id)); setMsg({ kind: 'ok', text: `Deleted "${name}".` }); }
    else { const d = await r.json().catch(() => ({})); setMsg({ kind: 'err', text: d.error ?? 'Could not delete.' }); }
  }

  function prefillFromTemplate(t: Template) {
    setForm({ code: '', name: t.default_name, subject_kind: t.kind });
    setMsg({ kind: 'ok', text: `Prefilled "${t.default_name}". Enter a code and click Add.` });
  }

  const inputStyle = { padding: '8px 10px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, fontFamily: 'inherit', outline: 'none' as const };

  return (
    <Layout title="Subjects" subtitle="Manage subjects & period kinds">
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Add form */}
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 12 }}>Add subject</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input style={{ ...inputStyle, width: 110 }} placeholder="Code" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
              <input style={{ ...inputStyle, flex: 1, minWidth: 160 }} placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              <select style={{ ...inputStyle, background: '#fff' }} value={form.subject_kind} onChange={e => setForm(f => ({ ...f, subject_kind: e.target.value }))}>
                {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <button onClick={() => void addSubject()} disabled={busy}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: busy ? '#A5B4FC' : '#4F46E5', color: '#fff', fontSize: 14, fontWeight: 700, cursor: busy ? 'default' : 'pointer' }}>
                {busy ? 'Adding…' : 'Add'}
              </button>
            </div>
            {msg && (
              <div style={{ marginTop: 10, fontSize: 13, padding: '8px 12px', borderRadius: 8, background: msg.kind === 'ok' ? '#F0FDF4' : '#FEF2F2', color: msg.kind === 'ok' ? '#065F46' : '#B91C1C' }}>{msg.text}</div>
            )}
          </div>

          {/* Subject list */}
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 12 }}>Subjects ({subjects.length})</div>
            {subjects.length === 0 ? (
              <div style={{ color: '#9CA3AF', fontSize: 13, padding: 12 }}>No subjects yet. Add one above.</div>
            ) : subjects.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: KIND_COLOR[s.subject_kind] ?? '#6B7280', borderRadius: 6, padding: '2px 7px', textTransform: 'capitalize' }}>{s.subject_kind}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>{s.code}</div>
                </div>
                <select value={s.subject_kind} onChange={e => void changeKind(s.id, e.target.value)}
                  style={{ ...inputStyle, padding: '4px 8px', fontSize: 12, background: '#fff' }}>
                  {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
                <button onClick={() => void deleteSubject(s.id, s.name)}
                  style={{ background: 'none', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '4px 10px', cursor: 'pointer' }}>Delete</button>
              </div>
            ))}
          </div>

          {/* Period templates */}
          {templates.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 4 }}>Suggested periods for your institution</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>Tap to prefill the add form, then set a code.</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {templates.map(t => (
                  <button key={t.id} onClick={() => prefillFromTemplate(t)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 20, border: '1px solid #E5E7EB', background: '#F9FAFB', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: KIND_COLOR[t.kind] ?? '#6B7280' }} />
                    {t.default_name}
                    {t.default_minutes != null && <span style={{ color: '#9CA3AF' }}>· {t.default_minutes}m</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
