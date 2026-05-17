'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

interface LibItem { id: string; accession_number: string; title: string; author: string | null; category: string | null; total_copies: number; available_copies: number; }
interface Issue { id: string; issued_date: string; due_date: string; returned_date: string | null; fine_amount: number | null; fine_paid: boolean; status: string; item?: { title: string; accession_number: string } | null; student?: { name: string; class: string; section: string } | null; }

export default function LibraryPage() {
  const [tab, setTab] = useState<'items' | 'issues' | 'overdue'>('issues');
  const [items, setItems] = useState<LibItem[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [issueForm, setIssueForm] = useState({ item_id: '', student_id: '', due_date: '' });
  const [issuing, setIssuing] = useState(false);
  const [issuMsg, setIssuMsg] = useState('');
  const [returning, setReturning] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    if (tab === 'items') {
      const d = await fetch(`/api/admin/library${search ? `?q=${encodeURIComponent(search)}` : ''}`).then(r => r.json());
      setItems(d.items ?? []);
    } else {
      const d = await fetch(`/api/admin/library?view=${tab}`).then(r => r.json());
      setIssues(d.issues ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, [tab, search]);

  async function issueBook() {
    if (!issueForm.item_id || !issueForm.student_id || !issueForm.due_date) { setIssuMsg('All fields required'); return; }
    setIssuing(true); setIssuMsg('');
    const res = await fetch('/api/admin/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'issue', ...issueForm }) });
    const d = await res.json();
    if (res.ok) { setIssuMsg('Issued'); setIssueForm({ item_id: '', student_id: '', due_date: '' }); void load(); }
    else setIssuMsg(d.error ?? 'Error');
    setIssuing(false);
  }

  async function returnBook(id: string) {
    setReturning(id);
    const res = await fetch('/api/admin/library', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'return' }) });
    const d = await res.json();
    if (res.ok && d.fine_amount > 0) alert(`Book returned. Fine: ₹${d.fine_amount} (${d.overdue_days} days overdue)`);
    setReturning(null);
    void load();
  }

  const today = new Date().toISOString().split('T')[0];
  const inputStyle = { padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const };

  return (
    <Layout title="Library" subtitle="Book inventory, issue and return management">
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 0 40px' }}>

        {/* Issue form */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 18, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Issue a Book</div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr auto', gap: 8, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>ACCESSION / BOOK ID</label>
              <input placeholder="Item ID or search above" value={issueForm.item_id} onChange={e => setIssueForm(f => ({ ...f, item_id: e.target.value }))} style={{ ...inputStyle, width: '100%' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>STUDENT ID</label>
              <input placeholder="Student ID" value={issueForm.student_id} onChange={e => setIssueForm(f => ({ ...f, student_id: e.target.value }))} style={{ ...inputStyle, width: '100%' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>DUE DATE</label>
              <input type="date" min={today} value={issueForm.due_date} onChange={e => setIssueForm(f => ({ ...f, due_date: e.target.value }))} style={{ ...inputStyle, width: '100%' }} />
            </div>
            <button onClick={issueBook} disabled={issuing} style={{ height: 36, padding: '0 16px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {issuing ? '...' : 'Issue'}
            </button>
          </div>
          {issuMsg && <div style={{ fontSize: 12, color: issuMsg === 'Issued' ? '#065F46' : '#991B1B', marginTop: 8 }}>{issuMsg}</div>}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '2px solid #E5E7EB', marginBottom: 16, gap: 4 }}>
          {(['issues', 'overdue', 'items'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t ? 700 : 500, color: tab === t ? '#4F46E5' : '#6B7280', borderBottom: tab === t ? '2px solid #4F46E5' : '2px solid transparent', marginBottom: -2 }}>
              {t === 'issues' ? 'Active Issues' : t === 'overdue' ? '⚠ Overdue' : 'Inventory'}
            </button>
          ))}
          {tab === 'items' && (
            <input placeholder="Search title, author, accession..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, marginLeft: 'auto', width: 260 }} />
          )}
        </div>

        {loading ? <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Loading...</div> : tab === 'items' ? (
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
            {items.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>No books found.</div> : items.map(item => (
              <div key={item.id} style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 48, textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#6B7280' }}>{item.accession_number}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{item.title}</div>
                  {item.author && <div style={{ fontSize: 11, color: '#6B7280' }}>{item.author}{item.category ? ` · ${item.category}` : ''}</div>}
                </div>
                <div style={{ textAlign: 'right', fontSize: 12 }}>
                  <div style={{ fontWeight: 700, color: item.available_copies > 0 ? '#065F46' : '#991B1B' }}>{item.available_copies} available</div>
                  <div style={{ color: '#9CA3AF' }}>of {item.total_copies}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
            {issues.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>{tab === 'overdue' ? 'No overdue books.' : 'No active issues.'}</div> : issues.map(iss => {
              const overdue = !iss.returned_date && iss.due_date < today;
              return (
                <div key={iss.id} style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{iss.item?.title ?? 'Unknown book'}</div>
                    <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>
                      {iss.student ? `${iss.student.name} · Class ${iss.student.class}-${iss.student.section}` : 'Unknown student'}
                      {' · '}Issued {new Date(iss.issued_date).toLocaleDateString('en-IN')}
                      {' · '}Due {new Date(iss.due_date).toLocaleDateString('en-IN')}
                    </div>
                    {iss.fine_amount && <div style={{ fontSize: 11, color: '#92400E', fontWeight: 600 }}>Fine: ₹{iss.fine_amount}{iss.fine_paid ? ' (paid)' : ' (pending)'}</div>}
                  </div>
                  {overdue && <span style={{ fontSize: 10, fontWeight: 700, background: '#FEE2E2', color: '#991B1B', padding: '2px 8px', borderRadius: 10 }}>OVERDUE</span>}
                  {iss.status === 'issued' && (
                    <button onClick={() => returnBook(iss.id)} disabled={returning === iss.id} style={{ padding: '5px 12px', background: '#D1FAE5', color: '#065F46', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {returning === iss.id ? '...' : 'Return'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
