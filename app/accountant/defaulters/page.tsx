'use client';
// app/accountant/defaulters/page.tsx
// ISS-10 (#10a / P4.1b) — Defaulters report: students with overdue fees.
// Read-only view over the existing GET /api/admin/fees?status=overdue.

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import EntityDetailCard, { DetailField } from '@/components/EntityDetailCard';

interface Student { name?: string; class?: string; section?: string; phone_parent?: string }
interface Fee {
  id: string;
  amount: number;
  due_date: string;
  fee_type: string;
  description?: string | null;
  students?: Student | Student[] | null;
}

const inr = (n: number) => '₹' + Math.round(n || 0).toLocaleString('en-IN');

function one(v: Student | Student[] | null | undefined): Student | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function daysOverdue(due: string): number {
  if (!due) return 0;
  const d = new Date(due + 'T00:00:00');
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86_400_000));
}

export default function DefaultersPage() {
  const [fees, setFees] = useState<Fee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<Fee | null>(null);

  useEffect(() => {
    fetch('/api/admin/fees?status=overdue&limit=200')
      .then(r => r.ok ? r.json() : Promise.reject(new Error(r.status === 403 ? 'Not permitted' : 'Failed to load')))
      .then((d: { fees?: Fee[] }) => setFees(d.fees ?? []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const total = fees.reduce((sum, f) => sum + Number(f.amount || 0), 0);
  const sorted = [...fees].sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));

  const dsel = detail ? one(detail.students) : null;
  const detailFields: DetailField[] = detail ? [
    { label: 'Class', value: [dsel?.class, dsel?.section].filter(Boolean).join(' · ') || '—' },
    { label: 'Fee type', value: detail.fee_type || '—' },
    { label: 'Amount overdue', value: inr(detail.amount), sensitive: true },
    { label: 'Due date', value: detail.due_date || '—' },
    { label: 'Days overdue', value: `${daysOverdue(detail.due_date)}d` },
    { label: 'Parent phone', value: dsel?.phone_parent || '—', href: dsel?.phone_parent ? `tel:${dsel.phone_parent}` : undefined },
  ] : [];

  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #E5E7EB', fontWeight: 700, color: '#374151', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid #F3F4F6', color: '#111827' };

  return (
    <Layout title="Defaulters" subtitle="Students with overdue fees">
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#B91C1C' }}>{error}</div>
      ) : fees.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 32 }}>✅</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginTop: 8 }}>No overdue fees</div>
          <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>Everyone is up to date.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, color: '#374151' }}>
            <b>{fees.length}</b> overdue item{fees.length === 1 ? '' : 's'} · <b style={{ color: '#B91C1C' }}>{inr(total)}</b> outstanding
          </div>
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 8, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  <th style={th}>Student</th>
                  <th style={th}>Class</th>
                  <th style={th}>Fee type</th>
                  <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                  <th style={th}>Due</th>
                  <th style={{ ...th, textAlign: 'right' }}>Overdue</th>
                  <th style={th}>Parent</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(f => {
                  const s = one(f.students);
                  const cls = [s?.class, s?.section].filter(Boolean).join(' · ');
                  const od = daysOverdue(f.due_date);
                  const phone = s?.phone_parent;
                  return (
                    <tr key={f.id}>
                      <td style={{ ...td, fontWeight: 600 }}>
                        <button onClick={() => setDetail(f)} style={{ background: 'none', border: 'none', padding: 0, color: '#4F46E5', fontWeight: 600, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>{s?.name ?? '—'}</button>
                      </td>
                      <td style={td}>{cls || '—'}</td>
                      <td style={td}>{f.fee_type || '—'}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#B91C1C' }}>{inr(f.amount)}</td>
                      <td style={td}>{f.due_date || '—'}</td>
                      <td style={{ ...td, textAlign: 'right', color: od > 30 ? '#B91C1C' : '#D97706', fontWeight: 600 }}>{od}d</td>
                      <td style={td}>
                        {phone
                          ? <a href={`tel:${phone}`} style={{ color: '#4F46E5', textDecoration: 'none', fontWeight: 600 }}>📞 {phone}</a>
                          : <span style={{ color: '#9CA3AF' }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Layout>
  );
}
