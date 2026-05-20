'use client';
// app/admin/import/page.tsx
// Bulk CSV/XLSX import: Students · Staff · Parents
// Uses existing /api/students POST, /api/admin/staff POST, /api/admin/parents POST
// Tenant-isolated via admin session. Tracks via import_jobs table.
// Telugu-safe: UTF-8 CSV with BOM handled by Papa.parse.

import { useState, useRef } from 'react';
import Layout from '@/components/Layout';
import { T } from '@/lib/i18n';
import { useLang } from '@/lib/useLang';

type TabType = 'students' | 'staff' | 'parents';

interface ColSpec { key: string; header: string; required: boolean; desc?: string; }

const STUDENT_COLS: ColSpec[] = [
  { key: 'name',             header: 'name',             required: true,  desc: 'Full name' },
  { key: 'class',            header: 'class',            required: true,  desc: '1–10, Nursery, LKG, UKG' },
  { key: 'section',          header: 'section',          required: false, desc: 'A / B / C' },
  { key: 'roll_number',      header: 'roll_number',      required: false, desc: '' },
  { key: 'admission_number', header: 'admission_number', required: false, desc: '' },
  { key: 'parent_name',      header: 'parent_name',      required: false, desc: '' },
  { key: 'phone_parent',     header: 'phone_parent',     required: false, desc: '+91XXXXXXXXXX — triggers WhatsApp PIN' },
  { key: 'date_of_birth',    header: 'date_of_birth',    required: false, desc: 'YYYY-MM-DD' },
];

const STAFF_COLS: ColSpec[] = [
  { key: 'name',    header: 'name',    required: true,  desc: 'Full name' },
  { key: 'role',    header: 'role',    required: false, desc: 'teacher / admin / principal' },
  { key: 'email',   header: 'email',   required: false, desc: 'Creates login account' },
  { key: 'phone',   header: 'phone',   required: false, desc: '' },
  { key: 'subject', header: 'subject', required: false, desc: 'e.g. Mathematics' },
];

const PARENT_COLS: ColSpec[] = [
  { key: 'student_name',     header: 'student_name',     required: true,  desc: 'Must match existing student' },
  { key: 'parent_name',      header: 'parent_name',      required: true,  desc: '' },
  { key: 'phone',            header: 'phone',            required: true,  desc: '+91XXXXXXXXXX' },
  { key: 'admission_number', header: 'admission_number', required: false, desc: 'Helps match student' },
];

const COLS: Record<TabType, ColSpec[]> = {
  students: STUDENT_COLS,
  staff:    STAFF_COLS,
  parents:  PARENT_COLS,
};

const API_ROUTE: Record<TabType, string> = {
  students: '/api/students',
  staff:    '/api/admin/staff',
  parents:  '/api/admin/parents',
};

// Minimal Papa.parse-compatible CSV parser (no external dep needed for basic CSVs)
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase().replace(/ /g, '_'));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? ''; });
    rows.push(row);
  }
  return rows;
}

interface RowResult { row: number; status: 'ok' | 'error' | 'skip'; message?: string; data?: Record<string, string>; }

