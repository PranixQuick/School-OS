'use client';
// Library Management — Book issue/return, catalog, fines
// Roles: admin, librarian (both use admin role + designation)
// Mobile-first: large tap areas, offline-tolerant load

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface LibraryItem { id: string; title: string; author: string; subject: string; total_copies: number; available_copies: number; accession_number: string; }
interface LibraryIssue { id: string; status: string; issued_date: string; due_date: string; returned_date: string | null; fine_amount: number; item?: { title: string }; student?: { name: string; class: string }; }

type Tab = 'catalog' | 'issued' | 'overdue';

export default function LibraryPage() {
  const [tab, setTab]         = useState<Tab>('catalog');
  const [items, setItems]     = useState<LibraryItem[]>([]);
  const [issues, setIssues]   = useState<LibraryIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm]       = useState({ title: '', author: '', subject: '', total_copies: '1', accession_number: '' });
  const [saving, setSaving]   = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/library/items');
      if (r.ok) { const d = await r.json() as { items?: LibraryItem[] }; setItems(d.items ?? []); }
    } catch {/**/}
    setLoading(false);
  }, []);

  const loadIssues = useCallback(async (overdue = false) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/library/issues${overdue ? '?overdue=true' : ''}`);
      if (r.ok) { const d = await r.json() as { issues?: LibraryIssue[] }; setIssues(d.issues ?? []); }
    } catch {/**/}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab === 'catalog') loadItems();
    else loadIssues(tab === 'overdue');
  }, [tab, loadItems, loadIssues]);

  async function addItem() {
    if (!form.title) { alert('Title required'); return; }
    setSaving(true);
    const r = await fetch('/api/admin/library/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, total_copies: Number(form.total_copies) }) });
    setSaving(false);
    if (r.ok) { setShowAdd(false); setForm({ title: '', author: '', subject: '', total_copies: '1', accession_number: '' }); void loadItems(); }
  }

  const filtered = items.filter(i => !search || i.title.toLowerCase().includes(search.toLowerCase()) || i.author.toLowerCase().includes(search.toLowerCase()));
  const overdue  = issues.filter(i => i.status === 'issued' && new Date(i.due_date) < new Date());
  const inp      = { height: 44, borderRadius: 9, border: '1px solid #D1D5DB', padding: '0 12px', fontSize: 14, fontFamily: 'inherit', background: '#F9FAFB', width: '100%', boxSizing: 'border-box' as const };

  return (
    <Layout title="Library" subtitle="Book catalog and issue tracking">
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {([['catalog','📚 Catalog'],['issued','📤 Issued'],['overdue','⏰ Overdue']] as [Tab, string][]).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: tab===t ? '#4F46E5' : '#F3F4F6', color: tab===t ? '#fff' : '#374151', fontFamily: 'inherit' }}>
            {l}{t === 'overdue' && overdue.length > 0 ? ` (${overdue.length})` : ''}
          </button>
        ))}
      </div>

      {tab === 'catalog' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search books…" style={{ ...inp, flex: 1 }} />
            <button onClick={() => setShowAdd(v => !v)} style={{ padding: '0 14px', height: 44, borderRadius: 9, border: 'none', background: '#4F46E5', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
              {showAdd ? '✕' : '+ Add'}
            </button>
          </div>
          {showAdd && (
            <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div style={{ gridColumn: '1/-1' }}><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Title *</label><input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} style={inp} /></div>
                <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Author</label><input value={form.author} onChange={e => setForm(p => ({ ...p, author: e.target.value }))} style={inp} /></div>
                <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Subject</label><input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} style={inp} /></div>
                <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Copies</label><input type="number" inputMode="numeric" value={form.total_copies} onChange={e => setForm(p => ({ ...p, total_copies: e.target.value }))} style={inp} /></div>
                <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Accession No.</label><input value={form.accession_number} onChange={e => setForm(p => ({ ...p, accession_number: e.target.value }))} style={inp} /></div>
              </div>
              <button onClick={() => void addItem()} disabled={saving} style={{ width: '100%', height: 44, borderRadius: 10, border: 'none', background: saving ? '#9CA3AF' : '#4F46E5', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Saving…' : '💾 Add Book'}
              </button>
            </div>
          )}
          {loading ? <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div> : filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>No books yet. Click "+ Add" to add books to the catalog.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(item => (
                <div key={item.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{item.title}</div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{item.author}{item.subject ? ` · ${item.subject}` : ''}</div>
                      {item.accession_number && <div style={{ fontSize: 11, color: '#9CA3AF' }}>Acc: {item.accession_number}</div>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: item.available_copies > 0 ? '#15803D' : '#B91C1C' }}>{item.available_copies}</div>
                      <div style={{ fontSize: 10, color: '#9CA3AF' }}>of {item.total_copies} avail</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {(tab === 'issued' || tab === 'overdue') && (
        loading ? <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div> :
        issues.length === 0 ? <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>No {tab === 'overdue' ? 'overdue' : 'issued'} books</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {issues.map(issue => {
              const isOverdue = issue.status === 'issued' && new Date(issue.due_date) < new Date();
              return (
                <div key={issue.id} style={{ background: '#fff', border: `1px solid ${isOverdue ? '#FECACA' : '#E5E7EB'}`, borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{issue.item?.title ?? '—'}</div>
                      <div style={{ fontSize: 12, color: '#6B7280' }}>{issue.student?.name ?? '—'} · Class {issue.student?.class ?? '—'}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>Issued: {issue.issued_date} · Due: {issue.due_date}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {isOverdue && <div style={{ fontSize: 11, fontWeight: 700, color: '#B91C1C', background: '#FEF2F2', padding: '2px 8px', borderRadius: 6 }}>OVERDUE</div>}
                      {issue.fine_amount > 0 && <div style={{ fontSize: 12, fontWeight: 700, color: '#D97706', marginTop: 4 }}>₹{issue.fine_amount}</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </Layout>
  );
}
