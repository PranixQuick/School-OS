'use client';
// app/admin/import/page.tsx
// Bulk CSV import: Students · Staff · Parents
// Hardened: 50-row preview, duplicate detection, Telugu CSV (BOM), row-level errors.
// Backward compatible: all existing API routes unchanged.

import { useState, useRef, useCallback } from 'react';
import Layout from '@/components/Layout';
import { T } from '@/lib/i18n';
import { useLang } from '@/lib/useLang';

type TabType = 'students' | 'staff' | 'parents';

interface ColSpec { key: string; header: string; required: boolean; desc?: string; }

const STUDENT_COLS: ColSpec[] = [
  { key: 'name',             header: 'name',             required: true,  desc: 'Full name (Telugu OK)' },
  { key: 'class',            header: 'class',            required: true,  desc: '1–10, Nursery, LKG, UKG' },
  { key: 'section',          header: 'section',          required: false, desc: 'A / B / C' },
  { key: 'roll_number',      header: 'roll_number',      required: false, desc: '' },
  { key: 'admission_number', header: 'admission_number', required: false, desc: '' },
  { key: 'gender',           header: 'gender',           required: false, desc: 'M / F / O' },
  { key: 'parent_name',      header: 'parent_name',      required: false, desc: '' },
  { key: 'phone_parent',     header: 'phone_parent',     required: false, desc: '+91XXXXXXXXXX — triggers WhatsApp PIN' },
  { key: 'date_of_birth',    header: 'date_of_birth',    required: false, desc: 'YYYY-MM-DD' },
  { key: 'socioeconomic_category', header: 'socioeconomic_category', required: false, desc: 'OC/BC-A/BC-B/SC/ST/Minority' },
];

const STAFF_COLS: ColSpec[] = [
  { key: 'name',    header: 'name',    required: true,  desc: 'Full name' },
  { key: 'role',    header: 'role',    required: false, desc: 'teacher / admin / principal' },
  { key: 'email',   header: 'email',   required: false, desc: 'Creates login account' },
  { key: 'phone',   header: 'phone',   required: false, desc: '' },
  { key: 'subject', header: 'subject', required: false, desc: 'e.g. Mathematics' },
];

const PARENT_COLS: ColSpec[] = [
  { key: 'student_name',     header: 'student_name',     required: true, desc: 'Must match existing student' },
  { key: 'parent_name',      header: 'parent_name',      required: true, desc: '' },
  { key: 'phone',            header: 'phone',            required: true, desc: '+91XXXXXXXXXX' },
  { key: 'admission_number', header: 'admission_number', required: false, desc: 'Helps match student' },
];

const COLS: Record<TabType, ColSpec[]> = {
  students: STUDENT_COLS, staff: STAFF_COLS, parents: PARENT_COLS,
};
const API_ROUTE: Record<TabType, string> = {
  students: '/api/students', staff: '/api/admin/staff', parents: '/api/admin/parents',
};

// ─── CSV Parser ──────────────────────────────────────────────────────────────
// Handles: UTF-8 with BOM (Excel Telugu), quoted fields, Windows line endings
function parseCSV(text: string): Record<string, string>[] {
  // Strip UTF-8 BOM if present
  const clean = text.replace(/^\uFEFF/, '');
  const lines = clean.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h =>
    h.trim().replace(/^"|"$/g, '').toLowerCase()
     .replace(/ /g, '_').replace(/[^\w]/g, '')
  );

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Handle quoted commas
    const vals: string[] = [];
    let cur = '', inQ = false;
    for (const ch of line + ',') {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? ''; });
    rows.push(row);
  }
  return rows;
}

interface RowResult { row: number; status: 'ok' | 'error' | 'skip' | 'duplicate'; message?: string; data?: Record<string, string>; }