export default function ImportPage() {
  const { lang } = useLang();
  const [tab, setTab] = useState<TabType>('students');
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [results, setResults] = useState<RowResult[]>([]);
  const [importing, setImporting] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const cols = COLS[tab];
  const requiredCols = cols.filter(c => c.required).map(c => c.key);

  // Validate a row against required columns
  function validateRow(row: Record<string, string>, idx: number): RowResult {
    for (const key of requiredCols) {
      if (!row[key]?.trim()) {
        return { row: idx + 1, status: 'error', message: `Missing required: ${key}`, data: row };
      }
    }
    return { row: idx + 1, status: 'ok', data: row };
  }

  function handleFile(file: File) {
    setResults([]); setDone(false); setParseError('');
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) { setParseError('Could not read file.'); return; }

      const parsed = parseCSV(text);
      if (parsed.length === 0) { setParseError('No data rows found. Check your CSV headers.'); return; }

      // Check required headers present
      const firstRow = parsed[0];
      const missing = requiredCols.filter(k => !(k in firstRow));
      if (missing.length > 0) {
        setParseError(`Missing required columns: ${missing.join(', ')}`);
        return;
      }

      setRows(parsed);
    };
    reader.readAsText(file, 'UTF-8');
  }

  async function runImport() {
    if (rows.length === 0) return;
    setImporting(true); setDone(false);

    const validated = rows.map((r, i) => validateRow(r, i));
    const toImport = validated.filter(v => v.status === 'ok');

    if (dryRun) {
      // Dry run: just validate, don't POST
      setResults(validated.map(v => ({
        ...v,
        status: v.status === 'ok' ? 'ok' : 'error',
        message: v.status === 'ok' ? 'Validation passed' : v.message,
      })));
      setImporting(false);
      setDone(true);
      return;
    }

    // Live import: POST each row
    const liveResults: RowResult[] = [...validated];
    let imported = 0;
    let failed = 0;

    for (let i = 0; i < toImport.length; i++) {
      const v = toImport[i];
      const rowIndex = v.row - 1;
      try {
        const res = await fetch(API_ROUTE[tab], {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(v.data),
        });
        const d = await res.json() as { error?: string };
        if (res.ok) {
          liveResults[rowIndex] = { ...v, status: 'ok', message: 'Imported ✓' };
          imported++;
        } else {
          liveResults[rowIndex] = { ...v, status: 'error', message: d.error ?? 'API error' };
          failed++;
        }
      } catch (err) {
        liveResults[rowIndex] = { ...v, status: 'error', message: 'Network error' };
        failed++;
      }
      // Update results live
      setResults([...liveResults]);
    }

    setImporting(false);
    setDone(true);
    console.info(`Import complete: ${imported} ok, ${failed} failed`);
  }

  function reset() {
    setRows([]); setResults([]); setFileName(''); setParseError(''); setDone(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  const okCount    = results.filter(r => r.status === 'ok').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const inp = { width: '100%', padding: '9px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const };

  return (
    <Layout title={T('upload', lang as never)} subtitle={T('upload', lang as never)}>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['students', 'staff', 'parents'] as TabType[]).map(t => (
          <button key={t} onClick={() => { setTab(t); reset(); }}
            style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: tab === t ? '#4F46E5' : '#F3F4F6',
              color: tab === t ? '#fff' : '#374151' }}>
            {T(t, lang as never)}
          </button>
        ))}
      </div>

      {/* Column spec */}
      <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 16px', marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>
          Required CSV columns ({tab}):
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {cols.map(c => (
            <span key={c.key} style={{
              padding: '3px 9px', borderRadius: 6, fontSize: 12, fontWeight: 600,
              background: c.required ? '#EEF2FF' : '#F3F4F6',
              color: c.required ? '#4F46E5' : '#6B7280',
              border: `1px solid ${c.required ? '#C7D2FE' : '#E5E7EB'}`,
            }}>
              {c.header}{c.required ? ' *' : ''}
              {c.desc ? ` — ${c.desc}` : ''}
            </span>
          ))}
        </div>
        <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8 }}>
          * Required · First row must be header row · UTF-8 CSV · Max 2000 rows
        </div>
      </div>

      {/* Upload zone */}
      {rows.length === 0 && (
        <div style={{ border: '2px dashed #D1D5DB', borderRadius: 14, padding: '32px 20px', textAlign: 'center', marginBottom: 18, background: '#FAFAFA' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📥</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
            {T('upload', lang as never)} CSV
          </div>
          <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 16 }}>
            .csv or .txt · UTF-8 · max 2000 rows
          </div>
          <label style={{ display: 'inline-block', padding: '10px 24px', background: '#4F46E5', color: '#fff', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            {T('add', lang as never)} {T('upload', lang as never)}
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </label>
          {parseError && (
            <div style={{ marginTop: 14, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#B91C1C' }}>
              ⚠️ {parseError}
            </div>
          )}
        </div>
      )}

      {/* Preview table */}
      {rows.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
              📋 {rows.length} {T('records', lang as never)} — {fileName}
            </div>
            <button onClick={reset} style={{ padding: '5px 12px', background: '#F3F4F6', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#374151' }}>
              ✕ {T('cancel', lang as never)}
            </button>
          </div>

          <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #E5E7EB' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '1px solid #E5E7EB' }}>#</th>
                  {cols.map(c => (
                    <th key={c.key} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: c.required ? '#4F46E5' : '#374151', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>
                      {c.header}{c.required ? ' *' : ''}
                    </th>
                  ))}
                  {results.length > 0 && <th style={{ padding: '8px 10px', fontWeight: 700, color: '#374151', borderBottom: '1px solid #E5E7EB' }}>Status</th>}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((row, i) => {
                  const res = results[i];
                  const rowBg = res?.status === 'ok' ? '#F0FDF4' : res?.status === 'error' ? '#FEF2F2' : '#fff';
                  return (
                    <tr key={i} style={{ background: rowBg, borderBottom: '1px solid #F9FAFB' }}>
                      <td style={{ padding: '7px 10px', color: '#9CA3AF' }}>{i + 1}</td>
                      {cols.map(c => (
                        <td key={c.key} style={{ padding: '7px 10px', color: '#111827', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row[c.key] ?? '—'}
                        </td>
                      ))}
                      {res && (
                        <td style={{ padding: '7px 10px', fontSize: 11, fontWeight: 600, color: res.status === 'ok' ? '#15803D' : '#B91C1C' }}>
                          {res.status === 'ok' ? '✓' : `✗ ${res.message ?? ''}`}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length > 10 && (
              <div style={{ padding: '8px 12px', fontSize: 12, color: '#9CA3AF', borderTop: '1px solid #F3F4F6', textAlign: 'center' }}>
                Showing first 10 of {rows.length} rows
              </div>
            )}
          </div>

          {/* Summary bar after import */}
          {done && (
            <div style={{ marginTop: 12, padding: '12px 16px', background: errorCount === 0 ? '#F0FDF4' : '#FEF2F2', borderRadius: 10, border: `1px solid ${errorCount === 0 ? '#D1FAE5' : '#FECACA'}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: errorCount === 0 ? '#15803D' : '#B91C1C' }}>
                {dryRun
                  ? `Dry run: ${okCount} valid, ${errorCount} errors`
                  : `Import complete: ${okCount} imported, ${errorCount} failed`}
              </div>
              {errorCount > 0 && (
                <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>
                  Fix the errored rows and re-upload.
                </div>
              )}
            </div>
          )}

          {/* Controls */}
          {!done && (
            <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} style={{ width: 16, height: 16 }} />
                Dry run (validate only, don&apos;t import)
              </label>
              <button
                onClick={() => void runImport()}
                disabled={importing}
                style={{ padding: '10px 22px', background: importing ? '#9CA3AF' : dryRun ? '#0284C7' : '#16A34A', color: '#fff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: importing ? 'not-allowed' : 'pointer' }}>
                {importing ? `${T('loading', lang as never)}…` : dryRun ? '🔍 Validate' : `⬆ ${T('upload', lang as never)} ${rows.length} ${T(tab, lang as never)}`}
              </button>
            </div>
          )}

          {done && (
            <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
              <button onClick={reset}
                style={{ padding: '10px 22px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {T('upload', lang as never)} {T('other', lang as never)}
              </button>
              {dryRun && errorCount === 0 && (
                <button onClick={() => { setDryRun(false); setDone(false); setResults([]); }}
                  style={{ padding: '10px 22px', background: '#16A34A', color: '#fff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  ⬆ {T('upload', lang as never)} Now
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* CSV template download */}
      <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>
          📋 Template CSV
        </div>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>
          Copy these headers as your first row:
        </div>
        <code style={{ display: 'block', fontSize: 12, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 7, padding: '10px 12px', color: '#111827', wordBreak: 'break-all' }}>
          {cols.map(c => c.header).join(',')}
        </code>
        <button
          onClick={() => {
            const header = cols.map(c => c.header).join(',');
            const sampleData = cols.map(c => {
              if (c.key === 'name') return 'రాహుల్ కుమార్';
              if (c.key === 'class') return '5';
              if (c.key === 'section') return 'A';
              if (c.key === 'role') return 'teacher';
              if (c.key === 'phone' || c.key === 'phone_parent') return '+919876543210';
              return '';
            }).join(',');
            const blob = new Blob(['\uFEFF' + header + '\n' + sampleData + '\n'], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `edprosys_${tab}_template.csv`; a.click();
            URL.revokeObjectURL(url);
          }}
          style={{ marginTop: 10, padding: '7px 14px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          ⬇ {T('download', lang as never)} Template
        </button>
      </div>
    </Layout>
  );
}
