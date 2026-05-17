'use client';
// app/librarian/page.tsx
// Dedicated portal for librarian role — simple issue/return workflow
// Accessed via /librarian after login with role=librarian
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Issue { id: string; issued_date: string; due_date: string; status: string; fine_amount: number | null; item: { title: string; accession_number: string } | null; student: { name: string; class: string; section: string } | null; }
interface LibItem { id: string; accession_number: string; title: string; available_copies: number; total_copies: number; }

export default function LibrarianPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'search' | 'issued' | 'overdue'>('issued');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [items, setItems] = useState<LibItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const [issueForm, setIssueForm] = useState({ item_id: '', student_id: '', due_date: '' });
  const [issueError, setIssueError] = useState('');
  const [issuing, setIssuing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const view = tab === 'search' ? 'items' : tab;
    const q = tab === 'search' && search ? `?q=${encodeURIComponent(search)}` : tab === 'search' ? '' : `?view=${tab}`;
    const r = await fetch(`/api/admin/library${q}`);
    const d = await r.json();
    if (tab === 'search') setItems(d.items ?? []);
    else setIssues(d.issues ?? []);
    setLoading(false);
  }, [tab, search]);

  useEffect(() => { load(); }, [tab]);

  async function issueBook() {
    if (!issueForm.item_id || !issueForm.student_id || !issueForm.due_date) { setIssueError('All fields required'); return; }
    setIssuing(true); setIssueError('');
    const r = await fetch('/api/admin/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'issue', ...issueForm }) });
    const d = await r.json(); setIssuing(false);
    if (!r.ok) { setIssueError(d.error ?? 'Failed'); return; }
    setToast('Book issued successfully'); setTimeout(() => setToast(''), 3000);
    setIssueForm({ item_id: '', student_id: '', due_date: '' }); load();
  }

  async function returnBook(id: string) {
    const r = await fetch('/api/admin/library', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'return' }) });
    const d = await r.json();
    if (r.ok) { setToast(d.overdue_days > 0 ? `Returned · Fine ₹${d.fine_amount}` : 'Returned'); setTimeout(() => setToast(''), 3000); load(); }
  }

  const today = new Date().toISOString().split('T')[0];
  const overdueCount = issues.filter(i => i.status === 'issued' && i.due_date < today).length;

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: '#111827', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>{toast}</div>}

      <div style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>📚 Library</div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>Librarian Portal</div>
        </div>
        <button onClick={() => { fetch('/api/auth/logout', { method: 'POST' }); router.push('/login'); }}
          style={{ padding: '6px 12px', border: '1px solid #E5E7EB', borderRadius: 7, background: '#fff', fontSize: 12, cursor: 'pointer' }}>Sign out</button>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: 20 }}>
        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
          {[['Issued Today', issues.filter(i => i.issued_date === today).length, '#4F46E5'], ['Active Issues', issues.filter(i => i.status === 'issued').length, '#0891B2'], ['Overdue', overdueCount, overdueCount > 0 ? '#DC2626' : '#6B7280']].map(([label, val, color]) => (
            <div key={label as string} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: color as string }}>{val as number}</div>
              <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>{label as string}</div>
            </div>
          ))}
        </div>

        {/* Issue form */}
        <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1E40AF', marginBottom: 10 }}>Issue a Book</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
            {[['Item ID *', 'item_id', 'text'], ['Student ID *', 'student_id', 'text'], ['Due Date *', 'due_date', 'date']].map(([label, key, type]) => (
              <div key={key}><label style={{ fontSize: 11, fontWeight: 600, color: '#1E40AF', display: 'block', marginBottom: 3 }}>{label}</label>
                <input type={type} value={(issueForm as Record<string,string>)[key]} onChange={e => setIssueForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ width: '100%', height: 36, border: '1px solid #BFDBFE', borderRadius: 7, padding: '0 10px', fontSize: 13, boxSizing: 'border-box' }} /></div>
            ))}
          </div>
          {issueError && <div style={{ color: '#991B1B', fontSize: 12, marginTop: 6 }}>{issueError}</div>}
          <button onClick={issueBook} disabled={issuing} style={{ marginTop: 10, padding: '8px 18px', background: '#1D4ED8', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {issuing ? 'Issuing...' : 'Issue Book'}
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 14, background: '#F3F4F6', borderRadius: 8, padding: 4 }}>
          {[['issued', '📤 Issued'], ['overdue', '⚠️ Overdue'], ['search', '🔍 Search Books']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key as 'search' | 'issued' | 'overdue')}
              style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: tab === key ? '#fff' : 'transparent', color: tab === key ? '#111827' : '#6B7280',
                boxShadow: tab === key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'search' && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by title, author, accession..."
              style={{ flex: 1, height: 38, border: '1px solid #D1D5DB', borderRadius: 8, padding: '0 12px', fontSize: 14 }} />
            <button onClick={load} style={{ padding: '8px 14px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Search</button>
          </div>
        )}

        {loading ? <div style={{ textAlign: 'center', padding: 32, color: '#6B7280' }}>Loading...</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tab === 'search' && items.map(item => (
              <div key={item.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>ID: {item.id} · #{item.accession_number}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: item.available_copies > 0 ? '#065F46' : '#DC2626' }}>
                  {item.available_copies}/{item.total_copies}
                </div>
              </div>
            ))}
            {(tab === 'issued' || tab === 'overdue') && issues.map(issue => (
              <div key={issue.id} style={{ background: '#fff', border: `1px solid ${tab === 'overdue' ? '#FED7AA' : '#E5E7EB'}`, borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{issue.item?.title ?? '—'}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>{issue.student?.name} · Cls {issue.student?.class}-{issue.student?.section}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>Due: {issue.due_date}{issue.fine_amount ? ` · Fine ₹${issue.fine_amount}` : ''}</div>
                </div>
                {issue.status === 'issued' && (
                  <button onClick={() => returnBook(issue.id)} style={{ padding: '6px 12px', background: '#065F46', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>Return</button>
                )}
              </div>
            ))}
            {tab !== 'search' && issues.length === 0 && <div style={{ textAlign: 'center', padding: 32, color: '#9CA3AF' }}>{tab === 'overdue' ? 'No overdue books 🎉' : 'No active issues'}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
