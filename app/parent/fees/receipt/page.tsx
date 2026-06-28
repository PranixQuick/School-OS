'use client';
/* eslint-disable @next/next/no-img-element */
import { useState, useEffect, type CSSProperties } from 'react';
import Link from 'next/link';
import { feeTypeDef } from '@/lib/fee-catalog';
import { type DocBranding } from '@/components/BrandedLetterhead';

interface PaymentLine { date: string | null; amount: number; mode: string; reference: string | null; }
interface Receipt {
  receipt_number: string | null; fully_paid: boolean;
  student_name: string; class: string; section: string; roll_number: string; admission_number: string;
  fee_type: string; description: string;
  billed: number; discount: number; discount_reason: string | null; net_payable: number; tax_amount: number;
  paid_amount: number; balance_due: number;
  latest_payment_date: string | null; payment_mode: string; payments: PaymentLine[];
  school_name: string; school_address: string; school_board: string;
  school_phone: string; school_website: string; school_tagline: string;
  branding?: DocBranding | null;
}

const INR = (n: number) => '₹' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const prettyMode = (m: string) => {
  const k = (m || '').toLowerCase();
  if (k === 'upi') return 'UPI';
  if (k === 'card') return 'Card';
  if (k === 'netbanking' || k === 'net banking') return 'Net banking';
  if (k === 'wallet') return 'Wallet';
  if (k === 'cash') return 'Cash';
  if (k === 'cheque' || k === 'check') return 'Cheque';
  if (k === 'bank_transfer' || k === 'bank transfer') return 'Bank transfer';
  if (k === 'razorpay' || k === 'online' || k === '') return 'Online';
  return m.replace(/^\w/, c => c.toUpperCase());
};

// Indian-system rupees to words for the receipt legal line.
function toWords(num: number): string {
  const n = Math.floor(Number(num) || 0);
  if (n === 0) return 'Zero';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (x: number): string => x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? ' ' + a[x % 10] : '');
  const three = (x: number): string => x >= 100 ? a[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' + two(x % 100) : '') : two(x);
  let out = '';
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  if (crore) out += three(crore) + ' Crore ';
  if (lakh) out += two(lakh) + ' Lakh ';
  if (thousand) out += two(thousand) + ' Thousand ';
  if (rest) out += three(rest);
  return out.trim();
}

const PRINT_CSS = `
@media print {
  .no-print { display: none !important; }
  body { background: #ffffff !important; }
  .rcpt-shell { box-shadow: none !important; border: 1px solid #E5E7EB !important; }
  @page { size: A5; margin: 10mm; }
}`;

function getFeeId(): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('fee') || '';
}

