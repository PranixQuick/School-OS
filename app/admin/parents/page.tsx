'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

interface Parent { id: string; name: string; phone: string; student_name?: string; class?: string; section?: string; last_access?: string; }

export default function AdminParentsPage() {
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/admin/parents').then(r => r.ok ? r.json() : { parents: [] })
      .then(d => { setParents(d.parents ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const visible = parents.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.phone.includes(search) || (p.student_name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout title="Parent Directory" subtitle={`${parents.length} registered parents`}>
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search by name, phone, or student…" className="input"
        style={{ width: '100%', height: 36, fontSize: 13, marginBottom: 16, boxSizing: 'border-box' }} />
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👨‍👩‍👧</div>
          <div className="empty-state-title">No parents registered</div>
          <div className="empty-state-sub">Parents register automatically when a student is added with a phone number.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {visible.map((p, i) => (
            <div key={p.id} style={{ padding: '11px 16px', borderBottom: i < visible.length-1 ? '1px solid #F3F4F6' : 'none',
              display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#EEF2FF', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#4F46E5', fontSize: 13 }}>
                {p.name[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{p.name}</div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>
                  {p.phone}{p.student_name ? ` · ${p.student_name}` : ''}{p.class ? ` (Class ${p.class}${p.section ?? ''})` : ''}
                </div>
              </div>
              {p.last_access && (
                <div style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>
                  Last active {new Date(p.last_access).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
