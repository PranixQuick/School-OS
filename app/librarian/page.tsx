'use client';
// Librarian portal — dedicated view for staff with role=librarian
// Uses same /api/admin/library API; minimal navigation, task-focused
import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface Issue { id: string; issued_date: string; due_date: string; returned_date: string | null; fine_amount: number | null; fine_paid: boolean; status: string; item: { title: string; accession_number: string } | null; student: { name: string; class: string; section: string } | null; }
interface Item { id: string; accession_number: string; title: string; author: string | null; available_copies: number; total_copies: number; }

export default function LibrarianPage() {
  const [tab, setTab] = useState<'issue' | 'return' | 'overdue' | 'inventory'>('issue');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [toastErr, setToastErr] = useState(false);

  const [issueItemId, setIssueItemId] = useState('');
  const [issueStudentId, setIssueStudentId] = useState('');
  const [issueDueDate, setIssueDueDate] = useState('');
  const [issueError, setIssueError] = useState('');
  const [itemSearch, setItemSearch] = useState('');

  function msg(m: string, err = false) { setToast(m); setToastErr(err); setTimeout(() => setToast(''), 3500); }

  const loadIssues = useCallback(async (view: 'issues' | 'overdue') => {
    setLoading(true);
    const r = await fetch(`/api/admin/library?view=${view}`);
    const d = await r.json();
    setIssues(d.issues ?? []);
    setLoading(false);
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    const q = itemSearch ? `?q=${encodeURIComponent(itemSearch)}` : '';
    const r = await fetch(`/api/admin/library${q}`);
    const d = await r.json();
    setItems(d.items ?? []);
    setLoading(false);
  }, [itemSearch]);

  useEffect(() => {
    if (tab === 'return') loadIssues('issues');
    else if (tab === 'overdue') loadIssues('overdue');
    else if (tab === 'inventory') loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function issueBook() {
    if (!issueItemId || !issueStudentId || !issueDueDate) { setIssueError('All fields required'); return; }
    setIssueError('');
    const r = await fetch('/api/admin/library', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'issue', item_id: issueItemId, student_id: issueStudentId, due_date: issueDueDate }) });
    const d = await r.json();
    if (!r.ok) { setIssueError(d.error ?? 'Failed'); return; }
    msg('Book issued successfully'); setIssueItemId(''); setIssueStudentId(''); setIssueDueDate('');
  }

  async function returnBook(issueId: string) {
    const r = await fetch('/api/admin/library', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: issueId, action: 'return' }) });
    const d = await r.json();
    if (r.ok) { msg(d.overdue_days > 0 ? `Returned — Fine: ₹${d.fine_amount}` : 'Returned successfully'); loadIssues(tab === 'overdue' ? 'overdue' : 'issues'); }
    else msg(d.error ?? 'Failed', true);
  }

  const inp = (extra?: React.CSSProperties): React.CSSProperties => ({ height: 40, border: '1px solid #D1D5DB', borderRadius: 8, padding: '0 12px', fontSize: 14, fontFamily: 'inherit', ...extra });

  return (
    <Layout title="Library" subtitle="Issue, return and track books">
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: toastErr ? '#B91C1C' : '#15803D', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>{toast}</div>}

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#F3F4F6', borderRadius: 10, padding: 4 }}>
        {[['issue','📤 Issue Book'],['return','↩️ Return'],['overdue','⚠️ Overdue'],['inventory','📚 Inventory']].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k as 'issue'|'return'|'overdue'|'inventory')}
            style={{ flex: 1, padding: '8px 8px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: tab === k ? '#fff' : 'transparent', color: tab === k ? '#111827' : '#6B7280', boxShadow: tab === k ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'issue' && (
        <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 12, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1E40AF', marginBottom: 16 }}>📤 Issue a Book</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
            {[['Book Item ID *', issueItemId, setIssueItemId, 'text'],['Student ID *', issueStudentId, setIssueStudentId, 'text'],['Return Due Date *', issueDueDate, setIssueDueDate, 'date']].map(([label, val, setter, type]) => (
              <div key={label as string}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#1E40AF', display: 'block', marginBottom: 4 }}>{label as string}</label>
                <input type={type as string} value={val as string} onChange={e => (setter as (v:string)=>void)(e.target.value)} style={inp({ width: '100%', boxSizing: 'border-box' })} />
              </div>
            ))}
          </div>
          {issueError && <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '8px 12px', borderRadius: 7, fontSize: 13, marginBottom: 10 }}>{issueError}</div>}
          <button onClick={issueBook} style={{ padding: '10px 24px', background: '#1D4ED8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Issue Book</button>
          <div style={{ marginTop: 12, fontSize: 12, color: '#6B7280' }}>Tip: Use the Inventory tab to look up Book Item IDs.</div>
        </div>
      )}

      {(tab === 'return' || tab === 'overdue') && (
        loading ? <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>Loading...</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {issues.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>{tab === 'overdue' ? '🎉 No overdue books!' : 'No active issues.'}</div>}
            {issues.map(issue => (
              <div key={issue.id} style={{ background: '#fff', border: `1px solid ${tab === 'overdue' ? '#FED7AA' : '#E5E7EB'}`, borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{issue.item?.title ?? '—'}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>#{issue.item?.accession_number} · {issue.student?.name ?? '—'} · {issue.student?.class}-{issue.student?.section}</div>
                  <div style={{ fontSize: 11, color: tab === 'overdue' ? '#DC2626' : '#9CA3AF' }}>Due: {issue.due_date}</div>
                  {issue.fine_amount && issue.fine_amount > 0 && <div style={{ fontSize: 12, color: '#991B1B', fontWeight: 600 }}>Fine: ₹{issue.fine_amount}{issue.fine_paid ? ' (paid)' : ' (pending)'}</div>}
                </div>
                {issue.status === 'issued' && (
                  <button onClick={() => returnBook(issue.id)} style={{ padding: '7px 14px', background: '#065F46', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>Return</button>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'inventory' && (
        <>
          <div style={{ marginBottom: 12 }}>
            <input value={itemSearch} onChange={e => setItemSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadItems()}
              placeholder="Search by title, author, accession no..." style={inp({ width: '100%', maxWidth: 400, boxSizing: 'border-box' })} />
          </div>
          {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>Loading...</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map(item => (
                <div key={item.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 9, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{item.title}</div>
                    <div style={{ fontSize: 11, color: '#6B7280' }}>#{item.accession_number}{item.author ? ` · ${item.author}` : ''}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1, fontFamily: 'monospace' }}>ID: {item.id}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: item.available_copies > 0 ? '#065F46' : '#DC2626' }}>{item.available_copies}/{item.total_copies}</div>
                    <div style={{ fontSize: 10, color: '#9CA3AF' }}>available</div>
                  </div>
                </div>
              ))}
              {items.length === 0 && <div style={{ textAlign: 'center', padding: 32, color: '#9CA3AF' }}>Search for books above.</div>}
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