export default function ImportPage() {
  const { lang } = useLang();
  const [tab, setTab]         = useState<TabType>('students');
  const [rows, setRows]       = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [results, setResults] = useState<RowResult[]>([]);
  const [importing, setImporting] = useState(false);
  const [dryRun, setDryRun]   = useState(true);
  const [done, setDone]       = useState(false);
  const [previewLimit, setPreviewLimit] = useState(50);
  const fileRef = useRef<HTMLInputElement>(null);

  const cols = COLS[tab];
  const requiredCols = cols.filter(c => c.required).map(c => c.key);

  function validateRow(row: Record<string, string>, idx: number): RowResult {
    for (const key of requiredCols) {
      if (!row[key]?.trim()) {
        return { row: idx + 1, status: 'error', message: `Missing required: ${key}`, data: row };
      }
    }
    // Validate email format if present
    if (row.email && row.email.trim()) {
      const emailClean = row.email.replace(/\s+/g, '').toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
        return { row: idx + 1, status: 'error', message: `Invalid email: "${row.email}" — check for spaces`, data: row };
      }
      row.email = emailClean; // sanitize on the way in
    }
    // Validate phone format if present
    if (row.phone_parent && row.phone_parent.trim()) {
      const phoneClean = row.phone_parent.replace(/\s+/g, '');
      if (!/^\+?[0-9]{10,13}$/.test(phoneClean)) {
        return { row: idx + 1, status: 'error', message: `Invalid phone: "${row.phone_parent}"`, data: row };
      }
      row.phone_parent = phoneClean;
    }
    // Validate gender if present
    if (row.gender && row.gender.trim()) {
      const g = row.gender.trim().toUpperCase();
      if (!['M','F','O','MALE','FEMALE','BOY','GIRL','OTHER'].includes(g)) {
        return { row: idx + 1, status: 'error', message: `Invalid gender: "${row.gender}" — use M/F/O`, data: row };
      }
      row.gender = g[0] === 'M' ? 'M' : g[0] === 'F' ? 'F' : 'O';
    }
    return { row: idx + 1, status: 'ok', data: row };
  }

  // Duplicate detection: find rows with same name+class or same email/phone
  function detectDuplicates(parsedRows: Record<string, string>[]): Set<number> {
    const seen = new Set<string>();
    const dupIdx = new Set<number>();
    parsedRows.forEach((row, i) => {
      // Student key: name + class
      const key = tab === 'students'
        ? `${row.name?.toLowerCase().trim()}|${row.class?.toLowerCase().trim()}`
        : tab === 'staff'
        ? `${row.email?.toLowerCase().replace(/\s+/g,'').trim()}`
        : `${row.phone?.replace(/\s+/g,'').trim()}`;
      if (key && key !== '|' && key.trim()) {
        if (seen.has(key)) { dupIdx.add(i); } else { seen.add(key); }
      }
    });
    return dupIdx;
  }

  const handleFile = useCallback((file: File) => {
    setResults([]); setDone(false); setParseError('');
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) { setParseError('Could not read file.'); return; }
      const parsed = parseCSV(text);
      if (parsed.length === 0) { setParseError('No data rows found. Check your CSV headers.'); return; }
      const firstRow = parsed[0];
      const missing = requiredCols.filter(k => !(k in firstRow));
      if (missing.length > 0) {
        setParseError(`Missing required columns: ${missing.join(', ')}`);
        return;
      }
      if (parsed.length > 2000) { setParseError(`Too many rows (${parsed.length}). Max 2000 per import.`); return; }
      setRows(parsed);
    };
    reader.readAsText(file, 'UTF-8');
  }, [requiredCols]);

  async function runImport() {
    if (rows.length === 0) return;
    setImporting(true); setDone(false);

    const dupSet = detectDuplicates(rows);
    const validated: RowResult[] = rows.map((r, i) => {
      if (dupSet.has(i)) return { row: i+1, status: 'duplicate', message: 'Duplicate row — skipped', data: r };
      return validateRow(r, i);
    });
    const toImport = validated.filter(v => v.status === 'ok');

    if (dryRun) {
      setResults(validated.map(v => ({
        ...v,
        status: v.status === 'ok' ? 'ok' : v.status,
        message: v.status === 'ok' ? 'Validation passed' : v.message,
      })));
      setImporting(false); setDone(true);
      return;
    }

    const liveResults: RowResult[] = [...validated];
    let imported = 0, failed = 0;

    for (const v of toImport) {
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
      } catch {
        liveResults[rowIndex] = { ...v, status: 'error', message: 'Network error' };
        failed++;
      }
      setResults([...liveResults]);
    }
    setImporting(false); setDone(true);
  }

  function reset() {
    setRows([]); setResults([]); setFileName(''); setParseError(''); setDone(false); setPreviewLimit(50);
    if (fileRef.current) fileRef.current.value = '';
  }

  const okCount    = results.filter(r => r.status === 'ok').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const dupCount   = results.filter(r => r.status === 'duplicate').length;
  const inp = { width: '100%', padding: '9px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const };

  return (
    <Layout title={T('upload', lang as never)} subtitle={T('upload', lang as never)}>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['students', 'staff', 'parents'] as TabType[]).map(t => (
          <button key={t} onClick={() => { setTab(t); reset(); }}
            style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: tab === t ? '#4F46E5' : '#F3F4F6', color: tab === t ? '#fff' : '#374151' }}>
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
            <span key={c.key} style={{ padding: '3px 9px', borderRadius: 6, fontSize: 12, fontWeight: 600,
              background: c.required ? '#EEF2FF' : '#F3F4F6',
              color: c.required ? '#4F46E5' : '#6B7280',
              border: `1px solid ${c.required ? '#C7D2FE' : '#E5E7EB'}` }}>
              {c.header}{c.required ? ' *' : ''}
              {c.desc ? ` — ${c.desc}` : ''}
            </span>
          ))}
        </div>
        <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8 }}>
          * Required · UTF-8 CSV · BOM supported (Excel Telugu) · Max 2000 rows · Duplicates auto-skipped
        </div>
      </div>

      {/* Upload zone */}
      {rows.length === 0 && (
        <div style={{ border: '2px dashed #D1D5DB', borderRadius: 14, padding: '32px 20px', textAlign: 'center', marginBottom: 18, background: '#FAFAFA' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📥</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Upload CSV</div>
          <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 16 }}>
            .csv · UTF-8 with or without BOM · Telugu supported · max 2000 rows
          </div>
          <label style={{ display: 'inline-block', padding: '10px 24px', background: '#4F46E5', color: '#fff', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Choose File
            <input ref={fileRef} type="file" accept=".csv,.txt"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
              📋 {rows.length} rows — {fileName}
              {detectDuplicates(rows).size > 0 && (
                <span style={{ marginLeft: 8, fontSize: 12, background: '#FEF2F2', color: '#B91C1C', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>
                  {detectDuplicates(rows).size} duplicates detected
                </span>
              )}
            </div>
            <button onClick={reset} style={{ padding: '5px 12px', background: '#F3F4F6', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#374151' }}>
              ✕ Cancel
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
                {rows.slice(0, previewLimit).map((row, i) => {
                  const res = results[i];
                  const rowBg = res?.status === 'ok' ? '#F0FDF4'
                    : res?.status === 'error' ? '#FEF2F2'
                    : res?.status === 'duplicate' ? '#FFFBEB'
                    : '#fff';
                  return (
                    <tr key={i} style={{ background: rowBg, borderBottom: '1px solid #F9FAFB' }}>
                      <td style={{ padding: '7px 10px', color: '#9CA3AF' }}>{i + 1}</td>
                      {cols.map(c => (
                        <td key={c.key} style={{ padding: '7px 10px', color: '#111827', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row[c.key] ?? '—'}
                        </td>
                      ))}
                      {res && (
                        <td style={{ padding: '7px 10px', fontSize: 11, fontWeight: 600,
                          color: res.status === 'ok' ? '#15803D' : res.status === 'duplicate' ? '#D97706' : '#B91C1C' }}>
                          {res.status === 'ok' ? '✓'
                            : res.status === 'duplicate' ? `⚠ ${res.message}`
                            : `✗ ${res.message ?? ''}`}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length > previewLimit && (
              <div style={{ padding: '8px 12px', fontSize: 12, color: '#9CA3AF', borderTop: '1px solid #F3F4F6', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: 12 }}>
                Showing {previewLimit} of {rows.length} rows
                {previewLimit < rows.length && (
                  <button onClick={() => setPreviewLimit(l => Math.min(l + 50, rows.length))}
                    style={{ background: 'none', border: 'none', color: '#4F46E5', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0 }}>
                    Show 50 more →
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Summary bar after import */}
          {done && (
            <div style={{ marginTop: 12, padding: '12px 16px', background: errorCount === 0 ? '#F0FDF4' : '#FEF2F2', borderRadius: 10, border: `1px solid ${errorCount === 0 ? '#D1FAE5' : '#FECACA'}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: errorCount === 0 ? '#15803D' : '#B91C1C' }}>
                {dryRun
                  ? `Dry run: ${okCount} valid, ${errorCount} errors${dupCount > 0 ? `, ${dupCount} duplicates skipped` : ''}`
                  : `Import: ${okCount} imported, ${errorCount} failed${dupCount > 0 ? `, ${dupCount} duplicates skipped` : ''}`}
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
                Dry run (validate only, don&apos;t save)
              </label>
              <button onClick={() => void runImport()} disabled={importing}
                style={{ padding: '10px 22px', background: importing ? '#9CA3AF' : dryRun ? '#374151' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: importing ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {importing ? 'Importing…' : dryRun ? '🔍 Validate (Dry Run)' : `⬆ Import ${rows.length} rows`}
              </button>
              <button onClick={reset} style={{ padding: '10px 16px', background: '#F3F4F6', border: 'none', borderRadius: 9, fontSize: 13, cursor: 'pointer', color: '#374151' }}>
                Reset
              </button>
            </div>
          )}
          {done && (
            <button onClick={reset} style={{ marginTop: 12, padding: '10px 22px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Import another file
            </button>
          )}
        </div>
      )}
    </Layout>
  );
}
