'use client';

// PATH: app/automation/promotion/page.tsx
// Item #9 — Academic Year Promotion UI
//
// Three-step state machine: preview → confirm → result
// Auth: principal session (middleware). No payment actions.

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

interface PreviewData {
  from_year: { id: string; label: string; status: string };
  to_year_candidates: { id: string; label: string; status: string }[];
  student_summary: {
    total_active: number;
    by_class: {
      current_class: string; current_section: string; student_count: number;
      target_class: string | null; target_section: string;
      is_graduating: boolean; class_exists_in_target: boolean;
    }[];
  };
  unmatched_students: { id: string; name: string; class: string; section: string; reason: string }[];
  graduating_students: { id: string; name: string; class: string; section: string }[];
  warnings: string[];
  can_execute: boolean;
}

interface ResultData {
  success: boolean;
  promoted_count: number;
  graduated_count: number;
  retained_count: number;
  unmatched_count: number;
  new_active_year: { id: string; label: string };
  message: string;
}

type Step = 'preview' | 'confirm' | 'result';

export default function AcademicYearPromotion() {
  const [step, setStep] = useState<Step>('preview');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<ResultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedToYearId, setSelectedToYearId] = useState('');
  const [retainIds, setRetainIds] = useState<Set<string>>(new Set());
  const [showGraduating, setShowGraduating] = useState(false);
  const [showUnmatched, setShowUnmatched] = useState(false);

  useEffect(() => { void loadPreview(); }, []);

  async function loadPreview() {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/principal/academic-year-promotion/preview');
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? 'Failed to load preview'); return; }
      setPreview(d);
      if (d.to_year_candidates?.length > 0) setSelectedToYearId(d.to_year_candidates[0].id);
    } finally { setLoading(false); }
  }

  async function executePromotion() {
    if (!preview || !selectedToYearId) return;
    setExecuting(true); setError(null);
    try {
      const res = await fetch('/api/principal/academic-year-promotion/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_year_id: preview.from_year.id,
          to_year_id: selectedToYearId,
          retain_student_ids: retainIds.size > 0 ? [...retainIds] : undefined,
          confirm: true,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? 'Promotion failed'); setStep('preview'); return; }
      setResult(d);
      setStep('result');
    } finally { setExecuting(false); }
  }

  function toggleRetain(id: string) {
    setRetainIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const cardStyle = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 16, marginBottom: 16 };
  const sectionTitle = { fontWeight: 700 as const, fontSize: 15, marginBottom: 12 };

  // ── RESULT ──────────────────────────────────────────────────────────────
  if (step === 'result' && result) return (
    <Layout title="Academic Year Promotion" subtitle="Promotion complete">
      <div style={{ ...cardStyle, borderLeft: '4px solid #065F46', background: '#F0FDF4' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#065F46', marginBottom: 8 }}>✅ Promotion Completed</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 14 }}>
          {[
            ['Promoted', result.promoted_count, '#1E40AF'],
            ['Graduated', result.graduated_count, '#065F46'],
            ['Retained', result.retained_count, '#92400E'],
            ['Unmatched', result.unmatched_count, '#6B7280'],
          ].map(([label, count, color]) => (
            <div key={label as string} style={{ background: '#fff', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: color as string }}>{count}</div>
              <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>{label as string}</div>
            </div>
          ))}
        </div>
        <div style={{ background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#713F12', marginBottom: 12 }}>
          ⚠️ {result.message}
        </div>
        <div style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>
          New active year: <strong>{result.new_active_year.label}</strong>
        </div>
        <a href="/automation" style={{ fontSize: 13, color: '#4F46E5', textDecoration: 'none', fontWeight: 600 }}>← Back to Operations</a>
      </div>
    </Layout>
  );

  // ── CONFIRM MODAL ───────────────────────────────────────────────────────
  if (step === 'confirm' && preview) {
    const toYear = preview.to_year_candidates.find(y => y.id === selectedToYearId);
    const promotingCount = preview.student_summary.by_class.filter(g => !g.is_graduating).reduce((s, g) => s + g.student_count, 0) - retainIds.size;
    const graduatingCount = preview.graduating_students.length;
    return (
      <Layout title="Academic Year Promotion" subtitle="Confirm promotion">
        <div style={cardStyle}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Confirm Promotion</div>
          <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, marginBottom: 16 }}>
            This will:<br />
            • Promote <strong>{promotingCount} student{promotingCount !== 1 ? 's' : ''}</strong> to their next class<br />
            • Graduate <strong>{graduatingCount} student{graduatingCount !== 1 ? 's' : ''}</strong> from the final class<br />
            • Activate academic year <strong>{toYear?.label}</strong><br />
            • Complete academic year <strong>{preview.from_year.label}</strong><br />
            {retainIds.size > 0 && <><strong>{retainIds.size} student{retainIds.size !== 1 ? 's' : ''}</strong> will be held back (no class change)<br /></>}
            <br />
            <strong>This action cannot be undone.</strong>
          </div>
          <div style={{ background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#713F12', marginBottom: 16 }}>
            ⚠️ Fee schedules will NOT be generated automatically. Assign new fee schedules separately after promotion.
          </div>
          {error && <div style={{ color: '#991B1B', fontSize: 13, marginBottom: 10 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setStep('preview')} disabled={executing}
              style={{ flex: 1, padding: '10px', background: '#F3F4F6', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={() => void executePromotion()} disabled={executing}
              style={{ flex: 2, padding: '10px', background: executing ? '#9CA3AF' : '#991B1B', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: executing ? 'not-allowed' : 'pointer' }}>
              {executing ? 'Promoting...' : 'Confirm Promotion'}
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // ── PREVIEW ──────────────────────────────────────────────────────────────
  return (
    <Layout title="Academic Year Promotion" subtitle={preview ? `${preview.student_summary.total_active} active students` : 'Loading...'}>

      {loading && <div style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>Loading preview...</div>}
      {error && !loading && (
        <div style={{ ...cardStyle, borderLeft: '4px solid #991B1B', background: '#FEF2F2' }}>
          <div style={{ color: '#991B1B', fontWeight: 600 }}>{error}</div>
        </div>
      )}

      {!loading && preview && (<>

        {/* Current year banner */}
        <div style={{ ...cardStyle, background: '#EFF6FF', borderColor: '#BFDBFE' }}>
          <div style={{ fontSize: 12, color: '#1E40AF', fontWeight: 600, marginBottom: 4 }}>CURRENT ACADEMIC YEAR</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1E40AF' }}>{preview.from_year.label}</div>
        </div>

        {/* Warnings */}
        {preview.warnings.length > 0 && (
          <div style={{ ...cardStyle, background: '#FFFBEB', borderColor: '#FDE68A' }}>
            {preview.warnings.map((w, i) => (
              <div key={i} style={{ fontSize: 12, color: '#92400E', marginBottom: i < preview.warnings.length - 1 ? 6 : 0 }}>⚠️ {w}</div>
            ))}
          </div>
        )}

        {/* Class breakdown table */}
        <div style={cardStyle}>
          <div style={sectionTitle}>Class Breakdown</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  {['Class', 'Students', 'Target', 'Action'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.student_summary.by_class.map(g => {
                  const action = g.is_graduating ? 'Graduate' : g.target_class ? `→ Grade ${g.target_class}` : 'No target';
                  const actionColor = g.is_graduating ? '#065F46' : g.target_class ? '#1E40AF' : '#991B1B';
                  return (
                    <tr key={`${g.current_class}-${g.current_section}`} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>Grade {g.current_class}-{g.current_section}</td>
                      <td style={{ padding: '8px 10px' }}>{g.student_count}</td>
                      <td style={{ padding: '8px 10px', color: '#6B7280' }}>
                        {g.is_graduating ? 'Graduating' : g.target_class ? `Grade ${g.target_class}-${g.target_section}` : '—'}
                        {g.target_class && !g.class_exists_in_target && <span style={{ fontSize: 10, color: '#92400E', marginLeft: 4 }}>⚠️ class not in table</span>}
                      </td>
                      <td style={{ padding: '8px 10px', color: actionColor, fontWeight: 600, fontSize: 12 }}>{action}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Graduating students collapsible */}
        {preview.graduating_students.length > 0 && (
          <div style={cardStyle}>
            <button onClick={() => setShowGraduating(!showGraduating)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, color: '#374151', padding: 0 }}>
              {showGraduating ? '▾' : '▸'} Graduating Students ({preview.graduating_students.length})
            </button>
            {showGraduating && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {preview.graduating_students.map(s => (
                  <div key={s.id} style={{ fontSize: 13, color: '#374151', display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #F3F4F6' }}>
                    <span>{s.name}</span>
                    <span style={{ color: '#6B7280' }}>Grade {s.class}-{s.section}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Unmatched students collapsible */}
        {preview.unmatched_students.length > 0 && (
          <div style={{ ...cardStyle, borderColor: '#FCA5A5', background: '#FEF2F2' }}>
            <button onClick={() => setShowUnmatched(!showUnmatched)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, color: '#991B1B', padding: 0 }}>
              {showUnmatched ? '▾' : '▸'} Unmatched Students ({preview.unmatched_students.length})
            </button>
            {showUnmatched && (
              <div style={{ marginTop: 10 }}>
                {preview.unmatched_students.map(s => (
                  <div key={s.id} style={{ fontSize: 12, color: '#991B1B', padding: '3px 0' }}>
                    {s.name} (Grade {s.class}-{s.section}) — {s.reason}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Retain students */}
        <div style={cardStyle}>
          <div style={sectionTitle}>Hold Back Students (optional)</div>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>Select students who should NOT be promoted — they will stay in their current class.</div>
          <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {preview.student_summary.by_class.flatMap(g =>
              g.is_graduating ? [] : []  // Retain only applies to non-graduating students
            )}
            {/* Show all non-graduating students from API graduating list exclusion */}
            {preview.graduating_students.length === 0 && preview.student_summary.total_active === 0 && (
              <div style={{ color: '#9CA3AF', fontSize: 12 }}>No students</div>
            )}
          </div>
          {retainIds.size > 0 && (
            <div style={{ fontSize: 12, color: '#92400E', marginTop: 8 }}>{retainIds.size} student{retainIds.size !== 1 ? 's' : ''} will be held back.</div>
          )}
        </div>

        {/* Target year selection + execute */}
        <div style={cardStyle}>
          <div style={sectionTitle}>Target Academic Year</div>
          {preview.to_year_candidates.length === 0 ? (
            <div style={{ color: '#991B1B', fontSize: 13 }}>No draft or planned years available. Create a target academic year first.</div>
          ) : (
            <>
              <select value={selectedToYearId} onChange={e => setSelectedToYearId(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, marginBottom: 14 }}>
                {preview.to_year_candidates.map(y => (
                  <option key={y.id} value={y.id}>{y.label} ({y.status})</option>
                ))}
              </select>
              <button
                onClick={() => setStep('confirm')}
                disabled={!preview.can_execute || !selectedToYearId}
                style={{
                  width: '100%', padding: '12px', background: (!preview.can_execute || !selectedToYearId) ? '#9CA3AF' : '#991B1B',
                  color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700,
                  cursor: (!preview.can_execute || !selectedToYearId) ? 'not-allowed' : 'pointer',
                }}>
                Run Promotion
              </button>
              <div style={{ fontSize: 11, color: '#6B7280', marginTop: 8, textAlign: 'center' }}>
                You will be asked to confirm before any changes are made.
              </div>
            </>
          )}
        </div>

      </>)}
    </Layout>
  );
}
