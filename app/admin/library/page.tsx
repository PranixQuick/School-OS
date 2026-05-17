'use client';
// app/admin/library/page.tsx
import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface LibItem { id: string; accession_number: string; title: string; author: string | null; subject: string | null; category: string | null; total_copies: number; available_copies: number; }
interface Issue { id: string; borrower_type: string; issued_date: string; due_date: string; returned_date: string | null; fine_amount: number | null; fine_paid: boolean; status: string; item: { title: string; accession_number: string } | null; student: { name: string; class: string; section: string } | null; }

type IssueView = 'issues' | 'overdue';
type Tab = 'items' | IssueView;

export default function LibraryPage() {
  const [tab, setTab] = useState<Tab>('items');
  const [items, setItems] = useState<LibItem[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');

  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueItemId, setIssueItemId] = useState('');
  const [issueStudentId, setIssueStudentId] = useState('');
  const [issueDueDate, setIssueDueDate] = useState('');
  const [issueError, setIssueError] = useState('');
  const [issueSubmitting, setIssueSubmitting] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ accession_number: '', title: '', author: '', subject: '', category: '', total_copies: '1' });
  const [addError, setAddError] = useState('');
  const [addSubmitting, setAddSubmitting] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const q = search ? `?q=${encodeURIComponent(search)}` : '';
      const r = await fetch(`/api/admin/library${q}`);
      const d = await r.json();
      setItems(d.items ?? []);
    } finally { setLoading(false); }
  }, [search]);

  const fetchIssues = useCallback(async (view: IssueView) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/library?view=${view}`);
      const d = await r.json();
      setIssues(d.issues ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === 'items') fetchItems();
    else fetchIssues(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function issueBook() {
    if (!issueItemId || !issueStudentId || !issueDueDate) { setIssueError('All fields required'); return; }
    setIssueSubmitting(true); setIssueError('');
    const r = await fetch('/api/admin/library', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'issue', item_id: issueItemId, student_id: issueStudentId, due_date: issueDueDate }) });
    const d = await r.json(); setIssueSubmitting(false);
    if (!r.ok) { setIssueError(d.error ?? 'Failed'); return; }
    setToast('Book issued'); setTimeout(() => setToast(''), 3000);
    setShowIssueForm(false); setIssueItemId(''); setIssueStudentId(''); setIssueDueDate('');
    if (tab === 'items') fetchItems(); else fetchIssues(tab);
  }

  async function returnBook(issueId: string) {
    const r = await fetch('/api/admin/library', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: issueId, action: 'return' }) });
    const d = await r.json();
    if (r.ok) {
      setToast(d.overdue_days > 0 ? `Returned — Fine: ₹${d.fine_amount}` : 'Returned');
      setTimeout(() => setToast(''), 3000);
      if (tab !== 'items') fetchIssues(tab);
    }
  }

  async function addItem() {
    if (!addForm.accession_number || !addForm.title) { setAddError('Accession number and title required'); return; }
    setAddSubmitting(true); setAddError('');
    const r = await fetch('/api/admin/library', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...addForm, total_copies: Number(addForm.total_copies) || 1 }) });
    const d = await r.json(); setAddSubmitting(false);
    if (!r.ok) { setAddError(d.error ?? 'Failed'); return; }
    setToast('Book added to inventory'); setTimeout(() => setToast(''), 3000);
    setShowAddForm(false); setAddForm({ accession_number: '', title: '', author: '', subject: '', category: '', total_copies: '1' });
    fetchItems();
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'items', label: '📚 Inventory' },
    { key: 'issues', label: '📤 Issued' },
    { key: 'overdue', label: '⚠️ Overdue' },
  ];

  return (
    <Layout title="Library" subtitle="Book inventory and issue/return management">
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: '#111827', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>{toast}</div>}

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#F3F4F6', borderRadius: 10, padding: 4 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: tab === t.key ? '#fff' : 'transparent', color: tab === t.key ? '#111827' : '#6B7280',
              boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {tab === 'items' && (
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchItems()}
            placeholder="Search title, author, accession..." style={{ flex: 1, minWidth: 200, height: 38, border: '1px solid #D1D5DB', borderRadius: 8, padding: '0 12px', fontSize: 14 }} />
        )}
        {tab === 'items' && (
          <>
            <button onClick={() => setShowAddForm(v => !v)} style={{ padding: '8px 16px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Add Book</button>
            <button onClick={() => setShowIssueForm(v => !v)} style={{ padding: '8px 16px', background: '#fff', color: '#374151', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Issue Book</button>
          </>
        )}
      </div>

      {showAddForm && (
        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Add to Inventory</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            {(['accession_number', 'title', 'author', 'subject', 'category', 'total_copies'] as const).map(k => (
              <div key={k}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>{k.replace(/_/g, ' ').toUpperCase()}{['accession_number', 'title'].includes(k) ? ' *' : ''}</label>
                <input value={addForm[k]} onChange={e => setAddForm(f => ({ ...f, [k]: e.target.value }))}
                  type={k === 'total_copies' ? 'number' : 'text'} min="1"
                  style={{ width: '100%', height: 36, border: '1px solid #D1D5DB', borderRadius: 7, padding: '0 10px', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            ))}
          </div>
          {addError && <div style={{ color: '#991B1B', fontSize: 12, marginTop: 8 }}>{addError}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={addItem} disabled={addSubmitting} style={{ padding: '8px 16px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {addSubmitting ? 'Adding...' : 'Add Book'}
            </button>
            <button onClick={() => setShowAddForm(false)} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {showIssueForm && (
        <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Issue a Book</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            {[['Book ID (from inventory)', issueItemId, setIssueItemId, 'text'], ['Student ID', issueStudentId, setIssueStudentId, 'text'], ['Due Date', issueDueDate, setIssueDueDate, 'date']].map(([label, val, setter, type]) => (
              <div key={label as string}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#1E40AF', display: 'block', marginBottom: 3 }}>{label as string} *</label>
                <input type={type as string} value={val as string} onChange={e => (setter as (v: string) => void)(e.target.value)}
                  style={{ width: '100%', height: 36, border: '1px solid #BFDBFE', borderRadius: 7, padding: '0 10px', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            ))}
          </div>
          {issueError && <div style={{ color: '#991B1B', fontSize: 12, marginTop: 8 }}>{issueError}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={issueBook} disabled={issueSubmitting} style={{ padding: '8px 16px', background: '#1D4ED8', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {issueSubmitting ? 'Issuing...' : 'Issue Book'}
            </button>
            <button onClick={() => setShowIssueForm(false)} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>Loading...</div> : (
        <>
          {tab === 'items' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>No books found. Add your first book above.</div>}
              {items.map(item => (
                <div key={item.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>#{item.accession_number}{item.author ? ` · ${item.author}` : ''}{item.subject ? ` · ${item.subject}` : ''}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: item.available_copies > 0 ? '#065F46' : '#991B1B' }}>
                      {item.available_copies}/{item.total_copies} available
                    </div>
                    {item.category && <div style={{ fontSize: 11, color: '#9CA3AF' }}>{item.category}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {(tab === 'issues' || tab === 'overdue') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {issues.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>{tab === 'overdue' ? 'No overdue books. 🎉' : 'No active issues.'}</div>}
              {issues.map(issue => (
                <div key={issue.id} style={{ background: '#fff', border: `1px solid ${tab === 'overdue' ? '#FED7AA' : '#E5E7EB'}`, borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{issue.item?.title ?? 'Unknown'}</div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>
                      {issue.student?.name ?? 'N/A'} · Class {issue.student?.class}-{issue.student?.section}
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>Issued: {issue.issued_date} · Due: {issue.due_date}</div>
                    {issue.fine_amount && issue.fine_amount > 0 && (
                      <div style={{ fontSize: 12, color: '#991B1B', fontWeight: 600 }}>Fine: ₹{issue.fine_amount}{issue.fine_paid ? ' (paid)' : ' (unpaid)'}</div>
                    )}
                  </div>
                  {issue.status === 'issued' && (
                    <button onClick={() => returnBook(issue.id)}
                      style={{ padding: '6px 14px', background: '#065F46', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                      Return
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
