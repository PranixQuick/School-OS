'use client';
// app/admin/transfer-certs/[id]/print/page.tsx
// Government-format Transfer Certificate (TC) print page.
// Telangana State Board TC format — printable, Telugu-safe, grayscale-safe.
// Usage: /admin/transfer-certs/[id]/print → Print / Save as PDF via browser

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface TCData {
  tc_number?: string;
  student_name?: string;
  father_name?: string;
  mother_name?: string;
  class?: string; section?: string; roll_number?: string; admission_number?: string;
  date_of_birth?: string;
  date_of_admission?: string;
  date_of_leaving?: string;
  reason?: string;
  conduct?: string;
  attendance_days?: number;
  working_days?: number;
  fees_paid?: boolean;
  remarks?: string;
  school_name?: string;
  school_address?: string;
  udise_code?: string;
  headmaster_name?: string;
  issued_date?: string;
  board?: string;
}

export default function TCPrintPage() {
  const params = useParams();
  const [tc, setTc] = useState<TCData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/admin/transfer-certs/${params.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.tc) setTc(d.tc); else setError('TC not found'); })
      .catch(() => setError('Failed to load TC'))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', fontFamily: 'serif' }}>Loading TC…</div>
  );
  if (error || !tc) return (
    <div style={{ padding: 40, textAlign: 'center', fontFamily: 'serif', color: '#B91C1C' }}>
      {error || 'TC not found'}
    </div>
  );

  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div style={{ fontFamily: '"Times New Roman", Times, serif', maxWidth: 700, margin: '0 auto', padding: '30px 40px', background: '#fff', minHeight: '100vh', color: '#000', fontSize: 14 }}>
      <style>{`
        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 20mm; }
        }
        .tc-line { border-bottom: 1px solid #000; display: inline-block; min-width: 200px; }
        .tc-row { margin-bottom: 10px; line-height: 1.8; }
        .field-label { font-weight: bold; min-width: 220px; display: inline-block; }
      `}</style>

      {/* Print button */}
      <div className="no-print" style={{ marginBottom: 20, textAlign: 'center' }}>
        <button onClick={() => window.print()}
          style={{ padding: '10px 28px', background: '#1E40AF', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginRight: 10 }}>
          🖨️ Print / Save as PDF
        </button>
        <button onClick={() => window.close()}
          style={{ padding: '10px 18px', background: '#F3F4F6', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>
          ✕ Close
        </button>
      </div>

      {/* TC Header */}
      <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 11, marginBottom: 4 }}>
          UDISE Code: <strong>{tc.udise_code ?? '—'}</strong>
        </div>
        <div style={{ fontSize: 18, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>
          {tc.school_name ?? '—'}
        </div>
        <div style={{ fontSize: 12, marginTop: 4 }}>{tc.school_address ?? '—'}</div>
        <div style={{ fontSize: 11, marginTop: 4 }}>
          Board: {tc.board ?? 'State'} | Affiliated to Telangana State Board of Secondary Education
        </div>
        <div style={{ fontSize: 20, fontWeight: 'bold', marginTop: 12, textDecoration: 'underline' }}>
          TRANSFER CERTIFICATE
        </div>
        <div style={{ fontSize: 11, marginTop: 4 }}>
          TC No: <strong>{tc.tc_number ?? '—'}</strong>
        </div>
      </div>

      {/* Fields */}
      {[
        ['Admission No.', tc.admission_number ?? '—'],
        ['Name of Student', tc.student_name ?? '—'],
        ["Father's Name", tc.father_name ?? '—'],
        ["Mother's Name", tc.mother_name ?? '—'],
        ['Date of Birth', tc.date_of_birth ?? '—'],
        ['Class Last Studied', `${tc.class ?? '—'} — Section ${tc.section ?? '—'}`],
        ['Roll Number', tc.roll_number ?? '—'],
        ['Date of Admission', tc.date_of_admission ?? '—'],
        ['Date of Leaving', tc.date_of_leaving ?? '—'],
        ['Working Days', tc.working_days?.toString() ?? '—'],
        ['Days Present', tc.attendance_days?.toString() ?? '—'],
        ['Reason for Leaving', tc.reason ?? '—'],
        ['Conduct', tc.conduct ?? 'Good'],
        ['Fees Paid', tc.fees_paid ? 'Yes — All dues cleared' : 'Outstanding dues'],
        ['Remarks', tc.remarks ?? 'Nil'],
      ].map(([label, value]) => (
        <div key={label} className="tc-row">
          <span className="field-label">{label}:</span>
          <span className="tc-line">&nbsp;{value}&nbsp;</span>
        </div>
      ))}

      {/* Telugu section */}
      <div style={{ marginTop: 16, padding: '10px 0', borderTop: '1px solid #ccc', borderBottom: '1px solid #ccc', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontFamily: '"Noto Sans Telugu", sans-serif', lineHeight: 2 }}>
          విద్యార్థి పేరు: <strong>{tc.student_name}</strong> | తండ్రి పేరు: {tc.father_name ?? '—'}<br />
          తరగతి: {tc.class} — {tc.section} | హాజరు: {tc.attendance_days}/{tc.working_days} రోజులు<br />
          బదిలీ కారణం: {tc.reason ?? '—'} | నడవడిక: {tc.conduct ?? 'మంచిది'}
        </div>
      </div>

      {/* Signature section */}
      <div style={{ marginTop: 40, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderBottom: '1px solid #000', marginBottom: 6, height: 40 }}></div>
          <div style={{ fontSize: 12 }}>Class Teacher</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderBottom: '1px solid #000', marginBottom: 6, height: 40 }}></div>
          <div style={{ fontSize: 12 }}>Office Seal</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderBottom: '1px solid #000', marginBottom: 6, height: 40 }}>
            {tc.headmaster_name && (
              <div style={{ fontSize: 11, paddingTop: 2 }}>{tc.headmaster_name}</div>
            )}
          </div>
          <div style={{ fontSize: 12 }}>Headmaster / Principal</div>
        </div>
      </div>

      <div style={{ marginTop: 20, textAlign: 'right', fontSize: 12 }}>
        Date: {tc.issued_date ?? today}
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: '#666', textAlign: 'center' }}>
        Generated by EdProSys — edprosys.com
      </div>
    </div>
  );
}
