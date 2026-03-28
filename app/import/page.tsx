'use client';

import { useState, useRef } from 'react';
import Layout from '@/components/Layout';

interface ImportResult {
  jobId: string;
  total: number;
  imported: number;
  failed: number;
  errors: { row: number; name: string; error: string }[];
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    if (!file) return;
    setStatus('uploading'); setResult(null); setErrorMsg('');

    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await fetch('/api/import/students', { method: 'POST', body: fd });
      const d = await res.json() as ImportResult & { error?: string };
      if (!res.ok) { setErrorMsg(d.error ?? 'Import failed'); setStatus('error'); return; }
      setResult(d);
      setStatus('done');
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch { setErrorMsg('Network error'); setStatus('error'); }
  }

  return (
    <Layout title="CSV Import" subtitle="Bulk import students from a spreadsheet">
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* Instructions */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 14 }}>📥 Import Students via CSV</div>

          <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontFamily: 'monospace', fontSize: 13, color: '#374151' }}>
            <div style={{ fontWeight: 700, marginBottom: 4, fontFamily: 'inherit' }}>Required CSV format:</div>
            name,class,section,phone_parent,parent_name,roll_number<br />
            Arjun Sharma,5,A,+919876543210,Ramesh Sharma,01<br />
            Priya Reddy,6,B,+919876543211,Vijay Reddy,02
          </div>

          <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
            <strong>Required columns:</strong> name, class<br />
            <strong>Optional columns:</strong> section, phone_parent, parent_name, roll_number, admission_number
          </div>

          {/* Upload zone */}
          <div onClick={() => fileRef.current?.click()}
            style={{ border: `2px dashed ${file ? '#4F46E5' : '#D1D5DB'}`, borderRadius: 12, padding: 28, textAlign: 'center', cursor: 'pointer', background: file ? '#EEF2FF' : '#F9FAFB', marginBottom: 16 }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>📄</div>
            {file ? (
              <>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#4F46E5' }}>{file.name}</div>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 3 }}>{(file.size / 1024).toFixed(1)} KB · Click to change</div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#374151' }}>Click to upload CSV file</div>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 3 }}>Max 2MB</div>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] ?? null)} />

          <button onClick={handleUpload} disabled={!file || status === 'uploading'} className="btn btn-primary" style={{ width: '100%', height: 46 }}>
            {status === 'uploading' ? (
              <>
                <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'os_spin 0.7s linear infinite' }} />
                Importing...
              </>
            ) : 'Import Students'}
          </button>
        </div>

        {status === 'error' && (
          <div className="alert alert-error" style={{ marginBottom: 16 }}><strong>Error:</strong> {errorMsg}</div>
        )}

        {status === 'done' && result && (
          <div className="card" style={{ border: '1.5px solid #22C55E' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✓</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#15803D' }}>Import Complete</div>
                <div style={{ fontSize: 13, color: '#6B7280' }}>Job ID: {result.jobId}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: result.errors.length > 0 ? 16 : 0 }}>
              {[
                { l: 'Total Rows', v: result.total, c: '#4F46E5', bg: '#EEF2FF' },
                { l: 'Imported', v: result.imported, c: '#15803D', bg: '#DCFCE7' },
                { l: 'Failed', v: result.failed, c: result.failed > 0 ? '#B91C1C' : '#6B7280', bg: result.failed > 0 ? '#FEE2E2' : '#F3F4F6' },
              ].map(k => (
                <div key={k.l} style={{ background: k.bg, borderRadius: 10, padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: k.c }}>{k.v}</div>
                  <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>{k.l}</div>
                </div>
              ))}
            </div>

            {result.errors.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Failed rows:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {result.errors.slice(0, 10).map((e, i) => (
                    <div key={i} style={{ background: '#FEF2F2', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
                      <strong>Row {e.row} ({e.name}):</strong> {e.error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
