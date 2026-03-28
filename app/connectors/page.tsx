'use client';

// PATH: app/connectors/page.tsx
//
// Data Connectors — unified ingestion layer UI.
// Supports: JSON/API push, Google Sheets pull, CSV (existing /import page).
// Shows run history and field mapping reference.

import { useState, useEffect, FormEvent } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';

interface ConnectorRun {
  id: string;
  source: string;
  entity: string;
  filename: string | null;
  total_rows: number;
  inserted: number;
  updated: number;
  failed: number;
  status: string;
  started_at: string;
  completed_at: string | null;
}

const SOURCE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  csv:           { label: 'CSV Upload', icon: '📄', color: '#4F46E5' },
  google_sheets: { label: 'Google Sheets', icon: '📊', color: '#15803D' },
  tally:         { label: 'Tally / ERP', icon: '🏦', color: '#A16207' },
  erp_json:      { label: 'ERP JSON', icon: '⚙️', color: '#6D28D9' },
  api:           { label: 'API Push', icon: '🔌', color: '#065F46' },
  manual:        { label: 'Manual', icon: '✍️', color: '#6B7280' },
};

const ENTITY_LABELS: Record<string, string> = {
  students: 'Students',
  fees: 'Fees',
  attendance: 'Attendance',
  academic_records: 'Academic Records',
  mixed: 'Mixed',
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  done:       { bg: '#DCFCE7', color: '#15803D' },
  failed:     { bg: '#FEE2E2', color: '#B91C1C' },
  processing: { bg: '#DBEAFE', color: '#1D4ED8' },
  pending:    { bg: '#F3F4F6', color: '#6B7280' },
};

const FIELD_MAPS: Record<string, { field: string; aliases: string }[]> = {
  students: [
    { field: 'name', aliases: 'name, student_name, Name, StudentName' },
    { field: 'class', aliases: 'class, Class, grade, Grade, std' },
    { field: 'section', aliases: 'section, Section, div' },
    { field: 'roll_number', aliases: 'roll_number, roll, RollNo, roll_no' },
    { field: 'admission_number', aliases: 'admission_number, adm_no, AdmNo, admission' },
    { field: 'parent_name', aliases: 'parent_name, father_name, ParentName, guardian' },
    { field: 'phone_parent', aliases: 'phone_parent, phone, mobile, Phone, parent_phone' },
    { field: 'erp_id', aliases: 'erp_id, student_id, ID (used for matching)' },
  ],
  fees: [
    { field: 'amount', aliases: 'amount, Amount, fee_amount, total' },
    { field: 'fee_type', aliases: 'fee_type, type, Type, head' },
    { field: 'due_date', aliases: 'due_date, DueDate, due' },
    { field: 'status', aliases: 'status, Status (pending/paid/overdue)' },
    { field: 'student_id / erp_id', aliases: 'student_id, erp_id, StudentID, admission_number (to link student)' },
  ],
  attendance: [
    { field: 'date', aliases: 'date, Date, attendance_date' },
    { field: 'status', aliases: 'status, Status, attendance (P/A/L/1/0)' },
    { field: 'student_id / erp_id', aliases: 'student_id, erp_id, StudentID, admission_number' },
  ],
  academic_records: [
    { field: 'subject', aliases: 'subject, Subject, sub' },
    { field: 'term', aliases: 'term, Term, exam' },
    { field: 'marks_obtained', aliases: 'marks_obtained, marks, Marks, score' },
    { field: 'max_marks', aliases: 'max_marks, maximum, MaxMarks, out_of' },
    { field: 'student_id / erp_id', aliases: 'student_id, erp_id, StudentID, admission_number' },
  ],
};