export default function ParentReceiptPage() {
  const [r, setR] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const id = getFeeId();
    if (!id) { setErr('No receipt selected.'); setLoading(false); return; }
    fetch('/api/parent/fees/receipt?fee_id=' + encodeURIComponent(id))
      .then(async res => {
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || 'Could not load receipt.');
        return d;
      })
      .then(d => setR(d.receipt))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  const card: CSSProperties = { background: '#fff', borderRadius: 16, boxShadow: '0 1px 3px rgba(16,24,40,0.08)' };
  const page: CSSProperties = { minHeight: '100vh', background: '#F4F5F7', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' };

  if (loading) {
    return <div style={{ ...page, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 14 }}>Loading receipt…</div>;
  }

  if (err || !r) {
    return (
      <div style={page}>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>
          <Link href="/parent/fees" style={{ color: '#4F46E5', fontSize: 13, textDecoration: 'none', display: 'inline-block', marginBottom: 14 }}>← Back to fees</Link>
          <div style={{ ...card, textAlign: 'center', padding: 44 }}>
            <div style={{ fontSize: 34 }}>🧾</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginTop: 8 }}>Receipt unavailable</div>
            <div style={{ fontSize: 12.5, color: '#9CA3AF', marginTop: 4 }}>{err || 'Not found.'}</div>
          </div>
        </div>
      </div>
    );
  }

  const def = feeTypeDef(r.fee_type);
  const partial = !r.fully_paid && r.balance_due > 0;
  const classLine = [r.class && `Class ${r.class}`, r.section && `Sec ${r.section}`].filter(Boolean).join(' · ') || '—';
  const showHistory = r.payments.length > 1 || partial;

  // Institution branding drives the header band colours + logo.
  const brandPrimary = r.branding?.primary_color || '#4F46E5';
  const brandSecondary = r.branding?.secondary_color || '#6D28D9';
  const brandLogo = r.branding?.logo_url || '';

  const detail = (label: string, value: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '9px 0', borderBottom: '1px solid #F3F4F6' }}>
      <span style={{ fontSize: 12.5, color: '#6B7280', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', textAlign: 'right', wordBreak: 'break-word' }}>{value || '—'}</span>
    </div>
  );
  const money = (label: string, value: number, opts: { strong?: boolean; color?: string; sign?: string } = {}) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '7px 0' }}>
      <span style={{ fontSize: 12.5, color: opts.color || '#6B7280', fontWeight: opts.strong ? 700 : 400 }}>{label}</span>
      <span style={{ fontSize: opts.strong ? 14 : 13, color: opts.color || '#111827', fontWeight: opts.strong ? 800 : 600 }}>{opts.sign || ''}{INR(value)}</span>
    </div>
  );

  return (
    <div style={page}>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>

        <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <Link href="/parent/fees" style={{ color: '#4F46E5', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>← Fees</Link>
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>{r.fully_paid ? 'Receipt' : 'Acknowledgement'}</span>
        </div>

        <div className="rcpt-shell" style={{ ...card, overflow: 'hidden' }}>
          {/* header band — institution branded */}
          <div style={{ background: `linear-gradient(135deg,${brandPrimary} 0%,${brandSecondary} 100%)`, padding: '22px 20px 20px', color: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {brandLogo
                ? <img src={brandLogo} alt="logo" style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.18)', objectFit: 'contain', padding: 4, flexShrink: 0 }} />
                : <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🏫</div>}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.2 }}>{r.school_name}</div>
                <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.82)', marginTop: 2 }}>
                  {[r.school_tagline || r.branding?.tagline, r.school_board && `${r.school_board} Board`].filter(Boolean).join(' · ') || 'Fee Receipt'}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' }}>
                {r.fully_paid ? 'Payment Receipt' : 'Payment Acknowledgement'}
              </span>
              <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 99, background: r.fully_paid ? '#16A34A' : '#D97706', color: '#fff', letterSpacing: 0.4 }}>
                {r.fully_paid ? '✓ PAID' : 'PART-PAID'}
              </span>
            </div>
          </div>

          {/* amount + receipt no */}
          <div style={{ padding: '20px 20px 8px', textAlign: 'center', borderBottom: '1px dashed #E5E7EB' }}>
            <div style={{ fontSize: 12, color: '#6B7280' }}>{r.fully_paid ? 'Amount paid' : 'Paid so far'}</div>
            <div style={{ fontSize: 34, fontWeight: 800, color: '#16A34A', margin: '2px 0 4px', letterSpacing: -0.5 }}>{INR(r.paid_amount)}</div>
            <div style={{ fontSize: 12, color: '#6B7280', fontStyle: 'italic' }}>Rupees {toWords(r.paid_amount)} only</div>
            {partial && (
              <div style={{ display: 'inline-block', marginTop: 10, padding: '5px 14px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, fontSize: 12.5, fontWeight: 700, color: '#B45309' }}>
                Balance due {INR(r.balance_due)}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', marginTop: 12, marginBottom: 4, padding: '6px 14px', background: '#F9FAFB', borderRadius: 10 }}>
                <span style={{ fontSize: 11.5, color: '#6B7280' }}>{r.receipt_number ? 'Receipt No.' : 'Reference'}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>{r.receipt_number || r.payments[r.payments.length - 1]?.reference || '—'}</span>
              </div>
            </div>
          </div>

          {/* fee + details */}
          <div style={{ padding: '8px 20px 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0 10px' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{def.icon}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>{def.label}</div>
                {r.description && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{r.description}</div>}
              </div>
            </div>
            {detail('Student', r.student_name)}
            {detail('Class', classLine)}
            {detail('Admission No.', r.admission_number)}
            {r.roll_number ? detail('Roll No.', r.roll_number) : null}
            {detail('Payment date', fmtDate(r.latest_payment_date))}
            {detail('Payment mode', prettyMode(r.payment_mode))}
          </div>

          {/* fee summary — billed / concession / net / paid / balance */}
          <div style={{ padding: '6px 20px 8px' }}>
            <div style={{ background: '#F9FAFB', borderRadius: 12, padding: '10px 14px' }}>
              {money('Fee billed', r.billed)}
              {r.discount > 0 && money(r.discount_reason ? `Concession (${r.discount_reason})` : 'Concession', r.discount, { color: '#16A34A', sign: '− ' })}
              {(r.discount > 0 || r.tax_amount > 0) && money('Net payable', r.net_payable, { strong: true })}
              <div style={{ borderTop: '1px solid #E5E7EB', margin: '4px 0' }} />
              {money('Paid', r.paid_amount, { color: '#16A34A' })}
              {r.balance_due > 0 && money('Balance due', r.balance_due, { strong: true, color: '#B45309' })}
            </div>
          </div>

          {/* payment history (part / term payments) */}
          {showHistory && (
            <div style={{ padding: '4px 20px 8px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, margin: '4px 0 6px' }}>
                Payment history
              </div>
              {r.payments.map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '7px 0', borderBottom: i < r.payments.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#111827' }}>{fmtDate(p.date)}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {prettyMode(p.mode)}{p.reference ? ` · ${p.reference}` : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#16A34A', flexShrink: 0 }}>{INR(p.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {/* footer */}
          <div style={{ padding: '14px 20px 20px', marginTop: 4, background: '#FAFAFB', borderTop: '1px solid #F3F4F6' }}>
            <div style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.5, textAlign: 'center' }}>
              {r.fully_paid
                ? 'This is a computer-generated receipt and does not require a signature.'
                : 'Acknowledgement of part-payment. A full receipt is issued once the balance is cleared.'}
              {(r.school_phone || r.school_website) && <><br />{[r.school_phone, r.school_website].filter(Boolean).join(' · ')}</>}
            </div>
            <div style={{ fontSize: 10.5, color: '#C4C7CF', textAlign: 'center', marginTop: 8, letterSpacing: 0.3 }}>Powered by EdProSys</div>
          </div>
        </div>

        {/* actions — not printed */}
        <div className="no-print" style={{ marginTop: 16 }}>
          {partial && (
            <Link href="/parent/fees" style={{ display: 'block', textAlign: 'center', marginBottom: 10, padding: '13px 0', fontSize: 14.5, fontWeight: 800, color: '#fff', background: 'linear-gradient(180deg,#F59E0B,#D97706)', borderRadius: 12, textDecoration: 'none' }}>
              Pay balance {INR(r.balance_due)}
            </Link>
          )}
          <button onClick={() => window.print()}
            style={{ width: '100%', padding: '14px 0', fontSize: 15, fontWeight: 800, color: partial ? '#4F46E5' : '#fff', background: partial ? '#EEF2FF' : 'linear-gradient(180deg,#6366F1,#4F46E5)', border: 0, borderRadius: 12, cursor: 'pointer', boxShadow: partial ? 'none' : '0 1px 2px rgba(79,70,229,0.4)' }}>
            ⬇ Download {r.fully_paid ? 'receipt' : 'acknowledgement'}
          </button>
          <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11.5, color: '#9CA3AF' }}>
            Opens your print sheet — choose <strong>Save as PDF</strong> to keep it on your device.
          </div>
        </div>
      </div>
    </div>
  );
}
