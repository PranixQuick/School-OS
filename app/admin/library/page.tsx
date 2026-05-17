'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

interface LibItem { id: string; accession_number: string; title: string; author: string | null; category: string | null; available_copies: number; total_copies: number; }
interface Issue { id: string; issued_date: string; due_date: string; returned_date: string | null; fine_amount: number | null; fine_paid: boolean; status: string; item?: { title: string; accession_number: string } | null; student?: { name: string; class: string | null; section: string | null } | null; }
interface Student { id: string; name: string; class: string | null; section: string | null; }

export default function LibraryPage() {
  const [tab, setTab] = useState<'items' | 'issues' | 'overdue'>('items');
  const [items, setItems] = useState<LibItem[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddItem, setShowAddItem] = useState(false);
  const [showIssue, setShowIssue] = useState(false);
  const [itemForm, setItemForm] = useState({ accession_number: '', title: '', author: '', category: '', total_copies: '1' });
  const [issueForm, setIssueForm] = useState({ item_id: '', student_id: '', due_date: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function loadData() {
    setLoading(true);
    const q = search ? `?q=${encodeURIComponent(search)}` : '';
    const [it, is, st] = await Promise.all([
      fetch(`/api/admin/library${q}`).then(r => r.json()),
      fetch('/api/admin/library?view=issues').then(r => r.json()),
      fetch('/api/students?limit=500').then(r => r.json()),
    ]);
    setItems(it.items ?? []);
    setIssues(is.issues ?? []);
    setStudents(st.students ?? []);
    setLoading(false);
  }
  useEffect(() => { void loadData(); }, []);

  async function addItem() {
    setSaving(true); setMsg('');
    const res = await fetch('/api/admin/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...itemForm, total_copies: Number(itemForm.total_copies) }) });
    const d = await res.json();
    setSaving(false);
    if (res.ok) { setMsg('Book added'); setShowAddItem(false); setItemForm({ accession_number: '', title: '', author: '', category: '', total_copies: '1' }); void loadData(); }
    else setMsg(d.error ?? 'Error');
  }

  async function issueBook() {
    setSaving(true); setMsg('');
    const res = await fetch('/api/admin/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'issue', ...issueForm }) });
    const d = await res.json();
    setSaving(false);
    if (res.ok) { setMsg('Book issued'); setShowIssue(false); setIssueForm({ item_id: '', student_id: '', due_date: '' }); void loadData(); }
    else setMsg(d.error ?? 'Error');
  }

  async function returnBook(issueId: string) {
    const res = await fetch('/api/admin/library', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: issueId, action: 'return' }) });
    const d = await res.json();
    if (res.ok) setMsg(`Returned. Fine: ₹${d.fine_amount ?? 0}`);
    else setMsg(d.error ?? 'Error');
    void loadData();
  }

  const overdueIssues = issues.filter(i => i.status === 'issued' && new Date(i.due_date) < new Date() && !i.returned_date);
  const displayIssues = tab === 'overdue' ? overdueIssues : issues;
  const S = { card: { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 14, marginBottom: 8 } as React.CSSProperties };

  return (
    <Layout title="Library" subtitle="Book inventory, issue and return tracking">
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 16px 40px' }}>
        {msg && <div style={{ background: msg.includes('rror') ? '#FEE2E2' : '#D1FAE5', color: msg.includes('rror') ? '#991B1B' : '#065F46', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>{msg}</div>}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 16, background: '#F3F4F6', borderRadius: 10, padding: 4 }}>
          {(['items','issues','overdue'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex: 1, padding: '8px 4px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: tab === t ? '#fff' : 'transparent', color: tab === t ? '#111827' : '#6B7280', boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
              {t === 'items' ? `Books (${items.length})` : t === 'issues' ? `Issued (${issues.filter(i => i.status === 'issued').length})` : `Overdue (${overdueIssues.length})`}
            </button>
          ))}
        </div>

        {tab === 'items' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void loadData(); }} placeholder="Search by title, author, accession no..." style={{ flex: 1, padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13 }} />
              <button onClick={() => void loadData()} style={{ padding: '8px 14px', background: '#F3F4F6', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Search</button>
              <button onClick={() => setShowAddItem(true)} style={{ padding: '8px 14px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Add Book</button>
              <button onClick={() => setShowIssue(true)} style={{ padding: '8px 14px', background: '#065F46', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Issue</button>
            </div>

            {showAddItem && (
              <div style={{ ...S.card, border: '2px solid #4F46E5', marginBottom: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 10 }}>Add Book to Inventory</div>
                {(['accession_number', 'title', 'author', 'category'] as const).map(k => (
                  <div key={k} style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>{k.replace('_', ' ').toUpperCase()}{k === 'accession_number' || k === 'title' ? ' *' : ''}</label>
                    <input value={itemForm[k]} onChange={e => setItemForm(f => ({ ...f, [k]: e.target.value }))} style={{ width: '100%', padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' as const }} />
                  </div>
                ))}
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>COPIES</label>
                  <input type="number" value={itemForm.total_copies} onChange={e => setItemForm(f => ({ ...f, total_copies: e.target.value }))} style={{ width: 80, padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13 }} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={addItem} disabled={saving} style={{ flex: 1, padding: '8px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{saving ? 'Adding...' : 'Add Book'}</button>
                  <button onClick={() => setShowAddItem(false)} style={{ padding: '8px 14px', background: '#F3F4F6', border: 'none', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}

            {showIssue && (
              <div style={{ ...S.card, border: '2px solid #065F46', marginBottom: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 10 }}>Issue Book to Student</div>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>BOOK *</label>
                  <select value={issueForm.item_id} onChange={e => setIssueForm(f => ({ ...f, item_id: e.target.value }))} style={{ width: '100%', padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13 }}>
                    <option value="">— Select book —</option>
                    {items.filter(i => i.available_copies > 0).map(i => <option key={i.id} value={i.id}>{i.accession_number} — {i.title} ({i.available_copies} avail.)</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>STUDENT *</label>
                  <select value={issueForm.student_id} onChange={e => setIssueForm(f => ({ ...f, student_id: e.target.value }))} style={{ width: '100%', padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13 }}>
                    <option value="">— Select student —</option>
                    {students.map(s => <option key={s.id} value={s.id}>{s.name}{s.class ? ` — Class ${s.class}${s.section ?? ''}` : ''}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>DUE DATE *</label>
                  <input type="date" value={issueForm.due_date} onChange={e => setIssueForm(f => ({ ...f, due_date: e.target.value }))} style={{ width: '100%', padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13 }} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={issueBook} disabled={saving || !issueForm.item_id || !issueForm.student_id || !issueForm.due_date}
                    style={{ flex: 1, padding: '8px', background: '#065F46', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{saving ? 'Issuing...' : 'Issue Book'}</button>
                  <button onClick={() => setShowIssue(false)} style={{ padding: '8px 14px', background: '#F3F4F6', border: 'none', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}

            {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading...</div> :
              items.length === 0 ? <div style={{ textAlign: 'center', padding: 48, color: '#9CA3AF' }}><div style={{ fontSize: 32, marginBottom: 8 }}>📗</div><div>No books yet. Add your first book to begin.</div></div> :
              items.map(i => (
                <div key={i.id} style={S.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ background: '#F3F4F6', color: '#374151', borderRadius: 5, padding: '1px 6px', fontSize: 11, fontWeight: 600, marginRight: 6 }}>{i.accession_number}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{i.title}</span>
                      {i.author && <span style={{ fontSize: 12, color: '#6B7280', marginLeft: 6 }}>— {i.author}</span>}
                    </div>
                    <span style={{ background: i.available_copies > 0 ? '#D1FAE5' : '#FEE2E2', color: i.available_copies > 0 ? '#065F46' : '#991B1B', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                      {i.available_copies}/{i.total_copies}
                    </span>
                  </div>
                </div>
              ))}
          </>
        )}

        {(tab === 'issues' || tab === 'overdue') && (
          loading ? <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading...</div> :
          displayIssues.length === 0 ? <div style={{ textAlign: 'center', padding: 48, color: '#9CA3AF' }}><div style={{ fontSize: 32, marginBottom: 8 }}>{tab === 'overdue' ? '⚠️' : '📋'}</div><div>{tab === 'overdue' ? 'No overdue books.' : 'No active issues.'}</div></div> :
          displayIssues.map(i => {
            const isOverdue = new Date(i.due_date) < new Date() && !i.returned_date;
            return (
              <div key={i.id} style={{ ...S.card, borderLeft: `3px solid ${isOverdue ? '#F87171' : i.returned_date ? '#D1D5DB' : '#4F46E5'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{i.item?.title ?? '—'}</div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>{i.student?.name ?? '—'}{i.student?.class ? ` · Class ${i.student.class}` : ''}</div>
                    <div style={{ fontSize: 11, color: isOverdue ? '#991B1B' : '#6B7280', marginTop: 2 }}>
                      Due: {i.due_date}{isOverdue ? ' ⚠ OVERDUE' : ''}
                      {i.fine_amount ? ` · Fine: ₹${i.fine_amount}` : ''}
                    </div>
                  </div>
                  {!i.returned_date && (
                    <button onClick={() => void returnBook(i.id)} style={{ padding: '5px 10px', background: '#D1FAE5', color: '#065F46', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}>Return</button>
                  )}
                  {i.returned_date && <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>Returned {i.returned_date}</span>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </Layout>
  );
}
