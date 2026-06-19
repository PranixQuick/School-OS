'use client';
// app/accountant/ledger/page.tsx
// ISS-10 (#10 / P4.1c) — Per-student fee ledger.
// Pick a student, then view their full fee history + running totals.
// Read-only. Uses GET /api/admin/fees/students (picker) and
// GET /api/admin/fees?student_id= (ledger) — no new aggregation, no schema change.

import { useState, useEffect, useRef } from 'react';
import Layout from '@/components/Layout';

interface SHit { id: string; name: string; class: string | null; section: string | null; admission_number: string | null }
interface Fee {
  id: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  fee_type: string;
  description?: string | null;
  fee_receipt_number?: string | null;
}

const inr = (n: number) => '₹' + Math.round(n || 0).toLocaleString('en-IN');

function statusColor(s: string): string {
  if (s === 'paid') return '#16A34A';
  if (s === 'overdue') return '#B91C1C';
  if (s === 'waived') return '#6B7280';
  return '#D97706';
}

function clsLabel(s: SHit): string {
  const c = [s.class, s.section].filter(Boolean).join('-');
  return [c ? 'Class ' + c : '', s.admission_number].filter(Boolean).join(' · ');
}

export default function LedgerPage() {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SHit[]>([]);
  const [picked, setPicked] = useState<SHit | null>(null);
  const [fees, setFees] = useState<Fee[]>([]);
  const [loadingFees, setLoadingFees] = useState(false);
  const debTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (picked) return;
    if (q.trim().length < 2) { setHits([]); return; }
    if (debTimer.current) clearTimeout(debTimer.current);
    debTimer.current = setTimeout(() => {
      fetch(`/api/admin/fees/students?q=${encodeURIComponent(q.trim())}`)
        .then(r => r.ok ? r.json() : { students: [] })
        .then((d: { students?: SHit[] }) => setHits(d.students ?? []))
        .catch(() => setHits([]));
    }, 250);
    return () => { if (debTimer.current) clearTimeout(debTimer.current); };
  }, [q, picked]);

  function pick(s: SHit) {
    setPicked(s);
    setHits([]);
    setQ(s.name);
    setLoadingFees(true);
    fetch(`/api/admin/fees?student_id=${s.id}&limit=200`)
      .then(r => r.ok ? r.json() : { fees: [] })
      .then((d: { fees?: Fee[] }) => setFees(d.fees ?? []))
      .catch(() => setFees([]))
      .finally(() => setLoadingFees(false));
  }

  function reset() {
    setPicked(null);
    setFees([]);
    setQ('');
    setHits([]);
  }

  const totals = fees.reduce(
    (a, f) => {
      const amt = Number(f.amount || 0);
      a.billed += amt;
      if (f.status === 'paid') a.paid += amt;
      else if (f.status === 'overdue') a.overdue += amt;
      else if (f.status !== 'waived') a.pending += amt;
      return a;
    },
    { billed: 0, paid: 0, pending: 0, overdue: 0 }
  );

  const sorted = [...fees].sort((a, b) => (b.due_date || '').localeCompare(a.due_date || ''));

  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #E5E7EB', fontWeight: 700, color: '#374151', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid #F3F4F6', color: '#111827' };

  const card = (label: string, value: string, color: string) => (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 14, flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
    </div>
  );

  return (
    <Layout title="Fee Ledger" subtitle="Per-student fee history">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Search */}
        <div style={{ position: 'relative', maxWidth: 460 }}>
          <input
            value={q}
            onChange={(e) => { if (picked) setPicked(null); setQ(e.target.value); }}
            placeholder="Search student by name or admission number…"
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 10, fontSize: 14, outline: 'none' }}
          />
          {!picked && hits.length > 0 && (
            <div style={{ position: 'absolute', top: '110%', left: 0, right: 0, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', zIndex: 20, overflow: 'hidden' }}>
              {hits.map((s) => (
                <button
                  key={s.id}
                  onClick={() => pick(s)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', borderBottom: '1px solid #F3F4F6', cursor: 'pointer' }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF' }}>{clsLabel(s) || '—'}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Ledger */}
        {picked && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>{picked.name}</div>
                <div style={{ fontSize: 12, color: '#9CA3AF' }}>{clsLabel(picked) || '—'}</div>
              </div>
              <button onClick={reset} style={{ background: '#F9FAFB', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                ← Choose another
              </button>
            </div>

            {loadingFees ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
            ) : fees.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>No fee records for this student.</div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {card('Billed', inr(totals.billed), '#111827')}
                  {card('Paid', inr(totals.paid), '#16A34A')}
                  {card('Pending', inr(totals.pending), '#D97706')}
                  {card('Overdue', inr(totals.overdue), '#B91C1C')}
                </div>

                <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 8, overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#F9FAFB' }}>
                        <th style={th}>Fee type</th>
                        <th style={th}>Description</th>
                        <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                        <th style={th}>Due</th>
                        <th style={th}>Status</th>
                        <th style={th}>Paid on</th>
                        <th style={th}>Receipt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((f) => (
                        <tr key={f.id}>
                          <td style={{ ...td, fontWeight: 600 }}>{f.fee_type || '—'}</td>
                          <td style={td}>{f.description || '—'}</td>
                          <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{inr(f.amount)}</td>
                          <td style={td}>{f.due_date || '—'}</td>
                          <td style={td}>
                            <span style={{ color: statusColor(f.status), fontWeight: 700, textTransform: 'capitalize' }}>{f.status || 'pending'}</span>
                          </td>
                          <td style={td}>{f.paid_date || '—'}</td>
                          <td style={td}>{f.fee_receipt_number || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {!picked && (
          <div style={{ padding: 24, color: '#9CA3AF', fontSize: 13 }}>
            Search for a student above to view their fee ledger.
          </div>
        )}
      </div>
    </Layout>
  );
}
