'use client';
// Internship / Industrial Training Management
// Engineering: industrial training, project internships
// Medical/Nursing: hospital rotations, clinical postings
// Degree/MBA: company internships, field placements
// Roles: admin, hod, placement_officer
// Mobile-first: add + track + close internships

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';

interface Internship {
  id: string; company_name: string; role: string; location: string;
  start_date: string; end_date: string; status: string; stipend_amount: number;
  completion_cert_url: string | null; grade: string | null;
  student?: { name: string; class: string };
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  ongoing:   { bg: '#EFF6FF', color: '#2563EB' },
  completed: { bg: '#F0FDF4', color: '#15803D' },
  terminated:{ bg: '#FEF2F2', color: '#B91C1C' },
};

type Tab = 'active' | 'completed' | 'add';

export default function InternshipsPage() {
  const [internships, setInternships] = useState<Internship[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<Tab>('active');
  const [saving, setSaving]     = useState(false);
  const [students, setStudents] = useState<{ id: string; name: string; class: string }[]>([]);
  const [form, setForm]         = useState({
    student_id: '', company_name: '', role: '', location: '',
    start_date: '', end_date: '', stipend_amount: '0', mentor_name: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const status = tab === 'active' ? 'ongoing' : tab === 'completed' ? 'completed' : '';
      const r = await fetch(`/api/admin/internships${status ? `?status=${status}` : ''}`);
      if (r.ok) { const d = await r.json() as { internships?: Internship[] }; setInternships(d.internships ?? []); }
    } catch {/**/}
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    void load();
    if (tab === 'add') {
      fetch('/api/admin/internships/students')
        .then(r => r.ok ? r.json() : null)
        .then((d: { students?: { id: string; name: string; class: string }[] } | null) => { if (d?.students) setStudents(d.students); })
        .catch(() => {});
    }
  }, [tab, load]);

  async function addInternship() {
    if (!form.student_id || !form.company_name) { alert('Student and company required'); return; }
    setSaving(true);
    const r = await fetch('/api/admin/internships', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, stipend_amount: Number(form.stipend_amount) }),
    });
    setSaving(false);
    if (r.ok) { setTab('active'); void load(); setForm({ student_id: '', company_name: '', role: '', location: '', start_date: '', end_date: '', stipend_amount: '0', mentor_name: '' }); }
    else { const d = await r.json() as { error?: string }; alert(d.error ?? 'Error'); }
  }

  const inp = { height: 44, borderRadius: 9, border: '1px solid #D1D5DB', padding: '0 12px', fontSize: 14, fontFamily: 'inherit', background: '#F9FAFB', width: '100%', boxSizing: 'border-box' as const };

  return (
    <Layout title="Internships" subtitle="Industrial training and placement tracking">
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {([['active','🏭 Active'],['completed','✅ Completed'],['add','+ Add']] as [Tab, string][]).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: tab===t ? '#4F46E5' : '#F3F4F6', color: tab===t ? '#fff' : '#374151', fontFamily: 'inherit' }}>
            {l}
          </button>
        ))}
        <Link href="/admin/placement" style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: '#F0FDF4', color: '#15803D', textDecoration: 'none' }}>
          💼 Placement →
        </Link>
      </div>

      {tab === 'add' && (
        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Student *</label>
              <select value={form.student_id} onChange={e => setForm(p => ({ ...p, student_id: e.target.value }))} style={inp}>
                <option value="">Select student</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.class})</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Company / Hospital / Organisation *</label>
              <input value={form.company_name} onChange={e => setForm(p => ({ ...p, company_name: e.target.value }))} placeholder="e.g. Infosys, AIIMS Delhi, TCS…" style={inp} />
            </div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Role / Department</label>
              <input value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} placeholder="e.g. Software Intern, Clinical Posting" style={inp} />
            </div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Location</label>
              <input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="City" style={inp} />
            </div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Start Date</label>
              <input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} style={inp} />
            </div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>End Date</label>
              <input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} style={inp} />
            </div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Stipend (₹/month)</label>
              <input type="number" inputMode="numeric" value={form.stipend_amount} onChange={e => setForm(p => ({ ...p, stipend_amount: e.target.value }))} style={inp} />
            </div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Mentor Name</label>
              <input value={form.mentor_name} onChange={e => setForm(p => ({ ...p, mentor_name: e.target.value }))} style={inp} />
            </div>
          </div>
          <button onClick={() => void addInternship()} disabled={saving} style={{ width: '100%', height: 48, borderRadius: 12, border: 'none', background: saving ? '#9CA3AF' : '#4F46E5', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Saving…' : '🏭 Add Internship'}
          </button>
        </div>
      )}

      {(tab === 'active' || tab === 'completed') && (
        loading ? <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div> :
        internships.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', background: '#F9FAFB', borderRadius: 12 }}>
            No {tab} internships. Click "+ Add" to add one.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {internships.map(i => {
              const ss = STATUS_STYLE[i.status] ?? STATUS_STYLE.ongoing;
              return (
                <div key={i.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{i.student?.name ?? 'Student'}</div>
                      <div style={{ fontSize: 13, color: '#374151', marginTop: 1 }}>{i.company_name}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
                        {i.role}{i.location ? ` · ${i.location}` : ''} · {i.start_date} → {i.end_date}
                      </div>
                      {i.stipend_amount > 0 && (
                        <div style={{ fontSize: 11, color: '#15803D', marginTop: 1 }}>₹{i.stipend_amount}/mo stipend</div>
                      )}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 8, background: ss.bg, color: ss.color, flexShrink: 0 }}>
                      {i.status}
                    </span>
                  </div>
                  {i.grade && (
                    <div style={{ marginTop: 8, display: 'inline-block', fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 6, background: '#F0FDF4', color: '#15803D' }}>
                      Grade: {i.grade}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </Layout>
  );
}
