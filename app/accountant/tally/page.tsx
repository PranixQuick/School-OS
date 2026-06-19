'use client';
// app/accountant/tally/page.tsx
// ISS-10 (#10b) — Tally export UI. Pick a date range, download Tally XML
// (native voucher import) or CSV of paid fee collections.
// Read-only; backed by GET /api/accounts/tally-export.

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function TallyExportPage() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [count, setCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);

  const refreshCount = useCallback(() => {
    setCounting(true);
    setCount(null);
    const qs = new URLSearchParams({ status: 'paid', from, to, limit: '1' });
    fetch(`/api/accounts/transactions?${qs.toString()}`)
      .then(r => r.ok ? r.json() : { total: null })
      .then((d: { total?: number | null }) => setCount(d.total ?? null))
      .catch(() => setCount(null))
      .finally(() => setCounting(false));
  }, [from, to]);

  useEffect(() => { refreshCount(); }, [refreshCount]);

  function download(format: 'xml' | 'csv') {
    const qs = new URLSearchParams({ format, from, to });
    window.open(`/api/accounts/tally-export?${qs.toString()}`, '_blank');
  }

  const inputStyle: React.CSSProperties = { padding: '9px 12px', border: '1px solid #D1D5DB', borderRadius: 10, fontSize: 14, outline: 'none' };

  return (
    <Layout title="Tally Export" subtitle="Export fee collections to Tally">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 }}>

        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#6B7280', fontWeight: 600 }}>
              From
              <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#6B7280', fontWeight: 600 }}>
              To
              <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
            </label>
          </div>

          <div style={{ fontSize: 13, color: '#374151' }}>
            {counting ? 'Counting…' : count === null ? 'Paid collections in range: —' : <>Paid collections in range: <b>{count}</b></>}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => download('xml')}
              disabled={count === 0}
              style={{ background: count === 0 ? '#F3F4F6' : '#15803D', color: count === 0 ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: count === 0 ? 'not-allowed' : 'pointer' }}
            >
              ⬇ Tally XML
            </button>
            <button
              onClick={() => download('csv')}
              disabled={count === 0}
              style={{ background: count === 0 ? '#F3F4F6' : '#EEF2FF', color: count === 0 ? '#9CA3AF' : '#4F46E5', border: '1px solid ' + (count === 0 ? '#E5E7EB' : '#C7D2FE'), borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: count === 0 ? 'not-allowed' : 'pointer' }}
            >
              ⬇ CSV
            </button>
          </div>
        </div>

        <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6 }}>
          Each paid collection becomes a <b>Receipt voucher</b>. The income ledger is named after the fee type
          (e.g. <i>Tuition</i>, <i>Transport</i>); the contra ledger is <i>Cash</i> or <i>Bank</i> based on payment mode.
          For XML, import in Tally via <i>Gateway → Import → Vouchers</i>. Make sure those ledger names exist in your Tally company first.
        </div>
      </div>
    </Layout>
  );
}