export default function ConnectorsPage() {
  const [runs, setRuns] = useState<ConnectorRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'api' | 'sheets' | 'history' | 'mapping'>('sheets');

  // Sheets form
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetEntity, setSheetEntity] = useState('students');
  const [sheetName, setSheetName] = useState('');
  const [sheetDryRun, setSheetDryRun] = useState(false);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetResult, setSheetResult] = useState<Record<string, unknown> | null>(null);
  const [sheetError, setSheetError] = useState('');

  // API push example state
  const [apiEntity, setApiEntity] = useState('students');

  useEffect(() => { fetchHistory(); }, []);

  async function fetchHistory() {
    setLoading(true);
    try {
      const res = await fetch('/api/connectors/import');
      const d = await res.json() as { runs?: ConnectorRun[] };
      setRuns(d.runs ?? []);
    } finally { setLoading(false); }
  }

  async function handleSheetsImport(e: FormEvent) {
    e.preventDefault();
    setSheetLoading(true); setSheetResult(null); setSheetError('');
    try {
      const res = await fetch('/api/connectors/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheet_url: sheetUrl, entity: sheetEntity, sheet_name: sheetName || undefined, dry_run: sheetDryRun }),
      });
      const d = await res.json() as Record<string, unknown>;
      if (!res.ok) { setSheetError(String(d.error ?? 'Import failed')); }
      else setSheetResult(d);
      fetchHistory();
    } catch (err) { setSheetError(String(err));
    } finally { setSheetLoading(false); }
  }

  const API_EXAMPLES: Record<string, string> = {
    students: JSON.stringify([
      { name: 'Arjun Sharma', class: '5', section: 'A', roll_number: '01', parent_name: 'Ramesh Sharma', phone_parent: '+919876543210', erp_id: 'ERP001' },
      { name: 'Priya Nair', class: '6', section: 'B', admission_number: 'ADM-2024-002', phone_parent: '+919876543211' },
    ], null, 2),
    fees: JSON.stringify([
      { erp_id: 'ERP001', fee_type: 'tuition', amount: 15000, due_date: '2025-04-10', status: 'pending' },
      { admission_number: 'ADM-2024-002', fee_type: 'transport', amount: 1500, due_date: '2025-04-10', status: 'paid' },
    ], null, 2),
    attendance: JSON.stringify([
      { erp_id: 'ERP001', date: '2025-03-28', status: 'P' },
      { admission_number: 'ADM-2024-002', date: '2025-03-28', status: 'A' },
    ], null, 2),
    academic_records: JSON.stringify([
      { erp_id: 'ERP001', subject: 'Mathematics', term: 'Term 1 2024-25', marks: 85, max_marks: 100 },
      { erp_id: 'ERP001', subject: 'Science', term: 'Term 1 2024-25', marks: 78, out_of: 100 },
    ], null, 2),
  };

  const inputStyle = { width: '100%', height: 40, borderRadius: 8, border: '1px solid #D1D5DB', background: '#F9FAFB', fontSize: 14, padding: '0 12px', outline: 'none', fontFamily: 'inherit', color: '#111827', boxSizing: 'border-box' as const };

  return (
    <Layout title="Data Connectors" subtitle="Import data from any source — Google Sheets, ERP, Tally, or API">

      {/* Source cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { key: 'sheets', label: 'Google Sheets', icon: '📊', desc: 'Pull from any public sheet', color: '#15803D', bg: '#DCFCE7' },
          { key: 'api', label: 'API / JSON Push', icon: '🔌', desc: 'POST from ERP or Tally', color: '#6D28D9', bg: '#F5F3FF' },
          { key: 'mapping', label: 'Field Mapping', icon: '🗺️', desc: 'Accepted field names', color: '#A16207', bg: '#FEF9C3' },
          { key: 'history', label: 'Run History', icon: '📋', desc: `${runs.length} imports logged`, color: '#374151', bg: '#F9FAFB' },
        ].map(s => (
          <button key={s.key} onClick={() => setActiveTab(s.key as typeof activeTab)}
            style={{ padding: '16px', borderRadius: 14, border: `2px solid ${activeTab === s.key ? s.color : '#E5E7EB'}`, background: activeTab === s.key ? s.bg : '#fff', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: s.color, marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 12, color: '#9CA3AF' }}>{s.desc}</div>
          </button>
        ))}
      </div>

      {/* Google Sheets tab */}
      {activeTab === 'sheets' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div>
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 16 }}>📊 Import from Google Sheets</div>

              {sheetError && <div className="alert alert-error" style={{ marginBottom: 14 }}>{sheetError}</div>}

              {sheetResult && (
                <div className="alert alert-success" style={{ marginBottom: 14 }}>
                  <strong>✓ Import complete</strong><br />
                  {String(sheetResult.inserted ?? 0)} inserted · {String(sheetResult.updated ?? 0)} updated · {String(sheetResult.failed ?? 0)} failed
                  {sheetDryRun && ' · DRY RUN (no data saved)'}
                </div>
              )}

              <form onSubmit={handleSheetsImport}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>GOOGLE SHEETS URL *</label>
                  <input required style={inputStyle} value={sheetUrl} onChange={e => setSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..." />
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>Sheet must be publicly readable ("Anyone with link can view")</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>DATA TYPE *</label>
                    <select required style={inputStyle} value={sheetEntity} onChange={e => setSheetEntity(e.target.value)}>
                      <option value="students">Students</option>
                      <option value="fees">Fees</option>
                      <option value="attendance">Attendance</option>
                      <option value="academic_records">Academic Records</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>SHEET TAB NAME</label>
                    <input style={inputStyle} value={sheetName} onChange={e => setSheetName(e.target.value)} placeholder="Sheet1 (default: first tab)" />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                  <input type="checkbox" id="dry_run" checked={sheetDryRun} onChange={e => setSheetDryRun(e.target.checked)}
                    style={{ width: 16, height: 16, cursor: 'pointer' }} />
                  <label htmlFor="dry_run" style={{ fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                    Dry run — validate without saving
                  </label>
                </div>

                <button type="submit" disabled={sheetLoading} className="btn btn-primary" style={{ width: '100%' }}>
                  {sheetLoading ? '⏳ Importing...' : sheetDryRun ? '🔍 Validate Sheet' : '📥 Import from Sheet'}
                </button>
              </form>
            </div>
          </div>

          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 12 }}>📋 Sheet Format Requirements</div>
            <div style={{ fontSize: 13, color: '#374151', marginBottom: 12, lineHeight: 1.7 }}>
              <strong>Row 1:</strong> Column headers (field names)<br />
              <strong>Row 2+:</strong> Data rows<br />
              <strong>Matching:</strong> Existing students matched by <code style={{ background: '#F3F4F6', padding: '1px 5px', borderRadius: 4 }}>erp_id</code> or <code style={{ background: '#F3F4F6', padding: '1px 5px', borderRadius: 4 }}>admission_number</code>
            </div>
            <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '12px', fontFamily: 'monospace', fontSize: 12, color: '#374151', lineHeight: 1.8 }}>
              <div style={{ fontWeight: 700, marginBottom: 4, fontFamily: 'inherit', color: '#6B7280', fontSize: 11 }}>EXAMPLE: Students tab headers</div>
              name | class | section | phone_parent | parent_name | erp_id
            </div>
            <div style={{ marginTop: 14, padding: '10px 12px', background: '#EEF2FF', borderRadius: 8, fontSize: 12, color: '#4F46E5' }}>
              <strong>Setup:</strong> Requires <code>GOOGLE_SHEETS_API_KEY</code> in Vercel environment variables.<br />
              Get it free at: <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" style={{ color: '#4F46E5' }}>Google Cloud Console</a> → Enable Sheets API → Create API key.
            </div>
          </div>
        </div>
      )}

      {/* API Push tab */}
      {activeTab === 'api' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 4 }}>🔌 API Push — How to use</div>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>Your ERP, Tally, or any system can push data to this endpoint. No webhook setup needed on your side.</div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#374151', marginBottom: 6 }}>Endpoint</div>
              <div style={{ background: '#0F172A', borderRadius: 8, padding: '12px 14px', fontFamily: 'monospace', fontSize: 13, color: '#7DD3FC' }}>
                POST https://your-school-os.vercel.app/api/connectors/import
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#374151', marginBottom: 6 }}>Headers</div>
              <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: '#374151', lineHeight: 1.8 }}>
                Content-Type: application/json<br />
                Cookie: school_session=&lt;your-session-cookie&gt;
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#374151', marginBottom: 6 }}>Select entity to see example</div>
              <select style={{ ...inputStyle, marginBottom: 10 }} value={apiEntity} onChange={e => setApiEntity(e.target.value)}>
                <option value="students">Students</option>
                <option value="fees">Fees</option>
                <option value="attendance">Attendance</option>
                <option value="academic_records">Academic Records</option>
              </select>
            </div>

            <div style={{ background: '#0F172A', borderRadius: 8, padding: '12px 14px', fontFamily: 'monospace', fontSize: 12, color: '#E2E8F0', lineHeight: 1.8, maxHeight: 260, overflowY: 'auto' }}>
              <div style={{ color: '#7DD3FC', marginBottom: 6 }}>{`{`}</div>
              <div style={{ paddingLeft: 16 }}>
                <div><span style={{ color: '#86EFAC' }}>"source"</span>: <span style={{ color: '#FCD34D' }}>"erp_json"</span>,</div>
                <div><span style={{ color: '#86EFAC' }}>"entity"</span>: <span style={{ color: '#FCD34D' }}>"{apiEntity}"</span>,</div>
                <div><span style={{ color: '#86EFAC' }}>"dry_run"</span>: <span style={{ color: '#FCD34D' }}>false</span>,</div>
                <div><span style={{ color: '#86EFAC' }}>"data"</span>: {API_EXAMPLES[apiEntity]?.split('\n').map((line, i) => (
                  <span key={i} style={{ display: 'block', paddingLeft: i === 0 ? 0 : 0 }}>{line}</span>
                ))}</div>
              </div>
              <div style={{ color: '#7DD3FC' }}>{`}`}</div>
            </div>

            <div style={{ marginTop: 12, padding: '10px 12px', background: '#FFFBEB', borderRadius: 8, fontSize: 12, color: '#A16207' }}>
              <strong>Tally users:</strong> Export XML → convert to JSON using the field names above → POST to this endpoint. Students matched by <code>erp_id</code> or <code>admission_number</code>.
            </div>
          </div>

          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 12 }}>Response format</div>
            <div style={{ background: '#0F172A', borderRadius: 8, padding: '12px 14px', fontFamily: 'monospace', fontSize: 12, color: '#E2E8F0', lineHeight: 1.8, marginBottom: 16 }}>
              <div style={{ color: '#86EFAC' }}>// Success response</div>
              {`{
  "success": true,
  "run_id": "uuid...",
  "source": "erp_json",
  "entity": "students",
  "total": 150,
  "inserted": 45,
  "updated": 103,
  "skipped": 2,
  "failed": 0,
  "errors": []
}`}
            </div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#374151', marginBottom: 8 }}>Deduplication rules</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#374151' }}>
              {[
                { entity: 'Students', rule: 'Matched by erp_id or admission_number → UPDATE. Otherwise → INSERT.' },
                { entity: 'Fees', rule: 'Always INSERTED (no dedup — same student can have multiple fee rows).' },
                { entity: 'Attendance', rule: 'UPSERT by (student, date) — overwrites previous mark for same day.' },
                { entity: 'Academic Records', rule: 'UPSERT by (student, subject, term) — updates existing marks.' },
              ].map(r => (
                <div key={r.entity} style={{ padding: '8px 10px', background: '#F9FAFB', borderRadius: 8 }}>
                  <strong>{r.entity}:</strong> {r.rule}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Field mapping tab */}
      {activeTab === 'mapping' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {Object.entries(FIELD_MAPS).map(([entity, fields]) => (
            <div key={entity} className="card">
              <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 12 }}>
                {ENTITY_LABELS[entity]} — accepted field names
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F9FAFB' }}>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: '#6B7280', fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid #E5E7EB' }}>Field</th>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: '#6B7280', fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid #E5E7EB' }}>Accepted Header Names</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((f, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '7px 10px', fontWeight: 700, color: '#4F46E5', fontFamily: 'monospace', fontSize: 12 }}>{f.field}</td>
                      <td style={{ padding: '7px 10px', color: '#6B7280', fontFamily: 'monospace', fontSize: 11 }}>{f.aliases}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* History tab */}
      {activeTab === 'history' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Import History ({runs.length})</div>
            <button onClick={fetchHistory} className="btn btn-ghost btn-sm">↻ Refresh</button>
          </div>

          {loading ? (
            <div className="empty-state"><div className="empty-state-icon">📋</div><div className="empty-state-title">Loading history...</div></div>
          ) : runs.length === 0 ? (
            <div className="empty-state" style={{ padding: 48 }}>
              <div className="empty-state-icon">🔗</div>
              <div className="empty-state-title">No imports yet</div>
              <div className="empty-state-sub">Use Google Sheets or API push to import data.</div>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Source</th><th>Entity</th><th>File / URL</th><th>Total</th><th>Inserted</th><th>Updated</th><th>Failed</th><th>Status</th><th>Started</th></tr>
              </thead>
              <tbody>
                {runs.map(run => {
                  const src = SOURCE_LABELS[run.source] ?? { label: run.source, icon: '🔧', color: '#6B7280' };
                  const st = STATUS_STYLE[run.status] ?? STATUS_STYLE.pending;
                  return (
                    <tr key={run.id}>
                      <td>
                        <span style={{ fontSize: 16, marginRight: 6 }}>{src.icon}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: src.color }}>{src.label}</span>
                      </td>
                      <td><span className="badge badge-indigo" style={{ fontSize: 11 }}>{ENTITY_LABELS[run.entity] ?? run.entity}</span></td>
                      <td style={{ fontSize: 12, color: '#6B7280', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{run.filename ?? '—'}</td>
                      <td style={{ fontWeight: 700 }}>{run.total_rows}</td>
                      <td style={{ color: '#15803D', fontWeight: 600 }}>{run.inserted}</td>
                      <td style={{ color: '#A16207', fontWeight: 600 }}>{run.updated}</td>
                      <td style={{ color: run.failed > 0 ? '#B91C1C' : '#9CA3AF', fontWeight: 600 }}>{run.failed}</td>
                      <td><span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 10, background: st.bg, color: st.color }}>{run.status.toUpperCase()}</span></td>
                      <td style={{ fontSize: 12, color: '#9CA3AF' }}>
                        {new Date(run.started_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Bottom links */}
      <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
        <Link href="/import" className="btn btn-ghost btn-sm">📄 CSV Import →</Link>
        <Link href="/students" className="btn btn-ghost btn-sm">👨‍🎓 View Students →</Link>
      </div>
    </Layout>
  );
}
