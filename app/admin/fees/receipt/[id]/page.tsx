'use client';
// app/admin/fees/receipt/[id]/page.tsx
// Fee receipt print page — printable, Telugu-safe, grayscale-safe.
// Now carries the institution's branding (logo, colours, tagline, signature, seal) via the
// shared BrandedLetterhead — "upload once, applied everywhere".
// Usage: /admin/fees/receipt/[fee_id] → Print / Save as PDF via browser

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { BrandedLetterhead, SignatureBlock, SealMark, type DocBranding } from '@/components/BrandedLetterhead';

interface FeeReceipt {
  receipt_number?: string;
  student_name?: string;
  class?: string; section?: string; roll_number?: string; admission_number?: string;
  fee_type?: string; description?: string;
  amount?: number; paid_amount?: number; balance?: number;
  payment_date?: string; payment_mode?: string;
  academic_year?: string;
  school_name?: string; school_address?: string; udise_code?: string;
  issued_by?: string;
}

export default function FeeReceiptPage() {
  const params = useParams();
  const [receipt, setReceipt] = useState<FeeReceipt | null>(null);
  const [branding, setBranding] = useState<DocBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/admin/fees/${params.id}/receipt`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.receipt) setReceipt(d.receipt); else setError('Receipt not found'); })
      .catch(() => setError('Failed to load receipt'))
      .finally(() => setLoading(false));
    fetch('/api/admin/schools/branding')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.branding) setBranding(d.branding); })
      .catch(() => {});
  }, [params.id]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading receipt…</div>;
  if (error || !receipt) return <div style={{ padding: 40, textAlign: 'center', color: '#B91C1C' }}>{error || 'Receipt not found'}</div>;

  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  function toWords(n: number): string {
    if (n === 0) return 'Zero';
    const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
      'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen',
      'Seventeen','Eighteen','Nineteen'];
    const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' '+ones[n%10] : '');
    if (n < 1000) return ones[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' '+toWords(n%100) : '');
    if (n < 100000) return toWords(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' '+toWords(n%1000) : '');
    return toWords(Math.floor(n/100000)) + ' Lakh' + (n%100000 ? ' '+toWords(n%100000) : '');
  }

  const amount = receipt.paid_amount ?? receipt.amount ?? 0;

  // Branding with sensible fallbacks to the receipt's own school fields.
  const b: DocBranding = {
    name: branding?.name ?? receipt.school_name ?? 'School Name',
    address: branding?.address ?? receipt.school_address ?? null,
    udise_code: branding?.udise_code ?? receipt.udise_code ?? null,
    logo_url: branding?.logo_url ?? null,
    seal_url: branding?.seal_url ?? null,
    signature_url: branding?.signature_url ?? null,
    tagline: branding?.tagline ?? null,
    primary_color: branding?.primary_color ?? null,
    secondary_color: branding?.secondary_color ?? null,
    website: branding?.website ?? null,
    contact_phone: branding?.contact_phone ?? null,
    contact_email: branding?.contact_email ?? null,
  };
  const primary = b.primary_color || '#000';

  return (
    <div style={{ fontFamily: '"Times New Roman", Times, serif', maxWidth: 680, margin: '0 auto', padding: '20px 32px', background: '#fff', minHeight: '100vh', color: '#000', fontSize: 13 }}>
      <style>{`
        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
          @page { size: A5 landscape; margin: 12mm; }
        }
      `}</style>

      {/* Print button */}
      <div className="no-print" style={{ marginBottom: 16, textAlign: 'center' }}>
        <button onClick={() => window.print()}
          style={{ padding: '9px 24px', background: '#15803D', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginRight: 8 }}>
          🖨️ Print Receipt
        </button>
        <button onClick={() => window.close()}
          style={{ padding: '9px 16px', background: '#F3F4F6', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
          ✕ Close
        </button>
      </div>

      {/* Bordered receipt body */}
      <div style={{ border: `2px solid ${primary}`, padding: '12px 16px 10px', position: 'relative' }}>
        <SealMark url={b.seal_url} />

        {/* Branded letterhead */}
        <BrandedLetterhead b={b} title="FEE RECEIPT — MONEY RECEIPT" />

        {/* Receipt metadata */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 12 }}>
          <div>Receipt No: <strong>{receipt.receipt_number ?? params.id}</strong></div>
          <div>Date: <strong>{receipt.payment_date ?? today}</strong></div>
          <div>Academic Year: <strong>{receipt.academic_year ?? '2025-26'}</strong></div>
        </div>

        {/* Student details */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px', marginBottom: 10, fontSize: 12 }}>
          <div>Student: <strong>{receipt.student_name ?? '—'}</strong></div>
          <div>Class: <strong>{receipt.class ?? '—'}-{receipt.section ?? '—'}</strong></div>
          <div>Admission No: <strong>{receipt.admission_number ?? '—'}</strong></div>
          <div>Roll No: <strong>{receipt.roll_number ?? '—'}</strong></div>
        </div>

        {/* Fee detail table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 8 }}>
          <thead>
            <tr style={{ background: primary, color: '#fff' }}>
              <th style={{ padding: '4px 8px', textAlign: 'left' }}>S.No</th>
              <th style={{ padding: '4px 8px', textAlign: 'left' }}>Fee Type</th>
              <th style={{ padding: '4px 8px', textAlign: 'left' }}>Description</th>
              <th style={{ padding: '4px 8px', textAlign: 'right' }}>Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #ccc' }}>
              <td style={{ padding: '4px 8px' }}>1</td>
              <td style={{ padding: '4px 8px' }}>{receipt.fee_type ?? 'tuition'}</td>
              <td style={{ padding: '4px 8px' }}>{receipt.description ?? ''}</td>
              <td style={{ padding: '4px 8px', textAlign: 'right' }}><strong>{amount.toFixed(2)}</strong></td>
            </tr>
            <tr style={{ fontWeight: 'bold' }}>
              <td colSpan={3} style={{ padding: '4px 8px', textAlign: 'right' }}>Total Paid:</td>
              <td style={{ padding: '4px 8px', textAlign: 'right' }}>₹{amount.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        {/* Amount in words */}
        <div style={{ fontSize: 12, marginBottom: 8 }}>
          Amount in Words: <strong>Rupees {toWords(Math.round(amount))} Only</strong>
        </div>

        {/* Telugu */}
        <div style={{ fontSize: 12, fontFamily: '"Noto Sans Telugu", sans-serif', marginBottom: 8, color: '#333' }}>
          మొత్తం చెల్లించారు: ₹{amount.toFixed(2)} | తేదీ: {receipt.payment_date ?? today}
        </div>

        {/* Payment mode */}
        <div style={{ fontSize: 12, marginBottom: 12 }}>
          Mode of Payment: <strong>{receipt.payment_mode ?? 'Cash'}</strong>
        </div>

        {/* Signatures — authorised signatory image applied when uploaded */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 20 }}>
          <SignatureBlock label="Parent Signature" />
          <SignatureBlock label={receipt.issued_by ? `Cashier / Clerk (${receipt.issued_by})` : 'Cashier / Clerk'} />
          <SignatureBlock url={b.signature_url} label="Principal" />
        </div>

        <div style={{ marginTop: 10, textAlign: 'center', color: '#666' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.svg" alt="EdProSys" style={{ height: 16, opacity: 0.65, marginBottom: 4 }} />
          <div style={{ fontSize: 10 }}>This is a computer-generated receipt. Generated by EdProSys — edprosys.com</div>
        </div>
      </div>
    </div>
  );
}
